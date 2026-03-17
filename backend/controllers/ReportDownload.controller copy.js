import axios from 'axios';
import DicomStudy from '../models/dicomStudyModel.js';
import Report from '../models/reportModel.js';
import User from '../models/userModel.js';
import Doctor from '../models/doctorModel.js';
import Lab from '../models/labModel.js';
import https from 'https';
import mongoose from 'mongoose';
import { updateWorkflowStatus } from '../utils/workflowStatusManager.js';

const DOCX_SERVICE_URL = 'http://206.189.133.52:8081/api/Document/generate';
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
        // ✅ No header/footer: use MyReportNoHeader template with image count increment
        templateName = 'MyReportNoHeader.docx';
        if (imageCount > 0 && imageCount <= 5) {
            templateName = `MyReportNoHeader${imageCount}.docx`;
        } else if (imageCount > 5) {
            templateName = 'MyReportNoHeader5.docx';
        }
        console.log(`📄 Using NoHeader template (no branding): ${templateName}`);
    } else {
        // ✅ Has header/footer: use standard MyReport template with image count increment
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
                    disclaimer: 'Electronically signed. This is a digitally generated report.'
                };
            }
        } catch (e) { console.warn('⚠️ Failed to fetch doctor data'); }
    }

    const placeholders = {
        '--name--': report.patientInfo?.fullName || report.patient?.fullName || '[Patient Name]',
        '--patientid--': report.patientInfo?.patientId || report.patient?.patientId || '[Patient ID]',
        '--accessionno--': report.accessionNumber || report.dicomStudy?.accessionNumber || '[Accession Number]',
        '--agegender--': `${report.patientInfo?.age || report.patient?.age || '[Age]'} / ${report.patientInfo?.gender || report.patient?.gender || '[Gender]'}`,
        '--referredby--': report.studyInfo?.referringPhysician?.name || report.dicomStudy?.referringPhysician || '[Referring Physician]',
        '--reporteddate--': report.studyInfo?.studyDate ? new Date(report.studyInfo.studyDate).toLocaleDateString() : new Date().toLocaleDateString(),
        '--studydate--': report.studyInfo?.studyDate ? new Date(report.studyInfo.studyDate).toLocaleDateString() : '[Study Date]',
        '--modality--': report.studyInfo?.modality || report.dicomStudy?.modality || '[Modality]',
        '--clinicalhistory--': report.patientInfo?.clinicalHistory || '[Clinical History]',
        '--Content--': htmlContent
    };

    if (doctorData) {
        placeholders['--drname--'] = doctorData.fullName;
        placeholders['--department--'] = doctorData.department;
        placeholders['--Licence--'] = doctorData.licenseNumber;
        placeholders['--disc--'] = doctorData.disclaimer;
    }

    const images = {};
    
    // ✅ Only add header/footer images if they exist
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
        .populate('patient', 'fullName patientId age gender')
        .populate({
            path: 'dicomStudy',
            select: 'accessionNumber modality studyDate referringPhysician sourceLab _id',
            populate: { path: 'sourceLab', model: 'Lab' }
        })
        .populate('doctorId', 'fullName email')
        .sort({ createdAt: -1 });
};

class ReportDownloadController {

