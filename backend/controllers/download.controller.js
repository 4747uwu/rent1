import DicomStudy from '../models/dicomStudyModel.js';
import axios from 'axios';
import jwt from 'jsonwebtoken';

const ORTHANC_BASE_URL = 'http://159.89.165.112:8043';
const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME || 'alice';
const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD || 'alicePassword';
const orthancAuth = 'Basic ' + Buffer.from(ORTHANC_USERNAME + ':' + ORTHANC_PASSWORD).toString('base64');

// ✅ Cloudflare download (already frontend-based)
export const getCloudflareZipUrl = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('preProcessedDownload bharatPacsId orthancStudyID');

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        const ppd = study.preProcessedDownload;

        if (ppd?.zipStatus !== 'completed' && !ppd?.zipKey) {
            return res.status(404).json({
                success: false,
                message: 'ZIP file not available. Please create it first.',
                zipStatus: ppd?.zipStatus || 'not_created'
            });
        }

        let zipUrl = ppd?.zipUrl;
        let zipExpiresAt = ppd?.zipExpiresAt;

        // ✅ Auto-refresh expired presigned URL using stored zipKey.
        // Presigned URLs have a hard 7-day max (from cloudflare-r2.js).
        // The DB's zipExpiresAt may be wrong (old studies stored 90 days).
        // So we check zipCreatedAt as the authoritative source of truth:
        //   if the ZIP was created > 6 days ago, the URL is definitely dead.
        const now = new Date();
        const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
        const createdTooLongAgo = ppd?.zipCreatedAt && (now - new Date(ppd.zipCreatedAt)) > sixDaysMs;
        const isExpired = !zipUrl
            || (zipExpiresAt && new Date(zipExpiresAt) <= now)
            || createdTooLongAgo;

        if (isExpired && ppd?.zipKey) {
            console.log(`🔄 ZIP URL expired for study ${studyId}, regenerating from key: ${ppd.zipKey}`);
            try {
                const { getPresignedUrl } = await import('../config/cloudflare-r2.js');
                zipUrl = await getPresignedUrl(ppd.zipKey);
                zipExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                // Persist refreshed URL + reset creation time so the 6-day
                // check measures from this refresh, not the original upload
                await DicomStudy.updateOne(
                    { _id: studyId },
                    {
                        $set: {
                            'preProcessedDownload.zipUrl': zipUrl,
                            'preProcessedDownload.zipExpiresAt': zipExpiresAt,
                            'preProcessedDownload.zipCreatedAt': new Date(),
                            'preProcessedDownload.zipStatus': 'completed'
                        }
                    }
                );
                console.log(`✅ Refreshed presigned URL for study ${studyId}`);
            } catch (refreshError) {
                console.error(`❌ Failed to refresh URL for study ${studyId}:`, refreshError.message);
                return res.status(410).json({
                    success: false,
                    message: 'ZIP file has expired and could not be refreshed',
                    error: refreshError.message
                });
            }
        }

        if (!zipUrl) {
            return res.status(404).json({
                success: false,
                message: 'ZIP URL not available',
                zipStatus: ppd?.zipStatus || 'unknown'
            });
        }

        await DicomStudy.updateOne(
            { _id: studyId },
            {
                $inc: { 'preProcessedDownload.downloadCount': 1 },
                $set: { 'preProcessedDownload.lastDownloaded': new Date() }
            }
        );

        res.json({
            success: true,
            data: {
                zipUrl,
                zipSizeMB: ppd?.zipSizeMB,
                createdAt: ppd?.zipCreatedAt,
                expiresAt: zipExpiresAt
            }
        });

    } catch (error) {
        console.error('❌ Error getting Cloudflare ZIP URL:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get download URL',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ CHUNKED STREAM: Anonymized study — no buffering, direct pipe
export const downloadAnonymizedStudy = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user; // already set by protect middleware

        console.log(`📥 Anonymized download - Study: ${studyId}`);

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('orthancStudyID bharatPacsId');

        if (!study?.orthancStudyID) {
            return res.status(404).json({ 
                success: false, 
                message: 'Study not found or Orthanc ID missing',
                debug: { studyId, hasOrthancId: !!study?.orthancStudyID }
            });
        }

        console.log(`🔄 Anonymizing study: ${study.orthancStudyID}`);

        // Step 1: Anonymize
        const anonymizeResponse = await axios.post(
            `${ORTHANC_BASE_URL}/studies/${study.orthancStudyID}/anonymize`,
            {
                Replace: { PatientName: 'ANONYMIZED', PatientID: study.bharatPacsId || 'ANON' },
                Keep: ['StudyDescription', 'Modality'],
                KeepPrivateTags: false,
                Force: true,
                Synchronous: false
            },
            { 
                headers: { 'Authorization': orthancAuth, 'Content-Type': 'application/json' }, 
                timeout: 60000 
            }
        );

        const jobId = anonymizeResponse.data.ID;
        console.log(`🔄 Anonymization job started: ${jobId}`);

        // Step 2: Poll job
        let anonymizedStudyId = null;
        for (let i = 0; i < 120; i++) {
            const job = await axios.get(`${ORTHANC_BASE_URL}/jobs/${jobId}`, {
                headers: { 'Authorization': orthancAuth }
            });
            if (job.data.State === 'Success') { 
                anonymizedStudyId = job.data.Content?.ID; 
                console.log(`✅ Anonymization complete: ${anonymizedStudyId}`);
                break; 
            }
            if (job.data.State === 'Failure') throw new Error(`Anonymization failed: ${job.data.ErrorDetails}`);
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!anonymizedStudyId) throw new Error('Anonymization timeout after 2 minutes');

        // Step 3: Stream — with explicit CORS headers
        const archiveResponse = await axios.get(
            `${ORTHANC_BASE_URL}/studies/${anonymizedStudyId}/archive`,
            {
                headers: { 'Authorization': orthancAuth },
                responseType: 'stream',
                timeout: 0
            }
        );

        const filename = `${study.bharatPacsId || study._id}_anonymized.zip`;

        // ✅ CORS headers FIRST — before any data
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');

        if (archiveResponse.headers['content-length']) {
            res.setHeader('Content-Length', archiveResponse.headers['content-length']);
        }

        // ✅ Pipe stream
        archiveResponse.data.pipe(res);

        archiveResponse.data.on('end', async () => {
            console.log(`✅ Stream complete: ${filename}`);
            try {
                await axios.delete(
                    `${ORTHANC_BASE_URL}/studies/${anonymizedStudyId}`,
                    { headers: { 'Authorization': orthancAuth } }
                );
                console.log(`🗑️ Cleaned up: ${anonymizedStudyId}`);
            } catch (e) { 
                console.warn('Cleanup failed:', e.message); 
            }
        });

        archiveResponse.data.on('error', (err) => {
            console.error('❌ Stream error:', err.message);
            if (!res.headersSent) res.status(500).end();
        });

        // ✅ DON'T destroy on req close — let it finish
        // (browser closing the tab shouldn't kill the stream mid-download)

    } catch (error) {
        console.error('❌ Anonymized download error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

// ✅ CHUNKED STREAM: Series download
export const downloadSeries = async (req, res) => {
    try {
        const { studyId, seriesId } = req.params;
        const user = req.user;

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('bharatPacsId');

        if (!study) return res.status(404).json({ success: false, message: 'Study not found' });

        const seriesMeta = await axios.get(`${ORTHANC_BASE_URL}/series/${seriesId}`, {
            headers: { 'Authorization': orthancAuth }, timeout: 10000
        });

        const desc = (seriesMeta.data.MainDicomTags?.SeriesDescription || 'Series').replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${study.bharatPacsId || study._id}_${desc}.zip`;

        // ✅ STREAM directly
        const archiveResponse = await axios.get(
            `${ORTHANC_BASE_URL}/series/${seriesId}/archive`,
            { headers: { 'Authorization': orthancAuth }, responseType: 'stream', timeout: 0 }
        );

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Transfer-Encoding', 'chunked');
        if (archiveResponse.headers['content-length']) {
            res.setHeader('Content-Length', archiveResponse.headers['content-length']);
        }

        archiveResponse.data.pipe(res);

        req.on('close', () => archiveResponse.data.destroy());

    } catch (error) {
        console.error('❌ Series stream error:', error.message);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Failed to stream series' });
    }
};

// ✅ Cleanup anonymized study after download
export const cleanupAnonymizedStudy = async (req, res) => {
    try {
        const { anonymizedStudyId } = req.params;

        await axios.delete(
            `${ORTHANC_BASE_URL}/studies/${anonymizedStudyId}`,
            { headers: { 'Authorization': orthancAuth } }
        );

        console.log(`🗑️ Cleaned up anonymized study: ${anonymizedStudyId}`);

        res.json({
            success: true,
            message: 'Anonymized study cleaned up'
        });

    } catch (error) {
        console.warn('⚠️ Failed to cleanup anonymized study:', error.message);
        res.status(500).json({
            success: false,
            message: 'Cleanup failed (study may already be deleted)'
        });
    }
};

// ✅ Get series list
export const getStudySeries = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('orthancStudyID bharatPacsId patientInfo modality');

        if (!study || !study.orthancStudyID) {
            return res.status(404).json({
                success: false,
                message: 'Study not found or Orthanc ID missing'
            });
        }

        console.log(`📋 Fetching series for study: ${study.orthancStudyID}`);

        const seriesListResponse = await axios.get(
            `${ORTHANC_BASE_URL}/studies/${study.orthancStudyID}`,
            {
                headers: { 'Authorization': orthancAuth },
                timeout: 10000
            }
        );

        const studyData = seriesListResponse.data;
        const seriesIds = studyData.Series || [];

        // Fetch details for each series
        const seriesDetails = await Promise.all(
            seriesIds.map(async (seriesId) => {
                try {
                    const seriesResponse = await axios.get(
                        `${ORTHANC_BASE_URL}/series/${seriesId}`,
                        { headers: { 'Authorization': orthancAuth }, timeout: 5000 }
                    );

                    const seriesData = seriesResponse.data;
                    const description = 
                        seriesData.MainDicomTags?.SeriesDescription || 
                        seriesData.MainDicomTags?.ProtocolName ||
                        `${study.modality} Series ${seriesData.MainDicomTags?.SeriesNumber || 'Unknown'}`;

                    return {
                        ID: seriesId,
                        MainDicomTags: {
                            SeriesDescription: description,
                            Modality: seriesData.MainDicomTags?.Modality || study.modality || 'Unknown',
                            SeriesNumber: seriesData.MainDicomTags?.SeriesNumber || '0',
                            SeriesInstanceUID: seriesData.MainDicomTags?.SeriesInstanceUID || ''
                        },
                        Instances: seriesData.Instances || [],
                        InstanceCount: (seriesData.Instances || []).length,
                        Status: seriesData.Status || 'Unknown',
                        // ✅ Add download URL for frontend
                        downloadUrl: `${ORTHANC_BASE_URL}/series/${seriesId}/archive`,
                        authToken: orthancAuth
                    };
                } catch (err) {
                    console.error(`⚠️ Error fetching series ${seriesId}:`, err.message);
                    return null;
                }
            })
        );

        const validSeries = seriesDetails.filter(s => s !== null);
        console.log(`✅ Found ${validSeries.length} series`);

        res.json({
            success: true,
            data: {
                studyId: study._id,
                bharatPacsId: study.bharatPacsId,
                patientName: study.patientInfo?.patientName || 'Unknown',
                series: validSeries,
                orthancBaseUrl: ORTHANC_BASE_URL,
                authToken: orthancAuth
            }
        });

    } catch (error) {
        console.error('❌ Error getting study series:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get series list',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


export const toggleStudyLock = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { shouldLock } = req.body;
        const user = req.user;

        console.log(`🔐 Lock toggle request - Study: ${studyId}, Lock: ${shouldLock}, User: ${user.email}`);

        if (!['admin', 'assignor'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to lock/unlock studies'
            });
        }

        // ✅ FIX: Use findByIdAndUpdate to avoid validation issues
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('bharatPacsId studyLock currentCategory workflowStatus');

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        console.log(`📋 Current study state - Category: ${study.currentCategory}, Status: ${study.workflowStatus}, Locked: ${study.studyLock?.isLocked}`);

        // ✅ BUILD UPDATE OBJECT (NO VALIDATION)
        const updateData = {};
        const actionLogEntry = {
            actionType: shouldLock ? 'study_locked' : 'study_unlocked',
            actionCategory: 'lock',
            performedBy: user._id,
            performedByName: user.fullName || user.email,
            performedByRole: user.role,
            performedAt: new Date(),
            notes: shouldLock ? 'Study locked by administrator' : 'Study unlocked by administrator'
        };

        if (shouldLock) {
            // ✅ LOCK: Set all lock fields
            updateData['studyLock.isLocked'] = true;
            updateData['studyLock.lockedBy'] = user._id;
            updateData['studyLock.lockedByName'] = user.fullName || user.email;
            updateData['studyLock.lockedByRole'] = user.role;
            updateData['studyLock.lockedAt'] = new Date();
            updateData['studyLock.lockReason'] = 'administrative';
            updateData['studyLock.lockExpiry'] = null;
        } else {
            // ✅ UNLOCK: Archive current lock to history
            if (study.studyLock?.isLocked) {
                const previousLock = {
                    lockedBy: study.studyLock.lockedBy,
                    lockedByName: study.studyLock.lockedByName,
                    lockedAt: study.studyLock.lockedAt,
                    unlockedAt: new Date(),
                    lockDuration: study.studyLock.lockedAt 
                        ? Math.floor((new Date() - new Date(study.studyLock.lockedAt)) / 60000) 
                        : 0,
                    lockReason: study.studyLock.lockReason
                };

                // Add to history
                await DicomStudy.updateOne(
                    { _id: studyId },
                    { $push: { 'studyLock.previousLocks': previousLock } }
                );
            }

            // Clear lock fields
            updateData['studyLock.isLocked'] = false;
            updateData['studyLock.lockedBy'] = null;
            updateData['studyLock.lockedByName'] = null;
            updateData['studyLock.lockedAt'] = null;
            updateData['studyLock.lockReason'] = null;

            // ✅ When admin unlocks, reset status to assigned_to_doctor + PENDING
            updateData['workflowStatus'] = 'assigned_to_doctor';
            updateData['currentCategory'] = 'PENDING';
        }

        // ✅ UPDATE DIRECTLY (BYPASS VALIDATION)
        const updatedStudy = await DicomStudy.findByIdAndUpdate(
            studyId,
            {
                $set: updateData,
                $push: { actionLog: actionLogEntry }
            },
            { 
                new: true,
                runValidators: false, // ✅ CRITICAL: Skip validation
                select: 'bharatPacsId studyLock currentCategory'
            }
        );

        console.log(`✅ Study lock toggled: ${shouldLock ? 'LOCKED' : 'UNLOCKED'} for ${updatedStudy.bharatPacsId}`);
        console.log(`📋 New lock state:`, updatedStudy.studyLock);

        res.json({
            success: true,
            message: shouldLock ? 'Study locked successfully' : 'Study unlocked successfully',
            data: {
                bharatPacsId: updatedStudy.bharatPacsId,
                isLocked: updatedStudy.studyLock.isLocked,
                lockedBy: updatedStudy.studyLock.lockedByName,
                lockedAt: updatedStudy.studyLock.lockedAt,
                currentCategory: updatedStudy.currentCategory
            }
        });

    } catch (error) {
        console.error('❌ Error toggling study lock:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle study lock',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};