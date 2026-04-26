import axios from 'axios';
import DicomStudy from '../models/dicomStudyModel.js';
import Report from '../models/reportModel.js';
import User from '../models/userModel.js';
import Doctor from '../models/doctorModel.js';
import Lab from '../models/labModel.js';
import https from 'https';
import mongoose from 'mongoose';
import { updateWorkflowStatus } from '../utils/workflowStatusManager.js';

const DOCX_SERVICE_URL = 'http://159.89.165.112:8081/api/Document/generate';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ============================================================
// ✅ SHARED HELPER: Build payload for C# service from a report
// ============================================================
const buildDocxPayload = async (report, outputFormat = 'pdf') => {
    const htmlContent = report.reportContent?.htmlContent;
    if (!htmlContent) throw new Error('No HTML content in report');

    const capturedImages = report.reportContent?.capturedImages || [];
    const imageCount = capturedImages.length;

    // Lab branding
    const labBranding = report.dicomStudy?.sourceLab?.reportBranding || null;

    // ✅ DETERMINE TEMPLATE NAME based on header/footer availability
    let hasHeaderFooter = false;
    if (labBranding) {
        const hasHeader = labBranding.showHeader !== false && labBranding.headerImage?.url;
        const hasFooter = labBranding.showFooter !== false && labBranding.footerImage?.url;
        hasHeaderFooter = hasHeader || hasFooter;
    }

    let templateName = 'MyReport.docx';

    if (!hasHeaderFooter) {
        templateName = 'MyReportNoHeader.docx';
        if (imageCount > 0 && imageCount <= 5) {
            templateName = `MyReportNoHeader${imageCount}.docx`;
        } else if (imageCount > 5) {
            templateName = 'MyReportNoHeader5.docx';
        }
        console.log(`📄 Using NoHeader template (no branding): ${templateName}`);
    } else {
        if (imageCount > 0 && imageCount <= 5) {
            templateName = `MyReport${imageCount}.docx`;
        } else if (imageCount > 5) {
            templateName = 'MyReport5.docx';
        }
        console.log(`📄 Using standard template (with branding): ${templateName}`);
    }

    // Doctor data
    let doctorData = null;
    if (report.doctorId) {
        try {
            const doctorUser = await User.findById(report.doctorId);
            const doctorProfile = await Doctor.findOne({ userAccount: report.doctorId });
            if (doctorUser && doctorProfile) {
                doctorData = {
                    fullName: doctorUser.fullName,
                    department: doctorProfile.department || 'Radiology',
                    licenseNumber: doctorProfile.licenseNumber || 'N/A',
                    signature: doctorProfile.signature || '',
                    disclaimer: 'Disclaimer:  The science of radiology is based upon interpretation of shadows of normal and abnormal tissue. This is neither complete nor accurate; hence, findings should always be interpreted in to the light of clinico-pathological correlation. This is a professional opinion, not a diagnosis. Not meant for medico legal purposes.'
                };
            }
        } catch (e) { console.warn('⚠️ Failed to fetch doctor data'); }
    }

    const patientIdValue = (
        report.dicomStudy?.patientInfo?.patientID ||
        report.dicomStudy?.patientId ||
        report.patient?.patientID ||
        report.patientInfo?.patientId ||
        ''
    );

    const reportTimestamp =
        report.verificationInfo?.verifiedAt ||
        report.workflowInfo?.verifiedAt ||
        report.workflowInfo?.finalizedAt ||
        report.dicomStudy?.reportInfo?.verificationInfo?.verifiedAt ||
        report.dicomStudy?.reportInfo?.finalizedAt ||
        report.updatedAt ||
        report.createdAt;

    const placeholders = {
        '--name--': report.patientInfo?.fullName || report.patient?.fullName || '[Patient Name]',
        '--patientid--': patientIdValue || '[Patient ID]',
        '--accessionno--': report.accessionNumber || report.dicomStudy?.accessionNumber || '[Accession Number]',
        '--agegender--': `${report.patientInfo?.age || report.patient?.age || '[Age]'} / ${report.patientInfo?.gender || report.patient?.gender || '[Gender]'}`,
        '--referredby--': report.studyInfo?.referringPhysician?.name || report.dicomStudy?.referringPhysician || '[Referring Physician]',
        '--reporteddate--': reportTimestamp
            ? new Date(reportTimestamp).toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })
            : new Date().toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }),
        '--studydate--': reportTimestamp
            ? new Date(reportTimestamp).toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            })
            : '[Study Date]',
        '--modality--': report.studyInfo?.modality || report.dicomStudy?.modality || '[Modality]',
        '--clinicalhistory--': report.patientInfo?.clinicalHistory || '[Clinical History]',
        '--Content--': htmlContent
    };

    if (doctorData) {
        placeholders['--drname--'] = '';
        placeholders['--department--'] =
            `<div style="font-weight:700;font-size:9pt;line-height:1;margin:0;padding:0;mso-line-height-rule:exactly;">
    <span style="display:block;margin:0;padding:0;">${doctorData.fullName}</span><br/>
    <span style="display:block;margin:0;padding:0;">${doctorData.department}</span><br/>
        <span style="display:block;margin:0 0 6px 0;padding:0;">${doctorData.licenseNumber}</span><br/>
        <span style="display:block;margin:2px 0 0 0;padding:0;">${doctorData.disclaimer}</span><br/>
  </div>`.replace(/\n\s*/g, '');
        placeholders['--Licence--'] = '';
        placeholders['--disc--'] = '';
    }

    const images = {};

    if (labBranding && hasHeaderFooter) {
        if (labBranding.showHeader !== false && labBranding.headerImage?.url) {
            images['HeaderPlaceholder'] = {
                data: labBranding.headerImage.url.replace(/^data:image\/\w+;base64,/, ''),
                width: labBranding.headerImage.width,
                height: labBranding.headerImage.height
            };
        }
        if (labBranding.showFooter !== false && labBranding.footerImage?.url) {
            images['FooterPlaceholder'] = {
                data: labBranding.footerImage.url.replace(/^data:image\/\w+;base64,/, ''),
                width: labBranding.footerImage.width,
                height: labBranding.footerImage.height
            };
        }
    }

    if (doctorData?.signature) {
        images['Picture 6'] = {
            data: doctorData.signature.replace(/^data:image\/\w+;base64,/, ''),
            width: null, height: null
        };
    }

    capturedImages.forEach((img, index) => {
        images[`Picture ${index + 1}`] = {
            data: img.imageData.replace(/^data:image\/\w+;base64,/, ''),
            width: null, height: null
        };
    });

    console.log(`🎨 [Template Selection] Lab: ${report.dicomStudy?.sourceLab?.name || 'Unknown'}, HasBranding: ${hasHeaderFooter}, ImageCount: ${imageCount}, Template: ${templateName}`);

    return {
        templateName,
        placeholders,
        images,
        studyId: report.dicomStudy?._id?.toString() || '',
        outputFormat
    };
};

