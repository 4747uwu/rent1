import mongoose from 'mongoose';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import DicomStudy from '../models/dicomStudyModel.js';
import { recordStudyAction, ACTION_TYPES } from '../utils/RecordAction.js';
import { r2Client } from '../config/cloudflare-r2.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

// ✅ Configuration
const BACKUP_ORTHANC_URL =  'http://orthanc-server:8042';
const BACKUP_ORTHANC_USERNAME = process.env.BACKUP_ORTHANC_USERNAME || 'orthanc';
const BACKUP_ORTHANC_PASSWORD = process.env.BACKUP_ORTHANC_PASSWORD || 'orthanc';
const backupOrthancAuth = 'Basic ' + Buffer.from(BACKUP_ORTHANC_USERNAME + ':' + BACKUP_ORTHANC_PASSWORD).toString('base64');

// ✅ NEW: Use environment variable for shared temp directory
const SHARED_TEMP_DIR = process.env.SHARED_TEMP_DIR || '/tmp/node/restore';

/**
 * ✅ NEW: Restore study from Cloudflare R2 to backup Orthanc (port 9042)
 */
export const restoreFromBackup = async (req, res) => {
  let tempFilePath = null;
  
  try {
    // Extract studyId from request
    let body = req.body;
    let studyId = null;

    if (typeof body === 'string') studyId = body.trim();
    else if (body && typeof body === 'object') {
      studyId = body.studyId || body.ID || Object.keys(body)[0];
    }

    if (!studyId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing studyId' 
      });
    }

    // Optional token check
    const token = process.env.BACKUP_SWITCH_TOKEN;
    if (token) {
      const header = req.headers['x-backup-switch-token'];
      if (!header || header !== token) {
        return res.status(401).json({ 
          success: false,
          error: 'Unauthorized' 
        });
      }
    }

    console.log(`🔄 [Restore] Starting restore process for study: ${studyId}`);

    // 1. Find study in database
    const study = await DicomStudy.findOne({
      $or: [
        { orthancStudyID: studyId },
        { studyInstanceUID: studyId },
        { bharatPacsId: studyId },
        { _id: studyId }
      ]
    });

    if (!study) {
      return res.status(404).json({ 
        success: false,
        error: 'Study not found', 
        studyId 
      });
    }

    // 2. Check if study has backup ZIP URL
    if (!study.preProcessedDownload?.zipUrl && 
        !study.preProcessedDownload?.r2Key && 
        !study.preProcessedDownload?.zipKey) {
      return res.status(400).json({ 
        success: false,
        error: 'Study backup not available in Cloudflare R2',
        studyId: study._id 
      });
    }

    console.log(`📦 [Restore] Study found: ${study.bharatPacsId || study._id}`);

    // ✅ FIX: Use zipKey if r2Key is not available
    const r2Key = study.preProcessedDownload.r2Key || study.preProcessedDownload.zipKey;

    if (!r2Key) {
      return res.status(400).json({ 
        success: false,
        error: 'No R2 key found in study data',
        studyId: study._id,
        availableFields: {
          hasZipUrl: !!study.preProcessedDownload?.zipUrl,
          hasR2Key: !!study.preProcessedDownload?.r2Key,
          hasZipKey: !!study.preProcessedDownload?.zipKey
        }
      });
    }

    console.log(`🔗 [Restore] R2 Key: ${r2Key}`);

    // 3. Ensure temp directory exists
    await mkdir(SHARED_TEMP_DIR, { recursive: true });

    // 4. Download ZIP from Cloudflare R2
    console.log(`⬇️ [Restore] Downloading from R2: ${r2Key}`);

    // ✅ FIXED: Stream directly to /root/node/temp (shared volume)
    await mkdir(SHARED_TEMP_DIR, { recursive: true });

    const tempFileName = `restore_${study._id}_${Date.now()}.zip`;
    tempFilePath = path.join(SHARED_TEMP_DIR, tempFileName);

    console.log(`📁 [Restore] Using shared volume: ${tempFilePath}`);

    const command = new GetObjectCommand({
      Bucket: 'studyzip',
      Key: r2Key,
    });

    const r2Response = await r2Client.send(command);

    // ✅ Stream directly to disk (NO memory accumulation)
    const writeStream = fs.createWriteStream(tempFilePath);
    let downloadedBytes = 0;

    for await (const chunk of r2Response.Body) {
      writeStream.write(chunk);
      downloadedBytes += chunk.length;
      
      // Log progress every 50MB
      if (downloadedBytes % (50 * 1024 * 1024) < chunk.length) {
        const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
        console.log(`📥 [Restore] Downloaded ${downloadedMB} MB...`);
      }
    }

    writeStream.end();

    // Wait for write stream to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const fileSizeMB = (downloadedBytes / 1024 / 1024).toFixed(2);
    console.log(`✅ [Restore] Downloaded ${fileSizeMB}MB to shared volume: ${tempFilePath}`);

    // 5. Upload to backup Orthanc (stream from disk, not memory)
    console.log(`📤 [Restore] Uploading to backup Orthanc: ${BACKUP_ORTHANC_URL}`);

    // ✅ Read file as stream instead of loading into memory
    const fileStream = fs.createReadStream(tempFilePath);

    const uploadResponse = await axios.post(
      `${BACKUP_ORTHANC_URL}/instances`,
      fileStream,  // ✅ Stream instead of buffer
      {
        headers: {
          'Authorization': backupOrthancAuth,
          'Content-Type': 'application/zip'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 300000 // 5 minutes
      }
    );

    console.log(`✅ [Restore] Upload successful to backup Orthanc`);
    console.log(`📊 [Restore] Response:`, uploadResponse.data);

    // 6. Wait 2 seconds for Orthanc to process
    console.log(`⏳ [Restore] Waiting 2 seconds for Orthanc processing...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. Update study record
    const previousOhif = study.ohif;
    study.ohif = 'ohif2'; // Set to backup OHIF
    study.backupRestored = true;
    study.backupRestoredAt = new Date();
    study.modifiedDate = new Date();
    study.statusHistory = study.statusHistory || [];
    study.statusHistory.push({ 
      status: 'backup_restored_to_ohif2', 
      changedAt: new Date(),
      details: { 
        fromR2: r2Key,
        orthancUrl: BACKUP_ORTHANC_URL,
        fileSizeMB: parseFloat(fileSizeMB)
      }
    });

    await study.save();

    // 8. Record action in audit log
    await recordStudyAction({
      studyId: study._id,
      actionType: ACTION_TYPES.STUDY_RESTORED,
      actionCategory: 'administrative',
      performedBy: new mongoose.Types.ObjectId('000000000000000000000000'),
      performedByName: 'System:BackupRestore',
      performedByRole: 'system',
      actionDetails: { 
        previousOhif, 
        newOhif: 'ohif2',
        r2Key,
        fileSizeMB: parseFloat(fileSizeMB),
        backupOrthancUrl: BACKUP_ORTHANC_URL
      },
      notes: `Study restored from R2 backup to OHIF2 (${fileSizeMB}MB)`
    });

    // 9. Clean up temp file
    try {
      await unlink(tempFilePath);
      console.log(`🗑️ [Restore] Cleaned up temp file: ${tempFileName}`);
    } catch (cleanupError) {
      console.warn(`⚠️ [Restore] Failed to clean up temp file:`, cleanupError);
    }

    // 10. Return success
    return res.json({ 
      success: true,
      message: 'Study restored from backup successfully',
      studyId: study._id,
      bharatPacsId: study.bharatPacsId,
      ohif: study.ohif,
      fileSizeMB: parseFloat(fileSizeMB),
      backupRestoredAt: study.backupRestoredAt
    });

  } catch (err) {
    console.error('❌ [Restore] Error:', err);
    
    // Clean up temp file on error
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.warn(`⚠️ [Restore] Failed to clean up temp file:`, cleanupError);
      }
    }

    return res.status(500).json({ 
      success: false,
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * ✅ EXISTING: Switch OHIF viewer for a study
 */
export const backupSwitch = async (req, res) => {
  try {
    // Extract studyId (supports raw text, JSON { studyId }, or object keys)
    let body = req.body;
    let studyId = null;

    if (typeof body === 'string') studyId = body.trim();
    else if (body && typeof body === 'object') {
      studyId = body.studyId || body.ID || Object.keys(body)[0];
    }

    if (!studyId) return res.status(400).json({ error: 'Missing studyId' });

    // Optional token check
    const token = process.env.BACKUP_SWITCH_TOKEN;
    if (token) {
      const header = req.headers['x-backup-switch-token'];
      if (!header || header !== token) return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestedOhif = (body && body.ohif) || req.query.ohif || 'ohif2';

    // Find study by orthancStudyID, studyInstanceUID, bharatPacsId or _id
    const study = await DicomStudy.findOne({
      $or: [
        { orthancStudyID: studyId },
        { studyInstanceUID: studyId },
        { bharatPacsId: studyId },
        { _id: studyId }
      ]
    });

    if (!study) return res.status(404).json({ error: 'Study not found', studyId });

    const previousOhif = study.ohif;
    if (previousOhif === requestedOhif) {
      return res.json({ message: 'No change needed', studyId: study._id, ohif: study.ohif });
    }

    // Update fields
    study.ohif = requestedOhif;
    study.workflowStatus = 'archived'; // optional — helps queries
    study.modifiedDate = new Date();
    study.statusHistory = study.statusHistory || [];
    study.statusHistory.push({ status: `ohif_switched_to_${requestedOhif}`, changedAt: new Date() });

    await study.save();

    // Record action
    await recordStudyAction({
      studyId: study._id,
      actionType: ACTION_TYPES.STUDY_ARCHIVED,
      actionCategory: 'administrative',
      performedBy: new mongoose.Types.ObjectId('000000000000000000000000'),
      performedByName: 'System:BackupSwitch',
      performedByRole: 'system',
      actionDetails: { previousOhif, newOhif: requestedOhif, orthancStudyId: studyId },
      notes: `OHIF switched from ${previousOhif || 'unset'} -> ${requestedOhif}`
    });

    return res.json({ message: 'OHIF updated', studyId: study._id, bharatPacsId: study.bharatPacsId, ohif: study.ohif });

  } catch (err) {
    console.error('backupSwitch error:', err);
    return res.status(500).json({ error: err.message });
  }
};

export default { backupSwitch, restoreFromBackup };