    // ============================================================
    // ✅ NEW: Get all report IDs for a study
    // Frontend calls this first, then downloads each reportId individually
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
                    // ✅ Return list of report IDs — frontend downloads each one
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
    // ✅ FIXED: Download single report as DOCX (by reportId only)
    // ============================================================
    static async downloadReportAsDOCX(req, res) {
        console.log('📥 [Download DOCX] Starting...');

        try {
            const { reportId } = req.params;
            console.log(req.body)

            if (!mongoose.Types.ObjectId.isValid(reportId)) {
                return res.status(400).json({ success: false, message: 'Invalid reportId' });
            }

            const report = await Report.findById(reportId)
                .populate('patient', 'fullName patientId age gender')
                .populate({
                    path: 'dicomStudy',
                    select: 'accessionNumber modality studyDate referringPhysician sourceLab _id bharatPacsId',
                    populate: { path: 'sourceLab', model: 'Lab' }
                })
                .populate('doctorId', 'fullName email');

            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }

            // ✅ GUARD: Only allow verified reports to be downloaded
            if (report.reportStatus !== 'verified') {
                console.warn(`⚠️ [Download DOCX] Blocked — report status is '${report.reportStatus}', not 'verified'. ReportId: ${reportId}`);
                return res.status(403).json({
                    success: false,
                    message: `Only verified reports can be downloaded. This report is currently '${report.reportStatus}'.`
                });
            }

            const payload = await buildDocxPayload(report, 'docx');

            const docxResponse = await axios.post(DOCX_SERVICE_URL, payload, {
                responseType: 'arraybuffer',
                timeout: 60000,
                httpsAgent
            });

            const fileName = `${report.reportId || `Report_${report._id}`}_${new Date().toISOString().split('T')[0]}.docx`;

            const downloaderRoles = req.user?.accountRoles?.length > 0 ? req.user.accountRoles : [req.user?.role];
if (downloaderRoles.includes('lab_staff')) {
    updateWorkflowStatus({
        studyId: report.dicomStudy._id,
        status: 'final_report_downloaded',
        note: `Report downloaded as docx by ${req.user?.fullName || 'User'}`,
        user: req.user
    }).catch(e => console.warn('Workflow update failed'));
}

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(Buffer.from(docxResponse.data));
            console.log(`✅ [Download DOCX] Sent verified report: ${fileName}`);

        } catch (error) {
            console.error('❌ [Download DOCX] Error:', error.message);
            res.status(500).json({ success: false, message: 'Failed to download DOCX', error: error.message });
        }
    }

    // ============================================================
    // ✅ Download single report as PDF — VERIFIED ONLY
    // ============================================================
    static async downloadReportAsPDF(req, res) {
        console.log('📥 [Download PDF] Starting...');
        try {
            const { reportId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(reportId)) {
                return res.status(400).json({ success: false, message: 'Invalid reportId' });
            }

            const report = await Report.findById(reportId)
                .populate('patient', 'fullName patientId age gender')
                .populate({
                    path: 'dicomStudy',
                    select: 'accessionNumber modality studyDate referringPhysician sourceLab _id bharatPacsId',
                    populate: { path: 'sourceLab', model: 'Lab' }
                })
                .populate('doctorId', 'fullName email');

            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }

            if (report.reportStatus !== 'verified') {
                return res.status(403).json({
                    success: false,
                    message: `Only verified reports can be downloaded. This report is currently '${report.reportStatus}'.`
                });
            }

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

            // ✅ NEW: Update DicomStudy printHistory + lastDownload
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

            const fileName = `${report.reportId || `Report_${report._id}`}_${new Date().toISOString().split('T')[0]}.pdf`;
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
                .populate('patient', 'fullName patientId age gender')
                .populate({
                    path: 'dicomStudy',
                    select: 'accessionNumber modality studyDate referringPhysician sourceLab _id bharatPacsId',
                    populate: { path: 'sourceLab', model: 'Lab' }
                })
                .populate('doctorId', 'fullName email');

            if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

            if (report.reportStatus !== 'verified') {
                return res.status(403).json({
                    success: false,
                    message: `Only verified reports can be downloaded. This report is currently '${report.reportStatus}'.`
                });
            }

            const payload = await buildDocxPayload(report, 'docx');
            const docxResponse = await axios.post(DOCX_SERVICE_URL, payload, {
                responseType: 'arraybuffer', timeout: 60000, httpsAgent
            });

            // ✅ NEW: Update DicomStudy printHistory + lastDownload
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
                        note: `Report downloaded as PDF by ${req.user?.fullName || 'User'}`,
                        user: req.user
                    }).catch(e => console.warn('Workflow update failed'));
                }
            }

            const fileName = `${report.reportId || `Report_${report._id}`}_${new Date().toISOString().split('T')[0]}.docx`;
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
    // ✅ Print — VERIFIED ONLY
    // ============================================================
    static async printReportAsPDF(req, res) {
        console.log('🖨️ [Print] Starting...');
        try {
            const { reportId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(reportId)) {
                return res.status(400).json({ success: false, message: 'Invalid reportId' });
            }

            const report = await Report.findById(reportId)
                .populate('patient', 'fullName patientId age gender')
                .populate({
                    path: 'dicomStudy',
                    select: 'accessionNumber modality studyDate referringPhysician sourceLab _id workflowStatus bharatPacsId',
                    populate: { path: 'sourceLab', model: 'Lab' }
                })
                .populate('doctorId', 'fullName email');

            if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

            if (report.reportStatus !== 'verified') {
                return res.status(403).json({
                    success: false,
                    message: `Only verified reports can be printed. This report is currently '${report.reportStatus}'.`
                });
            }

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

            // ✅ NEW: Update DicomStudy printHistory + lastDownload
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

            const fileName = `${report.reportId || `Report_${report._id}`}_Print.pdf`;
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
    // ✅ UNCHANGED: Track print click
    // ============================================================
    static async trackPrintClick(req, res) {
        // ...existing code...
    }
}

export default ReportDownloadController;