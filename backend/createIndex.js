/**
 * Run this ONCE to create all indexes on existing data
 * node scripts/createIndexes.js
 * 
 * Safe to re-run - createIndex is idempotent
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/order22';

async function run() {
    console.log('🔗 Connecting...');
    await mongoose.connect(MONGODB_URI, { maxPoolSize: 5 });
    console.log('✅ Connected to:', mongoose.connection.name);

    const db = mongoose.connection.db;
    const studyCol = db.collection('dicomstudies');

    console.log('\n📑 Checking existing indexes...');
    const existing = await studyCol.indexes();
    console.log(`   Found ${existing.length} existing indexes:`);
    existing.forEach(idx => console.log(`   - ${idx.name}`));

    console.log('\n🏗️  Creating optimized indexes...');
    const start = Date.now();

    const indexes = [
        { spec: { organizationIdentifier: 1, createdAt: -1, _id: -1 },         name: 'idx_org_createdAt_id' },
        { spec: { organizationIdentifier: 1, workflowStatus: 1, createdAt: -1 }, name: 'idx_org_status_createdAt' },
        { spec: { organizationIdentifier: 1, modality: 1, createdAt: -1 },      name: 'idx_org_modality_createdAt' },
        { spec: { organizationIdentifier: 1, priority: 1, createdAt: -1 },      name: 'idx_org_priority_createdAt' },
        { spec: { organizationIdentifier: 1, studyDate: -1 },                   name: 'idx_org_studyDate' },
        { spec: { organizationIdentifier: 1, 'patientInfo.patientName': 1 },    name: 'idx_org_patientName' },
        { spec: { organizationIdentifier: 1, 'patientInfo.patientID': 1 },      name: 'idx_org_patientID' },
        { spec: { organizationIdentifier: 1, modality: 1, priority: 1, createdAt: -1 }, name: 'idx_org_modality_priority_createdAt' },
        { spec: { organizationIdentifier: 1, workflowStatus: 1, modality: 1, createdAt: -1 }, name: 'idx_org_status_modality_createdAt' },
        { spec: { organizationIdentifier: 1, sourceLab: 1, createdAt: -1 },     name: 'idx_org_lab_createdAt' },
        { spec: { organizationIdentifier: 1, accessionNumber: 1 },              name: 'idx_org_accessionNumber' },
        { spec: { orthancStudyID: 1 },    name: 'idx_orthancStudyID', sparse: true },
        { spec: { bharatPacsId: 1 },      name: 'idx_bharatPacsId', unique: true, sparse: true },
        { spec: { studyInstanceUID: 1 },  name: 'idx_studyInstanceUID', unique: true, sparse: true },
    ];

    let created = 0, skipped = 0, failed = 0;

    for (const idx of indexes) {
        try {
            process.stdout.write(`   Creating ${idx.name}... `);
            const tStart = Date.now();
            await studyCol.createIndex(idx.spec, {
                name: idx.name,
                background: true,
                ...(idx.unique && { unique: true }),
                ...(idx.sparse && { sparse: true }),
            });
            console.log(`✅ ${Date.now() - tStart}ms`);
            created++;
        } catch (err) {
            if (err.code === 85 || err.code === 86 || err.message.includes('already exists')) {
                console.log('⏭️  already exists');
                skipped++;
            } else {
                console.log(`❌ ${err.message}`);
                failed++;
            }
        }
    }

    // Text index separate (MongoDB allows only 1 text index per collection)
    try {
        process.stdout.write('   Creating text search index... ');
        await studyCol.createIndex(
            {
                'patientInfo.patientName': 'text',
                examDescription: 'text',
                accessionNumber: 'text',
                'patientInfo.patientID': 'text',
                referringPhysicianName: 'text'
            },
            {
                name: 'idx_text_search',
                weights: {
                    'patientInfo.patientID': 10,
                    'patientInfo.patientName': 9,
                    accessionNumber: 7,
                    referringPhysicianName: 4,
                    examDescription: 3
                },
                background: true
            }
        );
        console.log('✅');
        created++;
    } catch (err) {
        if (err.code === 85 || err.message.includes('already exists')) {
            console.log('⏭️  already exists');
        } else {
            console.log(`❌ ${err.message}`);
        }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(50));
    console.log('📊 INDEX CREATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed:  ${failed}`);
    console.log(`   ⏱️  Time:    ${elapsed}s`);

    // Show final index list
    const finalIndexes = await studyCol.indexes();
    console.log(`\n   Total indexes on dicomstudies: ${finalIndexes.length}`);
    finalIndexes.forEach(i => console.log(`   - ${i.name}`));

    // Explain a sample query to verify index usage
    console.log('\n🔍 Verifying index usage on sample query...');
    const explain = await studyCol.find(
        { organizationIdentifier: 'BTTK', createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } },
        { projection: { _id: 1 } }
    ).sort({ createdAt: -1 }).limit(50).explain('executionStats');

    const stats = explain.executionStats;
    const winStage = explain.queryPlanner?.winningPlan?.inputStage?.inputStage;
    console.log(`   Index used:        ${winStage?.indexName || explain.queryPlanner?.winningPlan?.inputStage?.indexName || 'check manually'}`);
    console.log(`   Docs examined:     ${stats.totalDocsExamined}`);
    console.log(`   Keys examined:     ${stats.totalKeysExamined}`);
    console.log(`   Execution time:    ${stats.executionTimeMillis}ms`);
    console.log(`   Docs returned:     ${stats.nReturned}`);

    if (stats.totalDocsExamined > stats.nReturned * 10) {
        console.log('   ⚠️  High docs examined ratio - check query patterns');
    } else {
        console.log('   ✅ Index is being used efficiently!');
    }

    await mongoose.disconnect();
    console.log('\n✅ Done! Run testPagination.js again to see improvement.\n');
}

run().catch(err => {
    console.error('❌', err);
    process.exit(1);
});