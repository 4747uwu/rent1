/**
 * Run on fresh server to verify all indexes are created correctly
 * node scripts/verifyIndexes.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/order22';

// Import all models so their indexes get registered
import './models/dicomStudyModel.js ';
import './models/userModel.js';
import './models/patientModel.js';
import './models/reportModel.js';
import './models/documentModal.js';
import './models/doctorModel.js';
import './models/organisation.js';

const COLLECTIONS = [
    'dicomstudies',
    'users',
    'patients',
    'reports',
    'documents',
    'doctors',
    'organizations',
];

async function run() {
    console.log('🔗 Connecting...');
    await mongoose.connect(MONGODB_URI, { maxPoolSize: 5 });
    console.log(`✅ Connected: ${mongoose.connection.name}\n`);

    // ── Force create all model indexes ──────────────────────────────────
    console.log('🏗️  Syncing indexes from model definitions...');
    await mongoose.syncIndexes();
    console.log('✅ syncIndexes() complete\n');

    const db = mongoose.connection.db;

    // ── Report all indexes per collection ───────────────────────────────
    console.log('═'.repeat(65));
    console.log('  INDEX REPORT');
    console.log('═'.repeat(65));

    let totalIndexes = 0;

    for (const colName of COLLECTIONS) {
        try {
            const col = db.collection(colName);
            const indexes = await col.indexes();
            totalIndexes += indexes.length;

            console.log(`\n📦 ${colName.toUpperCase()} (${indexes.length} indexes)`);
            indexes.forEach(idx => {
                const keys = Object.entries(idx.key).map(([k, v]) => `${k}:${v}`).join(', ');
                const flags = [
                    idx.unique ? '🔒UNIQUE' : '',
                    idx.sparse ? '◌SPARSE' : '',
                    idx.expireAfterSeconds ? `⏱TTL:${idx.expireAfterSeconds}s` : '',
                ].filter(Boolean).join(' ');
                console.log(`   ├─ ${(idx.name || '_id_').padEnd(45)} { ${keys} } ${flags}`);
            });
        } catch (err) {
            console.log(`   ⚠️  ${colName}: ${err.message}`);
        }
    }

    console.log('\n' + '═'.repeat(65));
    console.log(`  Total indexes across all collections: ${totalIndexes}`);
    console.log('═'.repeat(65));

    // ── Explain a sample query to confirm index hit ──────────────────────
    console.log('\n🔍 EXPLAIN CHECK - Main worklist query:');
    const studyCol = db.collection('dicomstudies');
    const explain = await studyCol
        .find({ organizationIdentifier: 'BTTK', createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } })
        .sort({ createdAt: -1 })
        .limit(50)
        .explain('executionStats');

    const stats = explain.executionStats;
    const winPlan = explain.queryPlanner?.winningPlan;
    const indexUsed = winPlan?.inputStage?.inputStage?.indexName
        || winPlan?.inputStage?.indexName
        || 'check manually';

    console.log(`   Index used:     ${indexUsed}`);
    console.log(`   Docs examined:  ${stats.totalDocsExamined}`);
    console.log(`   Keys examined:  ${stats.totalKeysExamined}`);
    console.log(`   Docs returned:  ${stats.nReturned}`);
    console.log(`   Exec time:      ${stats.executionTimeMillis}ms`);

    const ratio = stats.totalDocsExamined / (stats.nReturned || 1);
    if (ratio > 10) {
        console.log(`   ⚠️  Scan ratio ${ratio.toFixed(1)}x - index may not be optimal`);
    } else {
        console.log(`   ✅ Scan ratio ${ratio.toFixed(1)}x - index working correctly`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Done!\n');
}

run().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
});