import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = 'mongodb://admin:StrongPass123!@159.89.165.112:27018/orderent?authSource=admin&directConnection=true';
const SOURCE_BP = process.argv[2] || 'BP-MHR-LAB-MO77PJGA-6N9Q';
const TARGET_BHARAT_PACS_ID = process.argv[3] || 'BP-MHR-LAB-MO7LXGHX-SKNH';
const EXPORT_FILE = path.join(process.cwd(), 'scripts', 'exports', `${SOURCE_BP}.json`);
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default true

/**
 * Fields we COPY FROM the exported source onto the target study.
 * These are the "work / clinical" fields that simulate a real assigned study.
 */
const FIELDS_TO_COPY = [
  'patientInfo',
  'referringPhysicianName',
  'physicians',
  'technologist',
  'clinicalHistory',
  'legacyClinicalHistoryRef',
  'priority',
  'caseType',
  'workflowStatus',
  'currentCategory',
  'categoryTracking',
  'assignment',
  'lastAssignedDoctor',
  'reportInfo',
  'revertInfo',
  'timingInfo',
  'calculatedTAT',
  'statusHistory',
  'actionLog',
  'studyLock',
  'notesCount',
  'ReportAvailable',
  'currentReportStatus',
  'hasStudyNotes',
  'hasAttachments',
  'reprintNeeded',
  'generated',
  'caseType',
  'followUp',
  'billing',
  'searchText',
];

/**
 * Fields we PRESERVE on the target (its own identity / files / org / timestamps).
 * Listed here only for documentation; the merge logic works on the positive list above.
 */
const PRESERVED = [
  '_id', 'bharatPacsId', 'studyInstanceUID', 'orthancStudyID',
  'organization', 'organizationIdentifier', 'sourceLab', 'labLocation',
  'patient', 'patientId',
  'preProcessedDownload', 'storageInfo',
  'seriesCount', 'instanceCount', 'seriesImages', 'modalitiesInStudy',
  'examDescription', 'studyDate', 'studyTime', 'accessionNumber',
  'institutionName', 'bodyPartExamined', 'protocolName', 'equipment',
  'createdAt', 'updatedAt',
];

(async () => {
  try {
    console.log(`🔗 Connecting (DRY_RUN=${DRY_RUN})...`);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000, directConnection: true });
    console.log(`✅ Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    if (!fs.existsSync(EXPORT_FILE)) throw new Error(`Export file not found: ${EXPORT_FILE}`);
    const bundle = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
    const source = bundle.study;
    console.log(`📥 Loaded export: ${bundle.bharatPacsId} (patient=${source.patientInfo?.patientName}, workflow=${source.workflowStatus})`);

    const studies = mongoose.connection.db.collection('dicomstudies');
    const target = await studies.findOne({ bharatPacsId: TARGET_BHARAT_PACS_ID });
    if (!target) throw new Error(`Target study not found: ${TARGET_BHARAT_PACS_ID}`);

    console.log(`🎯 Target: ${target._id}  (${target.bharatPacsId}, ${target.organizationIdentifier})`);
    console.log(`   before:  workflow=${target.workflowStatus}  category=${target.currentCategory}  assignments=${target.assignment?.length ?? 0}`);

    const $set = {};
    const copied = [];
    const skipped = [];
    for (const field of FIELDS_TO_COPY) {
      if (source[field] === undefined) {
        skipped.push(field);
        continue;
      }
      $set[field] = source[field];
      copied.push(field);
    }

    console.log(`\n📋 PLAN for ${TARGET_BHARAT_PACS_ID}:`);
    console.log(`   ✅ Copying ${copied.length} fields: ${copied.join(', ')}`);
    if (skipped.length) console.log(`   ⏭️  Source missing (skipped): ${skipped.join(', ')}`);
    console.log(`   🔒 Preserving identity/files/org/timestamps on target`);

    console.log(`\n   After-merge preview:`);
    console.log(`      workflowStatus:   ${source.workflowStatus}`);
    console.log(`      currentCategory:  ${source.currentCategory}`);
    console.log(`      assignments:      ${source.assignment?.length ?? 0}`);
    console.log(`      statusHistory:    ${source.statusHistory?.length ?? 0} entries`);
    console.log(`      actionLog:        ${source.actionLog?.length ?? 0} entries`);
    console.log(`      clinicalHistory:  ${source.clinicalHistory?.clinicalHistory?.slice(0, 60) ?? '(none)'}`);
    console.log(`      patientInfo:      ${source.patientInfo?.patientName} (${source.patientInfo?.patientID})`);

    if (DRY_RUN) {
      console.log(`\n🟡 DRY RUN — no changes. Re-run with DRY_RUN=false to apply.`);
      return;
    }

    const result = await studies.updateOne({ _id: target._id }, { $set });
    console.log(`\n✅ UPDATE applied: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

    const after = await studies.findOne(
      { _id: target._id },
      { projection: { bharatPacsId: 1, workflowStatus: 1, currentCategory: 1, 'assignment': 1, 'patientInfo.patientName': 1, 'clinicalHistory.clinicalHistory': 1 } }
    );
    console.log(`🔍 Verified:`);
    console.log(`   workflow:        ${after.workflowStatus}`);
    console.log(`   category:        ${after.currentCategory}`);
    console.log(`   assignments:     ${after.assignment?.length ?? 0}`);
    console.log(`   patient:         ${after.patientInfo?.patientName}`);
    console.log(`   clinical:        ${after.clinicalHistory?.clinicalHistory?.slice(0, 60) ?? '(none)'}`);
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
