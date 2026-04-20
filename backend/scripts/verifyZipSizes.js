import mongoose from 'mongoose';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const MONGODB_URI = 'mongodb://admin:StrongPass123!@159.89.165.112:27018/orderent?authSource=admin&directConnection=true';
const R2 = {
  endpoint: 'https://b39c632fcc14248dfcf837983059a2cd.r2.cloudflarestorage.com',
  accessKeyId: '84a50df7100eea000b6ddd0c2ddce67a',
  secretAccessKey: '1a925bae4d85529b3c8e68460b29d03de672a4d9fbba2a7fd430af0edc4f2a91',
  bucket: 'redivue',
};
const r2 = new S3Client({ region: 'auto', endpoint: R2.endpoint, credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey }, forcePathStyle: true });

(async () => {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000, directConnection: true });
  const studies = mongoose.connection.db.collection('dicomstudies');
  const docs = await studies.find({
    'preProcessedDownload.zipMetadata.createdBy': 'batch-regen-script',
  }).project({ _id: 1, bharatPacsId: 1, 'preProcessedDownload.zipKey': 1, 'preProcessedDownload.zipSizeMB': 1 }).toArray();

  console.log(`Checking ${docs.length} regenerated objects on R2...\n`);
  let emptyCount = 0, okCount = 0;
  for (const d of docs) {
    const key = d.preProcessedDownload?.zipKey;
    if (!key) { console.log(`  ❓ ${d._id}: no zipKey`); continue; }
    try {
      const head = await r2.send(new HeadObjectCommand({ Bucket: R2.bucket, Key: key }));
      const mb = (head.ContentLength / 1024 / 1024).toFixed(2);
      const isEmpty = head.ContentLength < 1024;
      console.log(`  ${isEmpty ? '❌' : '✅'} ${d.bharatPacsId}: ${mb}MB (db=${d.preProcessedDownload?.zipSizeMB}MB)`);
      if (isEmpty) emptyCount++; else okCount++;
    } catch (e) {
      console.log(`  ⚠️  ${d.bharatPacsId}: ${e.message}`);
    }
  }
  console.log(`\nSummary: ✅ ${okCount} real | ❌ ${emptyCount} empty/tiny`);
  await mongoose.disconnect();
  process.exit(0);
})();
