import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://admin:StrongPass123!@159.89.165.112:27018/orderent?authSource=admin&directConnection=true';
const DRY_RUN = process.env.DRY_RUN !== 'false'; // default true; set DRY_RUN=false to actually delete

/**
 * Rules for picking the survivor in a duplicate group (priority order):
 *   1. Doc with the most "work signals" (assignments, reports, clinical
 *      history, non-initial workflow status). Losing real work is worse
 *      than losing a re-creatable ZIP.
 *   2. Among docs tied on work score: prefer zipStatus === 'completed'.
 *   3. Final tie-breaker: OLDEST doc (more history, more downstream refs).
 */
function workScore(d) {
  let score = 0;
  if (Array.isArray(d.assignment) && d.assignment.length > 0) score += 3;
  if (Array.isArray(d.reports) && d.reports.length > 0) score += 3;
  if (Array.isArray(d.uploadedReports) && d.uploadedReports.length > 0) score += 3;
  if (Array.isArray(d.doctorReports) && d.doctorReports.length > 0) score += 3;
  if (d.reportInfo?.reportedBy || d.reportInfo?.modernReports?.length) score += 3;
  if (d.clinicalHistory?.clinicalHistory) score += 1;
  if (d.workflowStatus && d.workflowStatus !== 'new_study_received') score += 2;
  if (d.currentCategory && !['ALL', 'CREATED'].includes(d.currentCategory)) score += 1;
  return score;
}

function pickSurvivor(docs) {
  return docs.slice().sort((a, b) => {
    const ws = workScore(b) - workScore(a);
    if (ws !== 0) return ws;
    const zipRank = (d) => d.zipStatus === 'completed' ? 0 : 1;
    const zr = zipRank(a) - zipRank(b);
    if (zr !== 0) return zr;
    return new Date(a.createdAt) - new Date(b.createdAt);
  })[0];
}

(async () => {
  try {
    console.log(`🔗 Connecting (DRY_RUN=${DRY_RUN})...`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      directConnection: true,
    });
    console.log(`✅ Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);

    const studies = mongoose.connection.db.collection('dicomstudies');

    const groups = await studies.aggregate([
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
              workflowStatus: '$workflowStatus',
              currentCategory: '$currentCategory',
              assignment: '$assignment',
              reports: '$reports',
              uploadedReports: '$uploadedReports',
              doctorReports: '$doctorReports',
              reportInfo: '$reportInfo',
              clinicalHistory: '$clinicalHistory',
              createdAt: '$createdAt',
            },
          },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    if (groups.length === 0) {
      console.log('✅ No duplicates. Nothing to do.');
      return;
    }

    console.log(`\n📋 PLAN for ${groups.length} duplicate group(s):\n`);

    const plan = [];
    for (const g of groups) {
      const survivor = pickSurvivor(g.docs);
      const losers = g.docs.filter(d => String(d._id) !== String(survivor._id));

      const fmt = (d) => `${d._id}  (${d.bharatPacsId}, ${d.org}, work=${workScore(d)}, zip=${d.zipStatus ?? 'none'}, status=${d.workflowStatus ?? 'none'}, created ${new Date(d.createdAt).toISOString()})`;
      console.log(`UID: ${g._id}`);
      console.log(`   ✅ KEEP    → ${fmt(survivor)}`);
      for (const l of losers) console.log(`   🗑️  DELETE  → ${fmt(l)}`);
      console.log('');

      plan.push({ uid: g._id, survivor, losers });
    }

    console.log(`📊 SUMMARY:`);
    console.log(`   Groups: ${plan.length}`);
    console.log(`   Docs to delete: ${plan.reduce((s, p) => s + p.losers.length, 0)}`);

    if (DRY_RUN) {
      console.log(`\n🟡 DRY RUN — no changes made. Re-run with DRY_RUN=false to execute.`);
      return;
    }

    console.log(`\n🚨 EXECUTING deletes...\n`);
    let totalDeleted = 0;
    for (const { uid, losers } of plan) {
      const ids = losers.map(l => l._id);
      const result = await studies.deleteMany({ _id: { $in: ids } });
      totalDeleted += result.deletedCount;
      console.log(`   ✅ UID ${uid}: deleted ${result.deletedCount}/${ids.length}`);
    }
    console.log(`\n✅ DONE. Deleted ${totalDeleted} duplicate doc(s).`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
