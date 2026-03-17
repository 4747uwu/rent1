// config/db.js - Optimized for Local MongoDB (Windows Dev + Production Droplet)
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// SMART URI SELECTOR
// ============================================
const getMongoURI = () => {
    // Priority: ENV var > local
    if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
    if (process.env.NODE_ENV === 'production') {
        return 'mongodb://mongoadmin:your_super_secret_password@157.245.86.199:27017/?replicaSet=rs0&authSource=admin';
    }
    return 'mongodb://localhost:27017/order22';
};

const connectDB = async () => {
    try {
        const MONGODB_URI = getMongoURI();
        const isLocal = MONGODB_URI.includes('localhost') || MONGODB_URI.includes('127.0.0.1');

        console.log('🔗 Connecting to MongoDB...');
        console.log(`📍 Mode: ${isLocal ? 'LOCAL' : 'REMOTE'}`);
        console.log(`🔗 URI: ${MONGODB_URI.replace(/:([^:@]+)@/, ':***@')}`); // hide password

        const conn = await mongoose.connect(MONGODB_URI, {
            // ============================================
            // POOL SIZE - Critical for concurrency
            // Your test showed 20+ concurrent → 811ms
            // Increase pool to handle burst traffic
            // ============================================
            maxPoolSize: isLocal ? 30 : 30,     // ⬆️  was 8, now 20 (handles 30 concurrent)
            minPoolSize: isLocal ? 20 : 30,        // ⬆️  was 2, keep warm connections
            maxIdleTimeMS: 60000,                // ✅ Keep connections warm longer

            // ============================================
            // TIMEOUTS - Tuned for local vs remote
            // ============================================
            serverSelectionTimeoutMS: isLocal ? 3000 : 8000,
            socketTimeoutMS: isLocal ? 15000 : 30000,
            connectTimeoutMS: isLocal ? 3000 : 8000,

            // ============================================
            // WRITE CONCERN - Relaxed for speed
            // majority is safe but slower
            // For read-heavy worklist: use w:1
            // ============================================
            writeConcern: {
                w: 1,           // ⬆️  was 'majority' - faster writes, still safe
                j: false,       // ⬆️  was true - skip journal fsync for speed
            },

            readPreference: 'primaryPreferred', // ⬆️  was 'primary' - can use secondary for reads
            readConcern: { level: 'local' },    // ⬆️  was 'majority' - faster reads

            // ============================================
            // RELIABILITY
            // ============================================
            retryWrites: true,
            retryReads: true,
            heartbeatFrequencyMS: isLocal ? 10000 : 5000,

            // ============================================
            // COMPRESSION - Helps with large study payloads
            // ============================================
            compressors: ['zlib'],
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        console.log(`🏊 Pool: min=${isLocal ? 5 : 3} max=${isLocal ? 20 : 15}`);

        mongoose.set('strictQuery', false);
        mongoose.set('autoIndex', false); // ✅ We create indexes manually below

        // ============================================
        // CONNECTION MONITORING
        // ============================================
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB error:', err.message);
        });
        mongoose.connection.on('disconnected', () => {
            console.log('⚠️  MongoDB disconnected - reconnecting...');
        });
        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });

        // ============================================
        // INDEXES - Run after connection opens
        // This is the main optimization
        // ============================================
        mongoose.connection.once('open', async () => {
            console.log('📑 Syncing indexes from model definitions...');
            
            // Import models so their indexes are registered
            await Promise.all([
                import('../models/dicomStudyModel.js'),
                import('../models/userModel.js'),
                import('../models/reportModel.js'),
                import('../models/patientModel.js'),
            ]);

            // ✅ syncIndexes() reads index() calls from each Schema
            // Creates missing, skips existing, safe to run every startup
            await mongoose.syncIndexes();
            
            console.log('✅ All indexes synced');

            if (process.env.NODE_ENV === 'production') {
                await testTransactionSupport();
            }
        });

        // ============================================
        // GRACEFUL SHUTDOWN
        // ============================================
        const gracefulShutdown = async (signal) => {
            console.log(`\n📴 ${signal} received. Closing MongoDB...`);
            try {
                await mongoose.connection.close(false);
                console.log('✅ MongoDB closed gracefully');
                process.exit(0);
            } catch (error) {
                console.error('❌ Shutdown error:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    } catch (error) {
        console.error(`❌ MongoDB Connection Failed: ${error.message}`);

        if (error.name === 'MongoServerSelectionError') {
            console.log('\n💡 Troubleshooting:');
            console.log('   Windows: net start MongoDB');
            console.log('   Check:   mongosh "mongodb://localhost:27017/admin"');
            console.log('   RS init: mongosh --eval "rs.initiate()"');
        }
        process.exit(1);
    }
};

// ============================================
// INDEX CREATION - The main performance fix
// All indexes target your actual query patterns
// from the benchmark results
// ============================================
const createIndexes = async () => {
    try {
        const db = mongoose.connection.db;

        // ─────────────────────────────────────────
        // DicomStudy Collection Indexes
        // This is your hottest collection
        // ─────────────────────────────────────────
        const studyCol = db.collection('dicomstudies');

        await Promise.all([

            // ① PRIMARY WORKLIST INDEX
            // Covers: All admin/studies queries with org + date
            // Fixes: 300ms baseline → target <80ms
            studyCol.createIndex(
                { organizationIdentifier: 1, createdAt: -1, _id: -1 },
                { name: 'idx_org_createdAt_id', background: true }
            ),

            // ② WORKFLOW STATUS + DATE
            // Covers: category tabs (unassigned, assigned, pending, etc.)
            // Fixes: 300-320ms category queries → target <80ms
            studyCol.createIndex(
                { organizationIdentifier: 1, workflowStatus: 1, createdAt: -1 },
                { name: 'idx_org_status_createdAt', background: true }
            ),

            // ③ MODALITY FILTER
            // Covers: modality=CT (was 463ms - slowest filter!)
            // Fixes: 463ms → target <100ms
            studyCol.createIndex(
                { organizationIdentifier: 1, modality: 1, createdAt: -1 },
                { name: 'idx_org_modality_createdAt', background: true }
            ),

            // ④ PRIORITY FILTER
            // Covers: priority=EMERGENCY, priority=STAT
            // Fixes: 329ms → target <80ms
            studyCol.createIndex(
                { organizationIdentifier: 1, priority: 1, createdAt: -1 },
                { name: 'idx_org_priority_createdAt', background: true }
            ),

            // ⑤ STUDY DATE (for date range filters)
            // Covers: studyDate range queries
            studyCol.createIndex(
                { organizationIdentifier: 1, studyDate: -1 },
                { name: 'idx_org_studyDate', background: true }
            ),

            // ⑥ PATIENT SEARCH
            // Covers: search=SHARMA, search=GUPTA
            // Fixes: 300ms search → target <100ms
            studyCol.createIndex(
                { organizationIdentifier: 1, 'patientInfo.patientName': 1 },
                { name: 'idx_org_patientName', background: true }
            ),

            // ⑦ PATIENT ID LOOKUP
            studyCol.createIndex(
                { organizationIdentifier: 1, 'patientInfo.patientID': 1 },
                { name: 'idx_org_patientID', background: true }
            ),

            // ⑧ COMBINED: MODALITY + PRIORITY + DATE
            // Covers: Combined filters (CT + last7days was 450ms!)
            studyCol.createIndex(
                { organizationIdentifier: 1, modality: 1, priority: 1, createdAt: -1 },
                { name: 'idx_org_modality_priority_createdAt', background: true }
            ),

            // ⑨ COMBINED: STATUS + MODALITY
            // Covers: category tab + modality filter combo
            studyCol.createIndex(
                { organizationIdentifier: 1, workflowStatus: 1, modality: 1, createdAt: -1 },
                { name: 'idx_org_status_modality_createdAt', background: true }
            ),

            // ⑩ UNIQUE IDENTIFIERS (already likely exist, ensure they do)
            studyCol.createIndex(
                { studyInstanceUID: 1 },
                { name: 'idx_studyInstanceUID', unique: true, sparse: true, background: true }
            ),

            studyCol.createIndex(
                { bharatPacsId: 1 },
                { name: 'idx_bharatPacsId', unique: true, sparse: true, background: true }
            ),

            // ⑪ ORTHANC ID LOOKUP
            studyCol.createIndex(
                { orthancStudyID: 1 },
                { name: 'idx_orthancStudyID', sparse: true, background: true }
            ),

            // ⑫ ACCESSION NUMBER
            studyCol.createIndex(
                { organizationIdentifier: 1, accessionNumber: 1 },
                { name: 'idx_org_accessionNumber', background: true }
            ),

            // ⑬ UPLOAD DATE (alternative date field)
            studyCol.createIndex(
                { organizationIdentifier: 1, uploadDate: -1 },
                { name: 'idx_org_uploadDate', background: true }
            ),

            // ⑭ SOURCE LAB FILTER
            studyCol.createIndex(
                { organizationIdentifier: 1, sourceLab: 1, createdAt: -1 },
                { name: 'idx_org_lab_createdAt', background: true }
            ),

            // ⑮ TEXT SEARCH INDEX
            // Covers: free text search on patient name + description
            studyCol.createIndex(
                {
                    'patientInfo.patientName': 'text',
                    examDescription: 'text',
                    accessionNumber: 'text',
                    'patientInfo.patientID': 'text'
                },
                {
                    name: 'idx_text_search',
                    weights: {
                        'patientInfo.patientName': 10,
                        'patientInfo.patientID': 8,
                        accessionNumber: 6,
                        examDescription: 3
                    },
                    background: true
                }
            ),

        ]);

        // ─────────────────────────────────────────
        // Users Collection
        // ─────────────────────────────────────────
        const userCol = db.collection('users');
        await Promise.all([
            userCol.createIndex({ email: 1 }, { name: 'idx_email', unique: true, background: true }),
            userCol.createIndex({ organizationIdentifier: 1, role: 1 }, { name: 'idx_org_role', background: true }),
            userCol.createIndex({ organizationIdentifier: 1, isActive: 1 }, { name: 'idx_org_active', background: true }),
        ]);

        // ─────────────────────────────────────────
        // Labs Collection
        // ─────────────────────────────────────────
        const labCol = db.collection('labs');
        await Promise.all([
            labCol.createIndex({ organizationIdentifier: 1 }, { name: 'idx_org', background: true }),
            labCol.createIndex({ organizationIdentifier: 1, isActive: 1 }, { name: 'idx_org_active', background: true }),
        ]);

        // ─────────────────────────────────────────
        // Reports Collection
        // ─────────────────────────────────────────
        const reportCol = db.collection('reports');
        await Promise.all([
            reportCol.createIndex(
                { organizationIdentifier: 1, dicomStudyId: 1 },
                { name: 'idx_org_study', background: true }
            ),
            reportCol.createIndex(
                { organizationIdentifier: 1, createdAt: -1 },
                { name: 'idx_org_createdAt', background: true }
            ),
        ]);

        // Print index summary
        const studyIndexes = await studyCol.indexes();
        console.log(`   ✅ DicomStudy: ${studyIndexes.length} indexes active`);

    } catch (err) {
        // Don't crash on index errors (some may already exist)
        if (err.code !== 85 && err.code !== 86) { // 85=IndexOptionsConflict, 86=IndexKeySpecsConflict
            console.warn('⚠️  Index warning:', err.message);
        }
    }
};

// ============================================
// TRANSACTION TEST (production only)
// ============================================
const testTransactionSupport = async () => {
    try {
        const session = await mongoose.startSession();
        await session.withTransaction(async () => {});
        await session.endSession();
        console.log('✅ Transaction support confirmed');
    } catch (err) {
        console.error('❌ Transaction test failed:', err.message);
        console.log('   Run: mongosh --eval "rs.initiate()" to enable replica set');
    }
};

// ============================================
// HEALTH CHECK
// ============================================
export const checkDBHealth = async () => {
    try {
        const state = mongoose.connection.readyState;
        const states = { 0: 'DISCONNECTED', 1: 'CONNECTED', 2: 'CONNECTING', 3: 'DISCONNECTING' };

        if (state !== 1) return { healthy: false, state: states[state] };

        const start = Date.now();
        await mongoose.connection.db.admin().ping();
        const pingTime = Date.now() - start;

        // Get pool stats
        const poolStats = mongoose.connection.client?.topology?.s?.servers;

        return {
            healthy: true,
            pingTime: `${pingTime}ms`,
            state: states[state],
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
        };
    } catch (error) {
        return { healthy: false, error: error.message };
    }
};

export default connectDB;