import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = 'mongodb://admin:StrongPass123!@159.89.165.112:27018/orderent?authSource=admin&directConnection=true';
const BHARAT_PACS_ID = process.argv[2] || 'BP-MHR-LAB-MO77PJGA-6N9Q';

(async () => {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000, directConnection: true });
    console.log(`✅ Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    const db = mongoose.connection.db;
    const study = await db.collection('dicomstudies').findOne({ bharatPacsId: BHARAT_PACS_ID });
    if (!study) throw new Error(`Study not found: ${BHARAT_PACS_ID}`);

    // Also pull related docs so the export is self-contained
    const [organization, sourceLab, patient, reports, studyNotes, attachments] = await Promise.all([
      study.organization ? db.collection('organizations').findOne({ _id: study.organization }) : null,
      study.sourceLab ? db.collection('labs').findOne({ _id: study.sourceLab }) : null,
      study.patient ? db.collection('patients').findOne({ _id: study.patient }) : null,
      db.collection('reports').find({ studyId: study._id }).toArray().catch(() => []),
      db.collection('studynotes').find({ studyId: study._id }).toArray().catch(() => []),
      db.collection('documents').find({ studyId: study._id }).toArray().catch(() => []),
    ]);

    const bundle = {
      exportedAt: new Date().toISOString(),
      bharatPacsId: BHARAT_PACS_ID,
      study,
      organization,
      sourceLab,
      patient,
      reports,
      studyNotes,
      attachments,
      counts: {
        reports: reports.length,
        studyNotes: studyNotes.length,
        attachments: attachments.length,
      },
    };

    const outDir = path.join(process.cwd(), 'scripts', 'exports');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${BHARAT_PACS_ID}.json`);
    fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2));

    console.log(`💾 Wrote ${outFile}`);
    console.log(`📊 Counts — reports=${reports.length}, notes=${studyNotes.length}, attachments=${attachments.length}`);
    console.log(`🆔 Study _id=${study._id}  org=${organization?.identifier}  lab=${sourceLab?.identifier}  patient=${patient?.patientNameRaw}`);
  } catch (err) {
    console.error('❌', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
