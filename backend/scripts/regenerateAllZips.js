import mongoose from 'mongoose';
import axios from 'axios';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PassThrough } from 'stream';

// === CONFIG ===
const MONGODB_URI = 'mongodb://admin:StrongPass123!@159.89.165.112:27018/orderent?authSource=admin&directConnection=true';
const ORTHANC_BASE_URL = 'http://159.89.165.112:8043';
const ORTHANC_USERNAME = 'alice';
const ORTHANC_PASSWORD = 'alicePassword';
const DRY_RUN = process.env.DRY_RUN === 'true'; // default false — runs for real. Set DRY_RUN=true for plan only.

const R2 = {
  endpoint: 'https://b39c632fcc14248dfcf837983059a2cd.r2.cloudflarestorage.com',
  accessKeyId: '84a50df7100eea000b6ddd0c2ddce67a',
  secretAccessKey: '1a925bae4d85529b3c8e68460b29d03de672a4d9fbba2a7fd430af0edc4f2a91',
  bucket: 'redivue',
  publicUrlPattern: 'https://pub-6f09f78e289e4cbab0a82e99a603f535.r2.dev',
};

const orthancAuth = 'Basic ' + Buffer.from(`${ORTHANC_USERNAME}:${ORTHANC_PASSWORD}`).toString('base64');
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2.endpoint,
  credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  forcePathStyle: true,
});

async function getPresignedUrl(key, expiresIn = 604800) {
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: R2.bucket, Key: key }), { expiresIn });
}

