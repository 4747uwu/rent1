import mongoose from 'mongoose';
import Report from '../models/reportModel.js';
import DicomStudy from '../models/dicomStudyModel.js';
import Patient from '../models/patientModel.js';
import User from '../models/userModel.js';
import Organization from '../models/organisation.js';
import { updateWorkflowStatus } from '../utils/workflowStatusManager.js';
export const storeDraftReport = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { 
            templateName, 
            placeholders, 
            htmlContent,
            templateId,
            templateInfo,
            capturedImages = [] // ✅ NEW: Accept captured images
        } = req.body;

        console.log(req.body)
        
        const currentUser = req.user;
        
        console.log('📝 [Draft Store] Starting draft report storage:', {
            studyId,
            userId: currentUser._id,
            userRole: currentUser.role,
            isAdmin: currentUser.role === 'admin' || currentUser.role === 'super_admin'
        });

        if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
            console.error('❌ [Draft Store] Invalid study ID:', studyId);
            return res.status(400).json({
                success: false,
                message: 'Valid study ID is required'
            });
        }

        const reportContent = htmlContent || placeholders?.['--Content--'] || '';
        if (!reportContent.trim()) {
            console.error('❌ [Draft Store] Empty report content');
            return res.status(400).json({
                success: false,
                message: 'Report content is required'
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const study = await DicomStudy.findById(studyId)
                .populate('patient', 'fullName patientId dateOfBirth gender')
                .populate('sourceLab', 'name identifier settings.requireReportVerification')
                .session(session);

            if (!study) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    message: 'Study not found'
                });
            }

            if (!study.organizationIdentifier) {
                study.organizationIdentifier = currentUser.organizationIdentifier;
            }

            const hasAccess = study.organizationIdentifier === currentUser.organizationIdentifier;
            if (!hasAccess) {
                await session.abortTransaction();
                return res.status(403).json({
                    success: false,
                    message: 'Access denied to this study'
                });
            }

            const organization = await Organization.findOne({
                identifier: currentUser.organizationIdentifier
            }).session(session);

            // ✅ DETERMINE DOCTOR ID AND NAME - Use assigned doctor if admin
            const { doctorId, doctorName } = await determineDoctorForReport(currentUser, study, session);

            let existingReport = await Report.findOne({
                dicomStudy: studyId,
                doctorId: doctorId  // ✅ Use the determined doctorId
            }).sort({ createdAt: -1 }).session(session);

            const now = new Date();

            const patientInfo = {
                fullName: study.patientInfo?.patientName || study.patient?.fullName || 'Unknown Patient',
                patientName: study.patientInfo?.patientName || study.patient?.fullName || 'Unknown Patient',
                age: placeholders?.['--agegender--']?.split(' / ')[0] || 
                     study.patientInfo?.age || 
                     study.patient?.age || 'N/A',
                gender: study.patient?.gender || 
                       study.patientInfo?.gender || 
                       placeholders?.['--agegender--']?.split(' / ')[1] || 'N/A',
                dateOfBirth: study.patient?.dateOfBirth,
                clinicalHistory: study.clinicalHistory?.clinicalHistory || 
                               study.patient?.clinicalHistory || 'N/A'
            };

            const referringPhysicianData = placeholders?.['--referredby--'] || 
                                          study.referringPhysician || 
                                          study.referringPhysicianName || 
                                          'N/A';
            const referringPhysicianName = typeof referringPhysicianData === 'string' 
                ? referringPhysicianData
                : typeof referringPhysicianData === 'object' && referringPhysicianData?.name
                ? referringPhysicianData.name
                : 'N/A';

            // ✅ FILENAME: Use doctor name (not admin)
            const doctorNameForFilename = doctorName.toLowerCase().replace(/\s+/g, '_');
            const fileName = `${doctorNameForFilename}_draft_${Date.now()}.docx`;

            const reportData = {
                reportId: existingReport?.reportId || `RPT_${studyId}_${Date.now()}`,
                organizationIdentifier: currentUser.organizationIdentifier,
                organization: organization?._id,
                patient: study.patient?._id,
                patientId: study.patientId,
                dicomStudy: studyId,
                studyInstanceUID: study.studyInstanceUID || study.orthancStudyID || studyId.toString(),
                orthancStudyID: study.orthancStudyID,
                accessionNumber: study.accessionNumber,
                // ✅ FIXED: If admin, createdBy should be the doctor, not the admin
                createdBy: currentUser.role === 'admin' || currentUser.role === 'super_admin' 
                    ? doctorId  // Use doctor's ID
                    : currentUser._id,  // Use current user's ID
                doctorId: doctorId,            // ✅ Use assigned doctor ID
                reportContent: {
                    htmlContent: reportContent,
                    templateInfo: templateInfo || { templateId: templateId || null, templateName: templateName || 'Custom Template', templateCategory: 'General', templateTitle: templateName || 'Draft Report' },
                    placeholders: placeholders || {},
                    capturedImages: capturedImages.map((img, index) => ({
                        ...img,
                        capturedBy: currentUser._id,
                        displayOrder: img.displayOrder ?? index
                    })),
                    statistics: {
                        wordCount: reportContent.split(/\s+/).length,
                        characterCount: reportContent.length,
                        pageCount: 1,
                        imageCount: capturedImages.length // ✅ NEW
                    }
                },
                reportType: 'draft',
                reportStatus: 'draft',
                exportInfo: { format: 'docx', fileName: fileName },  // ✅ Use doctor name
                patientInfo: patientInfo,
                studyInfo: {
                    studyDate: study.studyDate,
                    modality: study.modality || study.modalitiesInStudy?.join(', '),
                    examDescription: study.examDescription || study.studyDescription,
                    institutionName: study.institutionName,
                    referringPhysician: {
                        name: referringPhysicianName,
                        institution: typeof study.referringPhysician === 'object' ? study.referringPhysician?.institution || '' : '',
                        contactInfo: typeof study.referringPhysician === 'object' ? study.referringPhysician?.contactInfo || '' : ''
                    },
                    seriesCount: study.seriesCount,
                    instanceCount: study.instanceCount,
                    priority: study.studyPriority || study.assignment?.priority,
                    caseType: study.caseType
                },
                workflowInfo: { draftedAt: existingReport?.workflowInfo?.draftedAt || now, statusHistory: existingReport?.workflowInfo?.statusHistory || [] },
                systemInfo: { dataSource: 'online_reporting_system' }
            };

            reportData.workflowInfo.statusHistory.push({
                status: 'draft',
                changedAt: now,
                changedBy: currentUser._id,
                notes: existingReport ? 'Draft report updated' : 'Draft report created',
                userRole: currentUser.role
            });

            let savedReport;
            if (existingReport) {
                Object.assign(existingReport, reportData);
                savedReport = await existingReport.save({ session });
            } else {
                savedReport = new Report(reportData);
                await savedReport.save({ session });
            }

            await updateStudyReportStatus(study, savedReport, session);

            study.workflowStatus = 'report_drafted';
            study.currentCategory = 'DRAFT';
            if (!study.reportInfo) study.reportInfo = {};
            study.reportInfo.draftedAt = now;
            study.reportInfo.reporterName = doctorName;

            if (!study.statusHistory) study.statusHistory = [];
            study.statusHistory.push({
                status: 'report_drafted',
                changedAt: now,
                changedBy: currentUser._id,
                note: `Draft report ${existingReport ? 'updated' : 'created'} by ${currentUser.fullName} for ${doctorName}`
            });

            await study.save({ session });
            await session.commitTransaction();

            console.log('✅ [Draft Store] Draft report stored successfully:', {
                reportId: savedReport._id,
                fileName: fileName,  // ✅ Show doctor's name in filename
                doctorId: doctorId.toString(),
                doctorName: doctorName,
                createdBy: currentUser.fullName,
                isAdminCreating: currentUser.role === 'admin'
            });

            res.status(200).json({
                success: true,
                message: 'Draft report saved successfully',
                data: {
                    reportId: savedReport._id,
                    documentId: savedReport.reportId,
                    doctorName: doctorName,
                    filename: fileName,  // ✅ Return doctor's filename
                    reportType: savedReport.reportType,
                    reportStatus: savedReport.reportStatus
                }
            });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('❌ [Draft Store] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while storing draft report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ UPDATED HELPER: Determine correct doctor ID and name
const determineDoctorForReport = async (currentUser, study, session) => {
    let doctorId = currentUser._id;
    let doctorName = currentUser.fullName;
    
    // ✅ If admin/super_admin, use assigned doctor instead
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
        console.log('👨‍💼 [Report] Admin creating report, using assigned doctor instead');
        
        if (study.assignment && study.assignment.length > 0) {
            const latestAssignment = study.assignment[study.assignment.length - 1];
            
            if (latestAssignment.assignedTo) {
                doctorId = latestAssignment.assignedTo;
                
                // Fetch assigned doctor's name
                try {
                    const assignedDoctor = await User.findById(latestAssignment.assignedTo)
                        .select('fullName')
                        .session(session);
                    
                    if (assignedDoctor) {
                        doctorName = assignedDoctor.fullName;
                        console.log('✅ [Report] Using assigned doctor:', {
                            doctorId: doctorId.toString(),
                            doctorName: doctorName,
                            createdByAdmin: currentUser.fullName,
                            originalAdmin: currentUser._id.toString()
                        });
                    }
                } catch (e) {
                    console.warn('⚠️ Could not fetch assigned doctor name:', e.message);
                }
            }
        } else {
            console.warn('⚠️ Admin creating report but no assigned doctor found');
        }
    }
    
    return { doctorId, doctorName };
};

