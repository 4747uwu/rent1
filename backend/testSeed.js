import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { faker } from '@faker-js/faker';

dotenv.config();

// ============================================
// CONFIGURATION
// ============================================
const TARGET_ORG_IDENTIFIER = 'BTTK';
const TOTAL_STUDIES = 50000;
const BATCH_SIZE = 500; // Insert in batches

// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://pawrangerskyler_db_user:y7zV2rO5KRfPO5Hs@cluster0.ku1pxkx.mongodb.net/order2?retryWrites=true&w=majority&appName=Cluster0';

const MONGODB_URI = 'mongodb://localhost:27017/order22'

// ============================================
// WORKFLOW STATUSES (from your model)
// ============================================
const WORKFLOW_STATUSES = [
    'new_study_received',
    'pending_assignment',
    'assigned_to_doctor',
    'doctor_opened_report',
    'report_in_progress',
    'report_drafted',
    'report_finalized',
    'verification_pending',
    'report_verified',
    'report_rejected',
    'revert_to_radiologist',
    'report_completed',
    'final_report_downloaded',
    'archived'
];

const MODALITIES = ['CT', 'MR', 'CR', 'US', 'DX', 'PT', 'NM', 'MG', 'XA', 'RF'];

const BODY_PARTS = [
    'CHEST', 'ABDOMEN', 'HEAD', 'BRAIN', 'SPINE', 'KNEE', 'HIP',
    'SHOULDER', 'ANKLE', 'WRIST', 'PELVIS', 'NECK', 'THORAX', 'LUMBAR'
];

const STUDY_DESCRIPTIONS = [
    'CT Chest with contrast',
    'MRI Brain without contrast',
    'X-Ray Chest PA view',
    'USG Abdomen',
    'CT Abdomen Pelvis',
    'MRI Spine Lumbar',
    'CT Head plain',
    'MRI Knee',
    'Mammography bilateral',
    'CT Angiography',
    'PET CT whole body',
    'MRI Brain with contrast',
    'CT KUB',
    'USG Obstetric',
    'HRCT Chest',
];

const CASE_TYPES = ['routine', 'urgent', 'emergency', 'stat'];
const PRIORITIES = ['NORMAL', 'STAT', 'PRIORITY', 'EMERGENCY', 'MLC'];
const GENDERS = ['M', 'F', 'O'];

// ============================================
// HELPERS
// ============================================
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateStudyInstanceUID() {
    return `1.2.276.0.7230010.3.1.2.${Date.now()}.${randomInt(10000, 99999)}.${randomInt(1000, 9999)}`;
}

function generateAccessionNumber(index) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
    return `${dateStr}${String(index).padStart(6, '0')}`;
}

function generatePatientName() {
    const firstNames = ['RAMESH', 'SURESH', 'ANJALI', 'PRIYA', 'AMIT', 'SUNITA', 'RAJESH', 'KAVITA', 'VIJAY', 'MEENA',
                       'ARUN', 'NEHA', 'SANJAY', 'POOJA', 'MAHESH', 'REKHA', 'DEEPAK', 'GEETA', 'RAVI', 'SHANTI'];
    const lastNames = ['SHARMA', 'GUPTA', 'SINGH', 'KUMAR', 'PATEL', 'VERMA', 'MISHRA', 'YADAV', 'JOSHI', 'PANDEY'];
    return `${randomItem(lastNames)}^${randomItem(firstNames)}`;
}

function generatePatientAge() {
    const age = randomInt(1, 90);
    return `${String(age).padStart(3, '0')}Y`;
}

function generateDate(daysBack = 365) {
    const date = new Date();
    date.setDate(date.getDate() - randomInt(0, daysBack));
    return date;
}

function generateDicomDate(date) {
    return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
}

function generateBharatPacsId(index) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const idx = String(index).padStart(6, '0');
    return `BP-${TARGET_ORG_IDENTIFIER}-LAB-${timestamp}-${idx}`;
}

