import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://admin:StrongPass123!@159.89.165.112:27018/orderent?authSource=admin&directConnection=true';

(async () => {
  try {
    console.log('🔗 Connecting to MongoDB (directConnection=true)...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      directConnection: true,
    });
    console.log(`✅ Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    const studies = mongoose.connection.db.collection('dicomstudies');

    const duplicates = await studies.aggregate([
      { $match: { studyInstanceUID: { $ne: null } } },
      {
        $group: {
          _id: '$studyInstanceUID',
          count: { $sum: 1 },
          docs: {
            $push: {
              _id: '$_id',
              bharatPacsId: '$bharatPacsId',
              org: '$organizationIdentifier',
              orthancStudyID: '$orthancStudyID',
              zipStatus: '$preProcessedDownload.zipStatus',
              createdAt: '$createdAt',
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
    } else {
      console.log(`\n⚠️  Found ${duplicates.length} duplicate StudyInstanceUID group(s):\n`);
      console.log(JSON.stringify(duplicates, null, 2));
      console.log(`\n📊 SUMMARY:`);
      console.log(`   - Duplicate UID groups: ${duplicates.length}`);
      console.log(`   - Total extra docs to resolve: ${duplicates.reduce((s, d) => s + (d.count - 1), 0)}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