// ✅ UPDATED: storeFinalizedReport
export const storeFinalizedReport = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { templateName, placeholders, htmlContent, templateId, templateInfo, format = 'docx', capturedImages = [] } = req.body;

        const currentUser = req.user;

        console.log('🏁 [Finalize Store] Starting finalized report storage:', {
            studyId,
            userId: currentUser._id,
            userRole: currentUser.role,
            isAdmin: currentUser.role === 'admin' || currentUser.role === 'super_admin'
        });

        if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({ success: false, message: 'Valid study ID is required' });
        }

        const reportContent = htmlContent || placeholders?.['--Content--'] || '';
        if (!reportContent.trim()) {
            return res.status(400).json({ success: false, message: 'Report content is required for finalization' });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const study = await DicomStudy.findById(studyId)
                .populate('patient', 'fullName patientId dateOfBirth gender')
                .populate('sourceLab', 'name identifier settings.requireReportVerification')
                .session(session);

            if (!study) {
                await session.abortTransaction();
                return res.status(404).json({ success: false, message: 'Study not found' });
            }

            if (!study.organizationIdentifier) {
                study.organizationIdentifier = currentUser.organizationIdentifier;
            }

            const hasAccess = study.organizationIdentifier === currentUser.organizationIdentifier;
            if (!hasAccess) {
                await session.abortTransaction();
                return res.status(403).json({ success: false, message: 'Access denied to this study' });
            }

            const organization = await Organization.findOne({
                identifier: currentUser.organizationIdentifier
            }).session(session);

            // ✅ DETERMINE DOCTOR ID AND NAME - Use assigned doctor if admin
            const { doctorId, doctorName } = await determineDoctorForReport(currentUser, study, session);

            let existingReport = await Report.findOne({
                dicomStudy: studyId,
                doctorId: doctorId
            }).sort({ createdAt: -1 }).session(session);

            const now = new Date();

            const patientInfo = {
                fullName: study.patientInfo?.patientName || study.patient?.fullName || 'Unknown Patient',
                patientName: study.patientInfo?.patientName || study.patient?.fullName || 'Unknown Patient',
                age: placeholders?.['--agegender--']?.split(' / ')[0] || 
                     study.patientInfo?.age || 
                     study.patient?.age || 'N/A',
                gender: study.patient?.gender || 
                       study.patientInfo?.gender || 
                       placeholders?.['--agegender--']?.split(' / ')[1] || 'N/A',
                dateOfBirth: study.patient?.dateOfBirth,
                clinicalHistory: study.clinicalHistory?.clinicalHistory || 
                               study.patient?.clinicalHistory || 'N/A'
            };

            const referringPhysicianData = placeholders?.['--referredby--'] || 
                                          study.referringPhysician || 
                                          study.referringPhysicianName || 
                                          'N/A';
            const referringPhysicianName = typeof referringPhysicianData === 'string' 
                ? referringPhysicianData
                : typeof referringPhysicianData === 'object' && referringPhysicianData?.name
                ? referringPhysicianData.name
                : 'N/A';

            // ✅ FILENAME: Use doctor name (not admin)
            const doctorNameForFilename = doctorName.toLowerCase().replace(/\s+/g, '_');
            const fileName = `${doctorNameForFilename}_final_${Date.now()}.${format}`;

            const reportData = {
                reportId: existingReport?.reportId || `RPT_${studyId}_${Date.now()}`,
                organizationIdentifier: currentUser.organizationIdentifier,
                organization: organization?._id,
                patient: study.patient?._id,
                patientId: study.patientId,
                dicomStudy: studyId,
                studyInstanceUID: study.studyInstanceUID || study.orthancStudyID || studyId.toString(),
                orthancStudyID: study.orthancStudyID,
                accessionNumber: study.accessionNumber,
                // ✅ FIXED: If admin, createdBy should be the doctor, not the admin
                createdBy: currentUser.role === 'admin' || currentUser.role === 'super_admin' 
                    ? doctorId  // Use doctor's ID
                    : existingReport?.createdBy || currentUser._id,
                doctorId: doctorId,            // ✅ Use assigned doctor ID
                reportContent: {
                    htmlContent: reportContent,
                    templateInfo: templateInfo || { templateId: templateId || null, templateName: templateName || 'Custom Template', templateCategory: 'General', templateTitle: templateName || 'Finalized Report' },
                    placeholders: placeholders || {},
                    capturedImages: capturedImages.map((img, index) => ({
                        ...img,
                        capturedBy: currentUser._id,
                        displayOrder: img.displayOrder ?? index
                    })),
                    statistics: {
                        wordCount: reportContent.split(/\s+/).length,
                        characterCount: reportContent.length,
                        pageCount: 1,
                        imageCount: capturedImages.length
                    }
                },
                reportType: 'finalized',
                reportStatus: 'finalized',
                exportInfo: { format: format, fileName: fileName },  // ✅ Use doctor name
                patientInfo: patientInfo,
                studyInfo: {
                    studyDate: study.studyDate,
                    modality: study.modality || study.modalitiesInStudy?.join(', '),
                    examDescription: study.examDescription || study.studyDescription,
                    institutionName: study.institutionName,
                    referringPhysician: {
                        name: referringPhysicianName,
                        institution: typeof study.referringPhysician === 'object' ? study.referringPhysician?.institution || '' : '',
                        contactInfo: typeof study.referringPhysician === 'object' ? study.referringPhysician?.contactInfo || '' : ''
                    },
                    seriesCount: study.seriesCount,
                    instanceCount: study.instanceCount,
                    priority: study.studyPriority || study.assignment?.priority,
                    caseType: study.caseType
                },
                workflowInfo: { draftedAt: existingReport?.workflowInfo?.draftedAt || now, finalizedAt: now, statusHistory: existingReport?.workflowInfo?.statusHistory || [] },
                systemInfo: { dataSource: 'online_reporting_system' }
            };

            reportData.workflowInfo.statusHistory.push({
                status: 'finalized',
                changedAt: now,
                changedBy: currentUser._id,
                notes: existingReport ? 'Draft report finalized' : 'Report created and finalized',
                userRole: currentUser.role
            });

            let savedReport;
            if (existingReport) {
                Object.assign(existingReport, reportData);
                savedReport = await existingReport.save({ session });
            } else {
                savedReport = new Report(reportData);
                await savedReport.save({ session });
            }

            await updateStudyReportStatus(study, savedReport, session);

            const doctorInfo = await mongoose.model('Doctor').findOne({ userAccount: doctorId }).select('requireReportVerification').session(session);
            const requiresVerification = study.sourceLab?.settings?.requireReportVerification || doctorInfo?.requireReportVerification;

            if (requiresVerification) {
                study.workflowStatus = 'verification_pending';
                study.currentCategory = 'VERIFICATION_PENDING';
                if (!study.reportInfo) study.reportInfo = {};
                study.reportInfo.sentForVerificationAt = now;
                study.reportInfo.finalizedAt = now;
                study.reportInfo.reporterName = doctorName;
            } else {
                study.workflowStatus = 'report_completed';
                study.currentCategory = 'COMPLETED';
                if (!study.reportInfo) study.reportInfo = {};
                study.reportInfo.completedAt = now;
                study.reportInfo.finalizedAt = now;
                study.reportInfo.reporterName = doctorName;
                study.reportInfo.completedWithoutVerification = true;
            }

            if (!study.statusHistory) study.statusHistory = [];
            study.statusHistory.push({
                status: study.workflowStatus,
                changedAt: now,
                changedBy: currentUser._id,
                note: `Report finalized for ${doctorName}${requiresVerification ? ' - sent for verification' : ' - completed'}`
            });

            await study.save({ session });
            await session.commitTransaction();

            console.log('✅ [Finalize Store] Finalized report stored successfully:', {
                reportId: savedReport._id,
                fileName: fileName,  // ✅ Show doctor's name in filename
                doctorId: doctorId.toString(),
                doctorName: doctorName,
                createdBy: savedReport.createdBy.toString(),
                isAdminCreating: currentUser.role === 'admin',
                requiresVerification: requiresVerification
            });

            res.status(200).json({
                success: true,
                message: 'Report finalized and stored successfully',
                data: {
                    reportId: savedReport._id,
                    documentId: savedReport.reportId,
                    doctorName: doctorName,
                    filename: fileName,  // ✅ Return doctor's filename
                    reportType: savedReport.reportType,
                    reportStatus: savedReport.reportStatus,
                    studyWorkflowStatus: study.workflowStatus,
                    requiresVerification: requiresVerification,
                    nextStep: requiresVerification ? 'Report sent to verifier for approval' : 'Report completed and ready for download'
                }
            });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('❌ [Finalize Store] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while storing finalized report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ GET STUDY REPORTS - For ReportModal
export const getStudyReports = async (req, res) => {
    try {
        const { studyId } = req.params;
        const currentUser = req.user;
        
        console.log('📄 [Get Reports] Fetching reports for study:', studyId);

        if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid study ID is required'
            });
        }

        // Find all reports for this study
        const reports = await Report.find({
            dicomStudy: studyId,
            organizationIdentifier: currentUser.organizationIdentifier
        })
        .populate('doctorId', 'fullName email role')
        .populate('verifierId', 'fullName email role')
        .populate('createdBy', 'fullName email role')
        .sort({ createdAt: -1 })
        .lean();

        console.log('📄 [Get Reports] Found reports:', reports.length);

        // Format reports for frontend
        const formattedReports = reports.map(report => ({
            _id: report._id,
            filename: report.exportInfo?.fileName || `report_${report._id}.${report.exportInfo?.format || 'docx'}`,
            reportType: report.reportType,
            reportStatus: report.reportStatus,
            uploadedAt: report.workflowInfo?.finalizedAt || report.createdAt,
            uploadedBy: report.doctorId?.fullName || report.createdBy?.fullName || 'Unknown',
            size: report.exportInfo?.fileSize || 0,
            contentType: report.exportInfo?.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            verificationStatus: report.verificationInfo?.verificationStatus || 'pending',
            verifiedBy: report.verifierId?.fullName,
            verifiedAt: report.verificationInfo?.verifiedAt,
            downloadUrl: report.exportInfo?.downloadUrl,
            wordCount: report.reportContent?.statistics?.wordCount || 0,
            characterCount: report.reportContent?.statistics?.characterCount || 0
        }));

        res.status(200).json({
            success: true,
            data: {
                reports: formattedReports,
                count: formattedReports.length,
                studyId: studyId
            }
        });

    } catch (error) {
        console.error('❌ [Get Reports] Error fetching study reports:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching reports',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ DOWNLOAD REPORT
export const downloadReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const currentUser = req.user;
        
        console.log('⬇️ [Download Report] Starting download for report:', reportId);

        if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid report ID is required'
            });
        }

        const report = await Report.findById(reportId);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Verify access
        if (report.organizationIdentifier !== currentUser.organizationIdentifier) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this report'
            });
        }

        // Track download
        await report.addDownload(currentUser._id, 'final');

        // If download URL exists, redirect
        if (report.exportInfo?.downloadUrl) {
            console.log('✅ [Download Report] Redirecting to download URL');
            res.status(200).json({
                success: true,
                data: {
                    downloadUrl: report.exportInfo.downloadUrl,
                    fileName: report.exportInfo.fileName,
                    contentType: report.exportInfo.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                }
            });
        } else {
            return res.status(404).json({
                success: false,
                message: 'Download URL not available for this report'
            });
        }

    } catch (error) {
        console.error('❌ [Download Report] Error downloading report:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while downloading report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ HELPER FUNCTION - Update study report status
const updateStudyReportStatus = async (study, report, session) => {
    try {
        console.log('🔄 [Helper] Updating study report status for study:', study._id);
        
        // Update current report status
        study.currentReportStatus = {
            hasReports: true,
            latestReportId: report._id,
            latestReportStatus: report.reportStatus,
            latestReportType: report.reportType,
            reportCount: (study.currentReportStatus?.reportCount || 0) + 1,
            lastReportedAt: new Date(),
            lastReportedBy: report.doctorId
        };

        // Add to modern reports
        if (!study.reportInfo) {
            study.reportInfo = {};
        }
        if (!study.reportInfo.modernReports) {
            study.reportInfo.modernReports = [];
        }
        
        // ✅ FIX: Check if report already exists to avoid duplicates
        const reportExists = study.reportInfo.modernReports.some(
            r => r.reportId?.toString() === report._id.toString()
        );
        
        if (!reportExists) {
            study.reportInfo.modernReports.push({
                reportId: report._id,
                reportType: report.reportType,
                createdAt: new Date()
            });
        }

        // Add to reports array
        if (!study.reports) {
            study.reports = [];
        }
        
        // ✅ FIX: Check if report already exists to avoid duplicates
        const legacyReportExists = study.reports.some(
            r => r.reportId?.toString() === report._id.toString()
        );
        
        if (!legacyReportExists) {
            study.reports.push({
                reportId: report._id,
                reportType: report.reportType,
                reportStatus: report.reportStatus,
                createdBy: report.createdBy,
                fileName: report.exportInfo?.fileName
            });
        }

        // ✅ CRITICAL FIX: Save the study with session
        await study.save({ session });
        
        console.log('✅ [Helper] Study report status updated and saved:', {
            hasReports: study.currentReportStatus.hasReports,
            reportCount: study.currentReportStatus.reportCount,
            modernReportsCount: study.reportInfo.modernReports.length,
            reportsArrayCount: study.reports.length
        });
    } catch (error) {
        console.error('❌ [Helper] Error updating study report status:', error);
        throw error;
    }
};


// Add this new endpoint to get report content for editing
export const getReportForEditing = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { reportId } = req.query; // Optional - get specific report
        const currentUser = req.user;

        console.log('📝 [Report Edit] Getting report for editing:', {
            studyId,
            reportId,
            userId: currentUser._id,
            specificReport: !!reportId
        });

        // Find the report to edit
        let report;
        
        if (reportId) {
            // ✅ Get specific report by ID
            console.log('📝 [Report Edit] Loading specific report:', reportId);
            report = await Report.findById(reportId)
                .populate('doctorId', 'fullName email')
                .populate('patient', 'fullName patientId')
                .populate('dicomStudy');
                
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: 'Specific report not found'
                });
            }
            
            // Verify the report belongs to the specified study
            if (report.dicomStudy._id.toString() !== studyId) {
                return res.status(400).json({
                    success: false,
                    message: 'Report does not belong to the specified study'
                });
            }
        } else {
            // Get latest draft or finalized report (original logic)
            report = await Report.findOne({
                dicomStudy: studyId,
                reportStatus: { $in: ['draft', 'finalized'] },
                organizationIdentifier: currentUser.organizationIdentifier
            })
            .sort({ 
                // Prioritize finalized reports for verification
                reportStatus: 1, // 'draft' < 'finalized' alphabetically
                createdAt: -1 
            })
            .populate('doctorId', 'fullName email')
            .populate('patient', 'fullName patientId')
            .populate('dicomStudy');
        }

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'No report found for editing'
            });
        }

        // Check access permissions
        if (report.organizationIdentifier !== currentUser.organizationIdentifier) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this report'
            });
        }

        console.log('✅ [Report Edit] Report found for editing:', {
            reportId: report._id,
            reportType: report.reportType,
            reportStatus: report.reportStatus,
            contentLength: report.reportContent?.htmlContent?.length || 0,
            specificReportRequested: !!reportId
        });

        res.status(200).json({
            success: true,
            data: {
                report: {
                    _id: report._id,
                    reportId: report.reportId,
                    reportType: report.reportType,
                    reportStatus: report.reportStatus,
                    reportContent: report.reportContent,
                    templateInfo: report.reportContent?.templateInfo,
                    placeholders: report.reportContent?.placeholders,
                    exportInfo: report.exportInfo,
                    createdAt: report.createdAt,
                    updatedAt: report.updatedAt,
                    workflowInfo: report.workflowInfo,
                    doctorId: report.doctorId
                },
                studyInfo: {
                    workflowStatus: report.dicomStudy?.workflowStatus,
                    patientInfo: report.dicomStudy?.patientInfo,
                    studyDate: report.dicomStudy?.studyDate,
                    modality: report.dicomStudy?.modality
                }
            },
            source: reportId ? 'specific_report_edit' : 'latest_report_edit'
        });

    } catch (error) {
        console.error('❌ [Report Edit] Error getting report for editing:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting report for editing',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Add this to the existing exports
export default {
    storeDraftReport,
    storeFinalizedReport,
    getStudyReports,
    downloadReport,
    getReportForEditing // ✅ NEW
};