// ============================================================
// ✅ SHARED HELPER: Fetch all finalized reports for a study
// ============================================================
const fetchReportsForStudy = async (studyId) => {
    return await Report.find({
        dicomStudy: studyId,
        reportStatus: { $in: ['finalized', 'verified', 'approved'] }
    })
        .populate('patient', 'fullName patientId patientID age gender')
        .populate({
            path: 'dicomStudy',
            select: 'accessionNumber modality studyDate referringPhysician patientInfo patientId sourceLab _id',
            populate: { path: 'sourceLab', model: 'Lab' }
        })
        .populate('doctorId', 'fullName email')
        .sort({ createdAt: -1 });
};

const canDownloadReport = (report) => {
    const allowedReportStatuses = ['verified', 'approved'];
    const allowedFinalizedStudyStatuses = [
        'report_completed',
        'report_reprint_needed',
        'final_report_downloaded',
        'archived'
    ];

    return (
        allowedReportStatuses.includes(report.reportStatus) ||
        (report.reportStatus === 'finalized' &&
            allowedFinalizedStudyStatuses.includes(report.dicomStudy?.workflowStatus))
    );
};

// ============================================================
// ✅ SHARED HELPER: Check doctor signature
// ============================================================
const checkDoctorSignature = async (report, res) => {
    if (!report.doctorId) {
        res.status(403).json({ success: false, message: 'No doctor assigned to this report.' });
        return false;
    }
    const doctorProfile = await Doctor.findOne({ userAccount: report.doctorId._id });
    if (!doctorProfile?.signature) {
        res.status(403).json({
            success: false,
            message: 'Doctor signature is missing. Report cannot be downloaded until the doctor adds a signature.'
        });
        return false;
    }
    return true;
};