// ============================================
// MAIN SEED FUNCTION
// ============================================
async function seedStudies() {
    console.log('🚀 Starting DICOM Study Seeding...');
    console.log(`📊 Target: ${TOTAL_STUDIES.toLocaleString()} studies`);
    console.log(`🏢 Organization: ${TARGET_ORG_IDENTIFIER}`);
    console.log(`📦 Batch Size: ${BATCH_SIZE}`);
    console.log('');

    try {
        // Connect to MongoDB
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10000,
        });
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        // ============================================
        // STEP 1: Find/Create Organization
        // ============================================
        console.log(`🔍 Looking for organization: ${TARGET_ORG_IDENTIFIER}`);
        const orgCollection = db.collection('organizations');
        let org = await orgCollection.findOne({ identifier: TARGET_ORG_IDENTIFIER });

        if (!org) {
            console.log(`❌ Organization ${TARGET_ORG_IDENTIFIER} not found!`);
            console.log('Creating a test organization...');
            const result = await orgCollection.insertOne({
                name: 'BTTK Radiology Center',
                identifier: TARGET_ORG_IDENTIFIER,
                displayName: 'BTTK Radiology',
                status: 'active',
                isActive: true,
                contactEmail: 'admin@bttk.com',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            org = { _id: result.insertedId, identifier: TARGET_ORG_IDENTIFIER };
        }
        console.log(`✅ Organization found: ${org._id}\n`);

        // ============================================
        // STEP 2: Find/Create Labs
        // ============================================
        console.log('🏥 Setting up labs...');
        const labCollection = db.collection('labs');
        let labs = await labCollection.find({ organization: org._id }).limit(5).toArray();

        if (labs.length === 0) {
            console.log('Creating test labs...');
            const labDocs = [
                { name: 'BTTK Main Center', identifier: 'BTTKM', organization: org._id, organizationIdentifier: TARGET_ORG_IDENTIFIER, isActive: true, createdAt: new Date() },
                { name: 'BTTK Branch 1', identifier: 'BTTKB1', organization: org._id, organizationIdentifier: TARGET_ORG_IDENTIFIER, isActive: true, createdAt: new Date() },
                { name: 'BTTK Branch 2', identifier: 'BTTKB2', organization: org._id, organizationIdentifier: TARGET_ORG_IDENTIFIER, isActive: true, createdAt: new Date() },
            ];
            const labResult = await labCollection.insertMany(labDocs);
            labs = labDocs.map((l, i) => ({ ...l, _id: Object.values(labResult.insertedIds)[i] }));
        }
        console.log(`✅ Labs ready: ${labs.length} labs\n`);

        // ============================================
        // STEP 3: Find/Create Patients pool  
        // ============================================
        console.log('👥 Creating patient pool...');
        const patientCollection = db.collection('patients');

        const PATIENT_POOL_SIZE = 5000;
        const existingPatients = await patientCollection.find({ organizationIdentifier: TARGET_ORG_IDENTIFIER }).limit(PATIENT_POOL_SIZE).toArray();

        let patients = existingPatients;

        if (patients.length < 1000) {
            console.log(`Creating ${PATIENT_POOL_SIZE} patients...`);
            const patientDocs = [];
            for (let i = 0; i < PATIENT_POOL_SIZE; i++) {
                const gender = randomItem(GENDERS);
                const patientName = generatePatientName();
                const dob = new Date(Date.now() - randomInt(365 * 5, 365 * 85) * 24 * 60 * 60 * 1000);
                patientDocs.push({
                    organization: org._id,
                    organizationIdentifier: TARGET_ORG_IDENTIFIER,
                    patientID: `BTTK${String(i + 1).padStart(7, '0')}`,
                    patientNameRaw: patientName,
                    firstName: patientName.split('^')[1] || patientName,
                    lastName: patientName.split('^')[0] || '',
                    gender,
                    dateOfBirth: dob,
                    age: generatePatientAge(),
                    contactNumber: `98${randomInt(10000000, 99999999)}`,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            
            // Batch insert patients
            const patientBatches = [];
            for (let i = 0; i < patientDocs.length; i += 1000) {
                patientBatches.push(patientDocs.slice(i, i + 1000));
            }
            
            for (const batch of patientBatches) {
                const result = await patientCollection.insertMany(batch, { ordered: false });
                process.stdout.write('.');
            }
            console.log('');
            patients = await patientCollection.find({ organizationIdentifier: TARGET_ORG_IDENTIFIER }).limit(PATIENT_POOL_SIZE).toArray();
        }
        console.log(`✅ Patient pool ready: ${patients.length} patients\n`);

        // ============================================
        // STEP 4: Find Admin User
        // ============================================
        const userCollection = db.collection('users');
        const adminUser = await userCollection.findOne({ 
            organizationIdentifier: TARGET_ORG_IDENTIFIER, 
            role: { $in: ['admin', 'super_admin'] } 
        });
        
        const adminUserId = adminUser?._id || new mongoose.Types.ObjectId();
        console.log(`👤 Admin user: ${adminUser ? adminUser.email : 'Not found (using dummy ID)'}\n`);

        // ============================================
        // STEP 5: Check existing studies
        // ============================================
        const studyCollection = db.collection('dicomstudies');
        const existingCount = await studyCollection.countDocuments({ organizationIdentifier: TARGET_ORG_IDENTIFIER });
        console.log(`📊 Existing studies for ${TARGET_ORG_IDENTIFIER}: ${existingCount.toLocaleString()}`);
        
        const studiesToCreate = TOTAL_STUDIES - existingCount;
        if (studiesToCreate <= 0) {
            console.log(`✅ Already have ${existingCount} studies. Nothing to do.`);
            process.exit(0);
        }
        console.log(`📝 Need to create: ${studiesToCreate.toLocaleString()} studies\n`);

        // ============================================
        // STEP 6: Create Studies in Batches
        // ============================================
        console.log('🏗️  Creating studies...\n');
        
        const startTime = Date.now();
        let totalInserted = 0;
        const batches = Math.ceil(studiesToCreate / BATCH_SIZE);

        for (let batchNum = 0; batchNum < batches; batchNum++) {
            const batchStart = batchNum * BATCH_SIZE;
            const batchEnd = Math.min(batchStart + BATCH_SIZE, studiesToCreate);
            const batchCount = batchEnd - batchStart;

            const studyDocs = [];

            for (let i = 0; i < batchCount; i++) {
                const globalIdx = existingCount + batchStart + i;
                const patient = patients[randomInt(0, patients.length - 1)];
                const lab = labs[randomInt(0, labs.length - 1)];
                const studyDate = generateDate(730); // up to 2 years back
                const createdAt = generateDate(365);
                const modality = randomItem(MODALITIES);
                const workflowStatus = randomItem(WORKFLOW_STATUSES);
                const priority = randomItem(PRIORITIES);

                const studyDoc = {
                    // Organization
                    organization: org._id,
                    organizationIdentifier: TARGET_ORG_IDENTIFIER,

                    // Identifiers
                    bharatPacsId: generateBharatPacsId(globalIdx),
                    studyInstanceUID: generateStudyInstanceUID(),
                    orthancStudyID: `orthanc_${faker.string.uuid()}`,
                    accessionNumber: generateAccessionNumber(globalIdx),

                    // Patient refs
                    patient: patient._id,
                    patientId: patient.patientID,
                    patientInfo: {
                        patientID: patient.patientID,
                        patientName: patient.patientNameRaw,
                        age: patient.age,
                        gender: patient.gender,
                        dateOfBirth: patient.dateOfBirth
                    },

                    // Lab
                    sourceLab: lab._id,
                    labLocation: `${lab.name}, Delhi, India`,

                    // Study details
                    studyDate: studyDate,
                    studyTime: `${randomInt(8, 20).toString().padStart(2,'0')}${randomInt(0,59).toString().padStart(2,'0')}00.000000`,
                    examDescription: randomItem(STUDY_DESCRIPTIONS),
                    modalitiesInStudy: [modality],
                    modality: modality,
                    bodyPartExamined: randomItem(BODY_PARTS),
                    institutionName: lab.name,
                    seriesCount: randomInt(1, 20),
                    instanceCount: randomInt(20, 600),
                    seriesImages: `${randomInt(1, 20)}/${randomInt(20, 600)}`,

                    // Physicians
                    referringPhysicianName: `DR ${faker.person.lastName().toUpperCase()}`,
                    physicians: {
                        referring: { name: `DR ${faker.person.lastName().toUpperCase()}`, email: '', mobile: '' },
                        requesting: { name: '', email: '', mobile: '' }
                    },

                    // Workflow
                    workflowStatus: workflowStatus,
                    caseType: randomItem(CASE_TYPES),
                    priority: priority,

                    // Assignment (for some statuses)
                    assignment: workflowStatus.includes('assigned') || workflowStatus.includes('report') ? [{
                        assignedTo: adminUserId,
                        assignedBy: adminUserId,
                        assignedAt: new Date(createdAt.getTime() + randomInt(1, 48) * 3600000),
                        status: 'active',
                        priority: priority,
                        notes: ''
                    }] : [],

                    // Status history
                    statusHistory: [{
                        status: 'new_study_received',
                        changedAt: createdAt,
                        note: 'Study received via DICOM ingestion'
                    }, ...(workflowStatus !== 'new_study_received' ? [{
                        status: workflowStatus,
                        changedAt: new Date(createdAt.getTime() + randomInt(1, 24) * 3600000),
                        note: 'Status updated'
                    }] : [])],

                    // Storage info
                    storageInfo: {
                        type: 'orthanc',
                        orthancStudyId: `orthanc_${faker.string.uuid()}`,
                        studyInstanceUID: generateStudyInstanceUID(),
                        receivedAt: createdAt,
                        isStableStudy: true,
                        instancesFound: randomInt(20, 600)
                    },

                    // Pre-processed download (for some studies)
                    preProcessedDownload: randomInt(0, 3) > 1 ? {
                        zipStatus: 'completed',
                        zipUrl: `https://pub-xxx.r2.dev/studies/2026/study_${globalIdx}.zip`,
                        zipSize: randomInt(10, 500),
                        createdAt: createdAt,
                        downloadCount: randomInt(0, 5)
                    } : { zipStatus: 'pending' },

                    // Report info
                    reportInfo: {
                        hasReport: ['report_finalized', 'report_verified', 'report_completed', 'final_report_downloaded'].includes(workflowStatus),
                        verificationInfo: {
                            verificationStatus: 'pending'
                        }
                    },

                    // Timestamps
                    createdAt: createdAt,
                    updatedAt: new Date(createdAt.getTime() + randomInt(0, 72) * 3600000),
                    uploadDate: createdAt,
                };

                studyDocs.push(studyDoc);
            }

            // Insert batch
            try {
                await studyCollection.insertMany(studyDocs, { ordered: false });
                totalInserted += batchCount;
            } catch (err) {
                if (err.code === 11000) {
                    // Duplicate key - count actual inserts
                    totalInserted += err.result?.nInserted || batchCount;
                } else {
                    throw err;
                }
            }

            // Progress report every 10 batches
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = totalInserted / elapsed;
            const remaining = (studiesToCreate - totalInserted) / rate;
            
            if (batchNum % 10 === 0 || batchNum === batches - 1) {
                const progress = ((totalInserted / studiesToCreate) * 100).toFixed(1);
                console.log(
                    `📦 Batch ${batchNum + 1}/${batches} | ` +
                    `Inserted: ${totalInserted.toLocaleString()}/${studiesToCreate.toLocaleString()} (${progress}%) | ` +
                    `Rate: ${rate.toFixed(0)}/s | ` +
                    `ETA: ${remaining.toFixed(0)}s`
                );
            }
        }

        // ============================================
        // STEP 7: Create Indexes
        // ============================================
        console.log('\n📑 Creating/verifying indexes...');
        await studyCollection.createIndex({ organizationIdentifier: 1, createdAt: -1 });
        await studyCollection.createIndex({ organizationIdentifier: 1, workflowStatus: 1, createdAt: -1 });
        await studyCollection.createIndex({ organizationIdentifier: 1, studyDate: -1 });
        await studyCollection.createIndex({ organizationIdentifier: 1, 'patientInfo.patientID': 1 });
        await studyCollection.createIndex({ organizationIdentifier: 1, modality: 1, createdAt: -1 });
        await studyCollection.createIndex({ organizationIdentifier: 1, priority: 1, createdAt: -1 });
        await studyCollection.createIndex({ studyInstanceUID: 1 }, { unique: true, sparse: true });
        await studyCollection.createIndex({ bharatPacsId: 1 }, { unique: true, sparse: true });
        console.log('✅ Indexes created');

        // ============================================
        // FINAL SUMMARY
        // ============================================
        const finalCount = await studyCollection.countDocuments({ organizationIdentifier: TARGET_ORG_IDENTIFIER });
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(60));
        console.log('✅ SEEDING COMPLETE!');
        console.log('='.repeat(60));
        console.log(`📊 Total studies in ${TARGET_ORG_IDENTIFIER}: ${finalCount.toLocaleString()}`);
        console.log(`⏱️  Total time: ${totalTime}s`);
        console.log(`🚀 Average rate: ${(totalInserted / totalTime).toFixed(0)} studies/sec`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

seedStudies();