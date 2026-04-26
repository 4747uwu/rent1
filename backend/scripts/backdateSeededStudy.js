import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = 'mongodb://admin:StrongPass123!@159.89.165.112:27018/orderent?authSource=admin&directConnection=true';
const SOURCE_BP = process.argv[2] || 'BP-MHR-LAB-MO77PJGA-6N9Q';
const TARGET_BHARAT_PACS_ID = process.argv[3] || 'BP-MHR-LAB-MO7LXGHX-SKNH';
const EXPORT_FILE = path.join(process.cwd(), 'scripts', 'exports', `${SOURCE_BP}.json`);

(async () => {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000, directConnection: true });
    console.log(`✅ Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    const bundle = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
    const source = bundle.study;

    // Re-hydrate dates (JSON stringifies them — convert back to Date objects)
    const $set = {
      createdAt: new Date(source.createdAt),
      updatedAt: new Date(source.updatedAt),
      studyDate: new Date(source.studyDate),
      studyTime: source.studyTime,
      accessionNumber: source.accessionNumber,
    };

    const studies = mongoose.connection.db.collection('dicomstudies');
    const before = await studies.findOne(
      { bharatPacsId: TARGET_BHARAT_PACS_ID },
      { projection: { createdAt: 1, studyDate: 1, studyTime: 1, accessionNumber: 1 } }
    );
    if (!before) throw new Error(`Target not found: ${TARGET_BHARAT_PACS_ID}`);

    console.log(`\n🎯 Target: ${before._id}`);
    console.log(`   BEFORE:  createdAt=${before.createdAt?.toISOString()}  studyDate=${before.studyDate?.toISOString()}  time=${before.studyTime}  acc=${before.accessionNumber}`);
    console.log(`   AFTER :  createdAt=${$set.createdAt.toISOString()}  studyDate=${$set.studyDate.toISOString()}  time=${$set.studyTime}  acc=${$set.accessionNumber}`);

    const result = await studies.updateOne({ bharatPacsId: TARGET_BHARAT_PACS_ID }, { $set });
    console.log(`\n✅ UPDATE applied: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

    const after = await studies.findOne(
      { bharatPacsId: TARGET_BHARAT_PACS_ID },
      { projection: { createdAt: 1, studyDate: 1, studyTime: 1 } }
    );
    console.log(`🔍 Verified: createdAt=${after.createdAt?.toISOString()}  studyDate=${after.studyDate?.toISOString()}`);
    console.log(`\n💡 "Today" filter uses createdAt (IST day boundary). 2026-04-20 UTC ≈ Yesterday in IST.`);
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