class ReportDownloadController {

    // ============================================================
    // ✅ Get all report IDs for a study
    // ============================================================
    static async getStudyReportIds(req, res) {
        try {
            const { studyId } = req.params;

            if (!mongoose.Types.ObjectId.isValid(studyId)) {
                return res.status(400).json({ success: false, message: 'Invalid studyId' });
            }

            const reports = await fetchReportsForStudy(studyId);

            if (!reports.length) {
                return res.status(404).json({ success: false, message: 'No finalized reports found for this study' });
            }

            console.log(`📋 [GetReportIds] Found ${reports.length} report(s) for study ${studyId}`);

            res.status(200).json({
                success: true,
                data: {
                    studyId,
                    totalReports: reports.length,
                    reports: reports.map((r, i) => ({
                        reportId: r._id,
                        reportNumber: i + 1,
                        reportStatus: r.reportStatus,
                        doctorName: r.doctorId?.fullName || 'Unknown',
                        createdAt: r.createdAt
                    }))
                }
            });
        } catch (error) {
            console.error('❌ [GetReportIds] Error:', error.message);
            res.status(500).json({ success: false, message: 'Failed to fetch report IDs', error: error.message });
        }
    }

    // ============================================================
    // ✅ Download single report as PDF
    // ============================================================
    static async downloadReportAsPDF(req, res) {
        console.log('📥 [Download PDF] Starting...');
        try {
            const { reportId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(reportId)) {
                return res.status(400).json({ success: false, message: 'Invalid reportId' });
            }

            const report = await Report.findById(reportId)
                .populate('patient', 'fullName patientId patientID age gender')
                .populate({
                    path: 'dicomStudy',
                    select: 'accessionNumber modality studyDate referringPhysician patientInfo patientId sourceLab _id bharatPacsId workflowStatus reportInfo.finalizedAt reportInfo.verificationInfo.verifiedAt',
                    populate: { path: 'sourceLab', model: 'Lab' }
                })
                .populate('doctorId', 'fullName email');

            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }

            if (!canDownloadReport(report)) {
                return res.status(403).json({
                    success: false,
                    message: `Report is not downloadable yet. reportStatus='${report.reportStatus}', studyWorkflowStatus='${report.dicomStudy?.workflowStatus || 'unknown'}'.`
                });
            }

            // ✅ Block if doctor signature is missing
            const signatureValid = await checkDoctorSignature(report, res);
            if (!signatureValid) return;

            const payload = await buildDocxPayload(report, 'pdf');
            const pdfResponse = await axios.post(DOCX_SERVICE_URL, payload, {
                responseType: 'arraybuffer', timeout: 60000, httpsAgent
            });

            // ✅ Update Report model download history
            if (!report.downloadInfo) report.downloadInfo = { downloadHistory: [], totalDownloads: 0 };
            report.downloadInfo.totalDownloads += 1;
            report.downloadInfo.lastDownloaded = new Date();
            report.downloadInfo.downloadHistory.push({
                downloadedBy: req.user?._id,
                downloadedAt: new Date(),
                downloadType: 'final',
                ipAddress: req.ip
            });
            await report.save();

            // ✅ Update DicomStudy printHistory + lastDownload
            if (report.dicomStudy?._id) {
                await DicomStudy.findByIdAndUpdate(report.dicomStudy._id, {
                    $push: {
                        printHistory: {
                            printedAt: new Date(),
                            printedBy: req.user?._id,
                            printedByName: req.user?.fullName || 'Unknown',
                            printType: 'pdf_download',
                            printMethod: 'pdf_download',
                            reportStatus: report.reportStatus,
                            bharatPacsId: report.dicomStudy?.bharatPacsId || '',
                            ipAddress: req.ip
                        }
                    },
                    $set: {
                        lastDownload: {
                            downloadedAt: new Date(),
                            downloadedBy: req.user?._id,
                            downloadedByName: req.user?.fullName || 'Unknown',
                            downloadType: 'pdf',
                            reportId: report._id,
                        }
                    }
                });

                const downloaderRoles = req.user?.accountRoles?.length > 0 ? req.user.accountRoles : [req.user?.role];
                if (downloaderRoles.includes('lab_staff')) {
                    updateWorkflowStatus({
                        studyId: report.dicomStudy._id,
                        status: 'final_report_downloaded',
                        note: `Report downloaded as PDF by ${req.user?.fullName || 'User'}`,
                        user: req.user
                    }).catch(e => console.warn('Workflow update failed'));
                }
            }

            const patientName = (report.patientInfo?.fullName || report.patient?.fullName || 'unknown_patient')
                .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const fileName = `${patientName}_${new Date().toISOString().split('T')[0]}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(Buffer.from(pdfResponse.data));
            console.log(`✅ [Download PDF] Sent: ${fileName}`);

        } catch (error) {
            console.error('❌ [Download PDF] Error:', error.message);
            if (error.code === 'ECONNREFUSED') return res.status(503).json({ success: false, message: 'PDF Service unavailable' });
            res.status(500).json({ success: false, message: 'Failed to download PDF', error: error.message });
        }
    }

    // ============================================================
    // ✅ Download single report as DOCX
    // ============================================================
    static async downloadReportAsDOCX(req, res) {
        console.log('📥 [Download DOCX] Starting...');
        try {
            const { reportId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(reportId)) {
                return res.status(400).json({ success: false, message: 'Invalid reportId' });
            }

            const report = await Report.findById(reportId)
                .populate('patient', 'fullName patientId patientID age gender')
                .populate({
                    path: 'dicomStudy',
                    select: 'accessionNumber modality studyDate referringPhysician patientInfo patientId sourceLab _id bharatPacsId workflowStatus reportInfo.finalizedAt reportInfo.verificationInfo.verifiedAt',
                    populate: { path: 'sourceLab', model: 'Lab' }
                })
                .populate('doctorId', 'fullName email');

            if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

            if (!canDownloadReport(report)) {
                return res.status(403).json({
                    success: false,
                    message: `Report is not downloadable yet. reportStatus='${report.reportStatus}', studyWorkflowStatus='${report.dicomStudy?.workflowStatus || 'unknown'}'.`
                });
            }

            // ✅ Block if doctor signature is missing
            const signatureValid = await checkDoctorSignature(report, res);
            if (!signatureValid) return;

            const payload = await buildDocxPayload(report, 'docx');
            const docxResponse = await axios.post(DOCX_SERVICE_URL, payload, {
                responseType: 'arraybuffer', timeout: 60000, httpsAgent
            });

            // ✅ Update DicomStudy printHistory + lastDownload
            if (report.dicomStudy?._id) {
                await DicomStudy.findByIdAndUpdate(report.dicomStudy._id, {
                    $push: {
                        printHistory: {
                            printedAt: new Date(),
                            printedBy: req.user?._id,
                            printedByName: req.user?.fullName || 'Unknown',
                            printType: 'docx_download',
                            printMethod: 'docx_download',
                            reportStatus: report.reportStatus,
                            bharatPacsId: report.dicomStudy?.bharatPacsId || '',
                            ipAddress: req.ip
                        }
                    },
                    $set: {
                        lastDownload: {
                            downloadedAt: new Date(),
                            downloadedBy: req.user?._id,
                            downloadedByName: req.user?.fullName || 'Unknown',
                            downloadType: 'docx',
                            reportId: report._id,
                        }
                    }
                });

                const downloaderRoles = req.user?.accountRoles?.length > 0 ? req.user.accountRoles : [req.user?.role];
                if (downloaderRoles.includes('lab_staff')) {
                    updateWorkflowStatus({
                        studyId: report.dicomStudy._id,
                        status: 'final_report_downloaded',
                        note: `Report downloaded as DOCX by ${req.user?.fullName || 'User'}`,
                        user: req.user
                    }).catch(e => console.warn('Workflow update failed'));
                }
            }

            const patientName = (report.patientInfo?.fullName || report.patient?.fullName || 'unknown_patient')
                .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const fileName = `${patientName}_${new Date().toISOString().split('T')[0]}.docx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(Buffer.from(docxResponse.data));
            console.log(`✅ [Download DOCX] Sent: ${fileName}`);

        } catch (error) {
            console.error('❌ [Download DOCX] Error:', error.message);
            res.status(500).json({ success: false, message: 'Failed to download DOCX', error: error.message });
        }
    }

    // ============================================================
    // ✅ Print report as PDF
    // ============================================================
    static async printReportAsPDF(req, res) {
        console.log('🖨️ [Print] Starting...');
        try {
            const { reportId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(reportId)) {
                return res.status(400).json({ success: false, message: 'Invalid reportId' });
            }

            const report = await Report.findById(reportId)
                .populate('patient', 'fullName patientId patientID age gender')
                .populate({
                    path: 'dicomStudy',
                    select: 'accessionNumber modality studyDate referringPhysician patientInfo patientId sourceLab _id workflowStatus bharatPacsId reportInfo.finalizedAt reportInfo.verificationInfo.verifiedAt',
                    populate: { path: 'sourceLab', model: 'Lab' }
                })
                .populate('doctorId', 'fullName email');

            if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

            if (!canDownloadReport(report)) {
                return res.status(403).json({
                    success: false,
                    message: `Report is not downloadable yet. reportStatus='${report.reportStatus}', studyWorkflowStatus='${report.dicomStudy?.workflowStatus || 'unknown'}'.`
                });
            }

            // ✅ Block if doctor signature is missing
            const signatureValid = await checkDoctorSignature(report, res);
            if (!signatureValid) return;

            const payload = await buildDocxPayload(report, 'pdf');
            const pdfResponse = await axios.post(DOCX_SERVICE_URL, payload, {
                responseType: 'arraybuffer', timeout: 60000, httpsAgent
            });
            const pdfBuffer = Buffer.from(pdfResponse.data);

            // Update report print info
            if (!report.printInfo) report.printInfo = { printHistory: [], totalPrints: 0 };
            const printType = report.printInfo.totalPrints === 0 ? 'print' : 'reprint';
            report.printInfo.totalPrints += 1;
            report.printInfo.lastPrintedAt = new Date();
            if (!report.printInfo.firstPrintedAt) report.printInfo.firstPrintedAt = new Date();
            report.printInfo.printHistory.push({
                printedBy: req.user?._id, printedAt: new Date(),
                printType, userRole: req.user?.role || 'unknown', ipAddress: req.ip
            });
            await report.save();

            // ✅ Update DicomStudy printHistory + lastDownload
            if (report.dicomStudy?._id) {
                await DicomStudy.findByIdAndUpdate(report.dicomStudy._id, {
                    $push: {
                        printHistory: {
                            printedAt: new Date(),
                            printedBy: req.user?._id,
                            printedByName: req.user?.fullName || 'Unknown',
                            printType: printType === 'print' ? 'original' : 'reprint',
                            printMethod: 'physical_print',
                            reportStatus: report.reportStatus,
                            bharatPacsId: report.dicomStudy?.bharatPacsId || '',
                            ipAddress: req.ip
                        }
                    },
                    $set: {
                        lastDownload: {
                            downloadedAt: new Date(),
                            downloadedBy: req.user?._id,
                            downloadedByName: req.user?.fullName || 'Unknown',
                            downloadType: 'print',
                            reportId: report._id,
                        }
                    }
                });
            }

            const patientName = (report.patientInfo?.fullName || report.patient?.fullName || 'unknown_patient')
                .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const fileName = `${patientName}_Print.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);
            console.log(`✅ [Print] Sent: ${fileName}`);

        } catch (error) {
            console.error('❌ [Print] Error:', error.message);
            if (error.code === 'ECONNREFUSED') return res.status(503).json({ success: false, message: 'PDF Service unavailable' });
            res.status(500).json({ success: false, message: 'Failed to generate print PDF', error: error.message });
        }
    }

    // ============================================================
    // ✅ Track print click
    // ============================================================
    static async trackPrintClick(req, res) {
        // ...existing code...
    }
}

export default ReportDownloadController;