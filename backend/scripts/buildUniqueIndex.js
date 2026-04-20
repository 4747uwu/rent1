import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://admin:StrongPass123!@159.89.165.112:27018/orderent?authSource=admin&directConnection=true';

(async () => {
  try {
    console.log('🔗 Connecting...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      directConnection: true,
    });
    console.log(`✅ Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    const studies = mongoose.connection.db.collection('dicomstudies');

    const existing = await studies.indexes();
    const old = existing.find(i => i.name === 'idx_studyInstanceUID');

    if (old) {
      console.log(`🗑️  Dropping existing index "idx_studyInstanceUID" (unique=${!!old.unique})...`);
      await studies.dropIndex('idx_studyInstanceUID');
      console.log('   ✅ dropped');
    } else {
      console.log('ℹ️  No existing idx_studyInstanceUID to drop.');
    }

    console.log('🔨 Creating unique index idx_studyInstanceUID...');
    await studies.createIndex(
      { studyInstanceUID: 1 },
      { name: 'idx_studyInstanceUID', unique: true, sparse: true, background: true }
    );
    console.log('✅ Unique index created successfully.');

    const after = await studies.indexes();
    const built = after.find(i => i.name === 'idx_studyInstanceUID');
    console.log('🔍 Final index state:', JSON.stringify(built, null, 2));
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.code === 11000 || /duplicate key/i.test(err.message)) {
      console.error('⚠️  Duplicates still exist — re-run dedupeStudies.js first.');
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