async function resolveOrthancId(studyInstanceUID) {
  try {
    const res = await axios.post(
      `${ORTHANC_BASE_URL}/tools/find`,
      { Level: 'Study', Query: { StudyInstanceUID: studyInstanceUID } },
      { headers: { Authorization: orthancAuth }, timeout: 15000 }
    );
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}

async function processOne(studies, doc) {
  const startedAt = Date.now();
  const label = `${doc._id} (${doc.bharatPacsId})`;

  // Resolve current Orthanc ID via StudyInstanceUID (handles stale IDs from re-ingestion)
  const liveOrthancId = await resolveOrthancId(doc.studyInstanceUID);
  if (!liveOrthancId) {
    console.log(`   ⚠️  ${label}: SKIP — Orthanc has no study for UID ${doc.studyInstanceUID}`);
    await studies.updateOne(
      { _id: doc._id },
      { $set: { 'preProcessedDownload.zipStatus': 'unavailable', 'preProcessedDownload.zipMetadata.error': 'orthanc-missing' } }
    );
    return { status: 'skipped-missing' };
  }

  if (doc.orthancStudyID !== liveOrthancId) {
    console.log(`   🔄 ${label}: orthancStudyID stale (${doc.orthancStudyID} → ${liveOrthancId}), updating`);
  }

  await studies.updateOne(
    { _id: doc._id },
    {
      $set: {
        orthancStudyID: liveOrthancId,
        'preProcessedDownload.zipStatus': 'processing',
        'preProcessedDownload.zipMetadata.createdBy': 'batch-regen-script',
        'preProcessedDownload.zipMetadata.storageProvider': 'cloudflare-r2',
      },
    }
  );

  // Fetch metadata
  const meta = (await axios.get(`${ORTHANC_BASE_URL}/studies/${liveOrthancId}`, {
    headers: { Authorization: orthancAuth },
    timeout: 30000,
  })).data;

  const patientName = (meta.PatientMainDicomTags?.PatientName || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
  const patientId = (meta.PatientMainDicomTags?.PatientID || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
  const studyDate = meta.MainDicomTags?.StudyDate || '';
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const zipFileName = `Study_${patientName}_${patientId}_${studyDate}_${liveOrthancId}_${timestamp}.zip`;
  const year = new Date().getFullYear();
  const zipKey = `studies/${year}/${zipFileName}`;

  // Stream archive from Orthanc → R2, counting bytes through a PassThrough
  const archiveStream = (await axios.get(`${ORTHANC_BASE_URL}/studies/${liveOrthancId}/archive`, {
    headers: { Authorization: orthancAuth },
    responseType: 'stream',
    timeout: 15 * 60 * 1000,
  })).data;

  let uploadedBytes = 0;
  const counter = new PassThrough();
  counter.on('data', (chunk) => { uploadedBytes += chunk.length; });
  archiveStream.pipe(counter);

  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: R2.bucket,
      Key: zipKey,
      Body: counter,
      ContentType: 'application/zip',
      Metadata: {
        'orthanc-study-id': liveOrthancId,
        'study-instance-uid': doc.studyInstanceUID || '',
        'patient-id': patientId,
        'patient-name': patientName,
        'created-by': 'batch-regen-script',
      },
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
  });
  await upload.done();

  // Verify via HEAD that R2 actually received bytes
  const head = await r2Client.send(new HeadObjectCommand({ Bucket: R2.bucket, Key: zipKey }));
  const actualBytes = Number(head.ContentLength ?? 0);
  if (actualBytes < 1024) {
    throw new Error(`R2 object is empty (${actualBytes} bytes). counter=${uploadedBytes}. Aborting.`);
  }

  const processingTime = Date.now() - startedAt;
  const zipSizeMB = Math.round((actualBytes / 1024 / 1024) * 100) / 100;
  const cdnUrl = await getPresignedUrl(zipKey);
  const publicUrl = `${R2.publicUrlPattern}/${zipKey}`;

  await studies.updateOne(
    { _id: doc._id },
    {
      $set: {
        'preProcessedDownload.zipUrl': cdnUrl,
        'preProcessedDownload.zipPublicUrl': publicUrl,
        'preProcessedDownload.zipFileName': zipFileName,
        'preProcessedDownload.zipSizeMB': zipSizeMB,
        'preProcessedDownload.zipCreatedAt': new Date(),
        'preProcessedDownload.zipStatus': 'completed',
        'preProcessedDownload.zipExpiresAt': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        'preProcessedDownload.zipBucket': R2.bucket,
        'preProcessedDownload.zipKey': zipKey,
        'preProcessedDownload.zipMetadata': {
          orthancStudyId: liveOrthancId,
          instanceCount: meta.Instances?.length || 0,
          seriesCount: meta.Series?.length || 0,
          processingTimeMs: processingTime,
          createdBy: 'batch-regen-script',
          storageProvider: 'cloudflare-r2',
          r2Key: zipKey,
          r2Bucket: R2.bucket,
        },
      },
    }
  );
  console.log(`   ✅ ${label}: ${zipSizeMB}MB in ${(processingTime / 1000).toFixed(1)}s`);
  return { status: 'ok', sizeMB: zipSizeMB, ms: processingTime };
}

(async () => {
  try {
    console.log(`🔗 Connecting (DRY_RUN=${DRY_RUN})...`);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000, directConnection: true });
    console.log(`✅ Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    const studies = mongoose.connection.db.collection('dicomstudies');

    const targets = await studies.find({
      $and: [
        { studyInstanceUID: { $ne: null } },
        { orthancStudyID: { $ne: null } },
        {
          $or: [
            { 'preProcessedDownload.zipStatus': { $in: ['pending', 'failed', 'processing'] } },
            { 'preProcessedDownload.zipStatus': { $exists: false } },
            { 'preProcessedDownload.zipKey': { $exists: false } },
            // also pick up the 0-byte uploads from the previous buggy run
            { 'preProcessedDownload.zipStatus': 'completed', 'preProcessedDownload.zipSizeMB': { $lt: 0.01 } },
          ],
        },
      ],
    }).project({
      _id: 1, bharatPacsId: 1, studyInstanceUID: 1, orthancStudyID: 1,
      'preProcessedDownload.zipStatus': 1, organizationIdentifier: 1,
    }).toArray();

    if (targets.length === 0) {
      console.log('✅ Nothing to regenerate. All ZIPs are complete.');
      return;
    }

    console.log(`\n📋 ${targets.length} studies need ZIP regeneration:\n`);
    for (const t of targets) {
      console.log(`   - ${t._id} ${t.bharatPacsId} (${t.organizationIdentifier}) zip=${t.preProcessedDownload?.zipStatus ?? 'none'}`);
    }

    if (DRY_RUN) {
      console.log('\n🟡 DRY RUN — no changes. Set DRY_RUN=false (default) to execute.');
      return;
    }

    console.log(`\n🚨 Processing sequentially...\n`);
    const results = { ok: 0, skipped: 0, failed: 0 };
    let idx = 0;
    for (const doc of targets) {
      idx++;
      console.log(`[${idx}/${targets.length}] ${doc._id}`);
      try {
        const r = await processOne(studies, doc);
        if (r.status === 'ok') results.ok++;
        else if (r.status?.startsWith('skipped')) results.skipped++;
      } catch (err) {
        console.log(`   ❌ ${doc._id}: FAILED — ${err.message}`);
        results.failed++;
        try {
          await studies.updateOne(
            { _id: doc._id },
            { $set: { 'preProcessedDownload.zipStatus': 'failed', 'preProcessedDownload.zipMetadata.error': err.message } }
          );
        } catch {}
      }
    }

    console.log(`\n📊 DONE.`);
    console.log(`   ✅ Completed: ${results.ok}`);
    console.log(`   ⚠️  Skipped (orthanc-missing): ${results.skipped}`);
    console.log(`   ❌ Failed: ${results.failed}`);
  } catch (err) {
    console.error('❌ Fatal:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
