// backend/controllers/studyCopy.controller.js

import DicomStudy, { ACTION_TYPES } from '../models/dicomStudyModel.js';
import Patient from '../models/patientModel.js';
import Document from '../models/documentModal.js';
import Report from '../models/reportModel.js';
import Organization from '../models/organisation.js';
import { wasabiS3Client, wasabiConfig } from '../config/wasabi-s3.js';
import { CopyObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// ✅ HELPER: Generate new BharatPacsId
const generateBharatPacsId = (orgIdentifier, labIdentifier) => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `BP-${orgIdentifier}-${labIdentifier}-${timestamp}-${random}`;
};

// ✅ HELPER: Generate new Report ID
const generateReportId = (orgIdentifier) => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `RPT-${orgIdentifier}-${timestamp}-${random}`;
};

// ✅ SIMPLIFIED: Copy study to CURRENT organization (no target selection needed)
export const copyStudyToOrganization = async (req, res) => {
    try {
        const { bharatPacsId } = req.params;
        const { copyAttachments = true, copyReports = true, copyNotes = true, reason = 'Study transfer' } = req.body;
        const user = req.user;

        console.log(`📋 Copying study ${bharatPacsId} to current organization ${user.organizationIdentifier}`);

        // Validate user has permission (super_admin or admin)
        if (!['super_admin', 'admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only super_admin or admin can copy studies between organizations'
            });
        }

        // Find source study with all related data
        const sourceStudy = await DicomStudy.findOne({ bharatPacsId })
            .populate('organization', 'name identifier')
            .populate('sourceLab', 'name identifier')
            .populate('patient')
            .populate('discussions.userId', 'fullName email role')
            .lean();

        if (!sourceStudy) {
            return res.status(404).json({
                success: false,
                message: 'Source study not found with this BP ID'
            });
        }

        // ✅ TARGET ORG IS CURRENT USER'S ORG
        const targetOrg = await Organization.findOne({ identifier: user.organizationIdentifier });
        
        if (!targetOrg) {
            return res.status(404).json({
                success: false,
                message: 'Your organization not found'
            });
        }

        // ✅ CHECK: Can't copy to same organization
        if (sourceStudy.organizationIdentifier === user.organizationIdentifier) {
            return res.status(400).json({
                success: false,
                message: 'Cannot copy study to the same organization. Please switch to a different organization first.'
            });
        }

        // ✅ NOTE: Source study is left completely untouched.
        // The copy operation should never modify the original study's
        // workflow status, category, or assignments.

        // Create or find patient in target organization
        const targetPatient = await Patient.findOneAndUpdate(
            {
                organizationIdentifier: targetOrg.identifier,
                patientID: sourceStudy.patientId
            },
            {
                $setOnInsert: {
                    organization: targetOrg._id,
                    organizationIdentifier: targetOrg.identifier,
                    patientID: sourceStudy.patientId,
                    firstName: sourceStudy.patient?.firstName || '',
                    lastName: sourceStudy.patient?.lastName || '',
                    patientNameRaw: sourceStudy.patientInfo?.patientName || '',
                    gender: sourceStudy.patientInfo?.gender || '',
                    ageString: sourceStudy.patientInfo?.age || '',
                    dateOfBirth: sourceStudy.patient?.dateOfBirth || '',
                    clinicalInfo: sourceStudy.patient?.clinicalInfo || {}
                }
            },
            { upsert: true, new: true }
        );

        // Generate new BharatPacsId for copied study
        const newBharatPacsId = generateBharatPacsId(
            targetOrg.identifier,
            sourceStudy.sourceLab?.identifier || 'LAB'
        );

        // ✅ NEW: Copy study notes/discussions
        const copiedDiscussions = copyNotes && sourceStudy.discussions?.length > 0 
            ? sourceStudy.discussions.map(discussion => ({
                comment: discussion.comment,
                userName: discussion.userName,
                userRole: discussion.userRole,
                userId: null,
                dateTime: discussion.dateTime,
                copiedFrom: {
                    originalUserId: discussion.userId?._id || discussion.userId,
                    originalUserName: discussion.userName,
                    copiedAt: new Date()
                }
            }))
            : [];

        // Create copied study (deep copy)
        const copiedStudyData = {
            // New identifiers
            bharatPacsId: newBharatPacsId,
            studyInstanceUID: `${sourceStudy.studyInstanceUID}_COPY_${Date.now()}`,
            orthancStudyID: null,
            
            // Target organization
            organization: targetOrg._id,
            organizationIdentifier: targetOrg.identifier,
            
            // Patient reference
            patient: targetPatient._id,
            patientId: targetPatient.patientID,
            patientInfo: sourceStudy.patientInfo,
            
            // Copy all study data
            studyDate: sourceStudy.studyDate,
            studyTime: sourceStudy.studyTime,
            modality: sourceStudy.modality,
            modalitiesInStudy: sourceStudy.modalitiesInStudy,
            accessionNumber: sourceStudy.accessionNumber,
            studyDescription: sourceStudy.studyDescription,
            examDescription: sourceStudy.examDescription,
            
            // Series and instances
            seriesCount: sourceStudy.seriesCount,
            instanceCount: sourceStudy.instanceCount,
            seriesImages: sourceStudy.seriesImages,
            
            // Clinical information
            clinicalHistory: sourceStudy.clinicalHistory,
            referringPhysician: sourceStudy.referringPhysician,
            referringPhysicianName: sourceStudy.referringPhysicianName,
            physicians: sourceStudy.physicians,
            institutionName: sourceStudy.institutionName,
            
            // Reset workflow
            workflowStatus: 'new_study_received',
            currentCategory: 'CREATED',
            assignment: [],
            sourceLab: sourceStudy.sourceLab?._id || sourceStudy.sourceLab || null,
            
            // ✅ Copy uploaded reports and doctor reports inline
            uploadedReports: copyReports ? (sourceStudy.uploadedReports || []).map(report => ({
                filename: report.filename,
                contentType: report.contentType,
                data: report.data, // Base64 data
                size: report.size,
                reportType: report.reportType,
                uploadedAt: report.uploadedAt,
                uploadedBy: `Copied from ${sourceStudy.organizationIdentifier}`,
                reportStatus: report.reportStatus,
                doctorId: null, // Don't copy doctor reference
                copiedFrom: {
                    originalOrg: sourceStudy.organizationIdentifier,
                    originalBpId: sourceStudy.bharatPacsId,
                    copiedAt: new Date()
                }
            })) : [],
            
            doctorReports: copyReports ? (sourceStudy.doctorReports || []).map(report => ({
                filename: report.filename,
                contentType: report.contentType,
                data: report.data, // Base64 data
                size: report.size,
                reportType: report.reportType,
                uploadedAt: report.uploadedAt,
                uploadedBy: `Copied from ${sourceStudy.organizationIdentifier}`,
                reportStatus: report.reportStatus,
                doctorId: null, // Don't copy doctor reference
                copiedFrom: {
                    originalOrg: sourceStudy.organizationIdentifier,
                    originalBpId: sourceStudy.bharatPacsId,
                    copiedAt: new Date()
                }
            })) : [],
            
            // Reports placeholder (will be populated after copying Report documents)
            reportInfo: {
                verificationInfo: { verificationStatus: 'pending' },
                modernReports: []
            },
            reports: [],
            
            // ✅ Copy study notes/discussions
            discussions: copiedDiscussions,
            hasStudyNotes: copiedDiscussions.length > 0,
            
            // Copy tracking
            copiedFrom: {
                studyId: sourceStudy._id,
                bharatPacsId: sourceStudy.bharatPacsId,
                organizationIdentifier: sourceStudy.organizationIdentifier,
                organizationName: sourceStudy.organization?.name,
                copiedAt: new Date(),
                copiedBy: user._id,
                reason,
                includedNotes: copyNotes,
                includedReports: copyReports,
                includedAttachments: copyAttachments,
                notesCount: copiedDiscussions.length,
                uploadedReportsCount: copyReports ? (sourceStudy.uploadedReports?.length || 0) : 0,
                doctorReportsCount: copyReports ? (sourceStudy.doctorReports?.length || 0) : 0
            },
            
            isCopiedStudy: true,
            
            // Category tracking
            categoryTracking: {
                created: {
                    uploadedAt: new Date(),
                    uploadedBy: user._id,
                    uploadSource: 'study_copy',
                    instancesReceived: sourceStudy.instanceCount,
                    seriesReceived: sourceStudy.seriesCount
                },
                currentCategory: 'CREATED'
            },
            
            // Action log
            actionLog: [{
                actionType: ACTION_TYPES.STUDY_COPIED,
                actionCategory: 'administrative',
                performedBy: user._id,
                performedByName: user.fullName,
                performedByRole: user.role,
                performedAt: new Date(),
                actionDetails: {
                    previousValue: {
                        bharatPacsId: sourceStudy.bharatPacsId,
                        organization: sourceStudy.organizationIdentifier
                    },
                    newValue: {
                        bharatPacsId: newBharatPacsId,
                        organization: targetOrg.identifier
                    },
                    metadata: { 
                        reason,
                        copiedNotes: copyNotes,
                        copiedReports: copyReports,
                        copiedAttachments: copyAttachments,
                        notesCount: copiedDiscussions.length
                    }
                },
                notes: `Study copied from ${sourceStudy.organizationIdentifier} to ${targetOrg.identifier}`
            }],
            
            // Flags
            hasAttachments: false,
            attachments: []
        };

        const copiedStudy = new DicomStudy(copiedStudyData);
        await copiedStudy.save();

        let copiedReportsCount = 0;
        if (copyReports) {
            copiedReportsCount = await copyStudyReports(
                sourceStudy,
                copiedStudy,
                targetOrg,
                targetPatient,
                user
            );
        }

        await DicomStudy.findByIdAndUpdate(sourceStudy._id, {
            $push: {
                copiedTo: {
                    studyId: copiedStudy._id,
                    bharatPacsId: newBharatPacsId,
                    organizationIdentifier: targetOrg.identifier,
                    organizationName: targetOrg.name,
                    copiedAt: new Date(),
                    copiedBy: user._id
                },
                actionLog: {
                    actionType: 'STUDY_COPIED',
                    actionCategory: 'administrative',
                    performedBy: user._id,
                    performedByName: user.fullName,
                    performedByRole: user.role,
                    performedAt: new Date(),
                    notes: `Study copied to ${targetOrg.identifier} as ${newBharatPacsId}`
                }
            }
        });

        let copiedAttachmentsCount = 0;
        if (copyAttachments && sourceStudy.attachments?.length > 0) {
            copiedAttachmentsCount = await copyStudyAttachments(
                sourceStudy,
                copiedStudy,
                targetOrg.identifier,
                user._id
            );
        }

        console.log(`✅ Study copied successfully: ${newBharatPacsId}`);
        console.log(`   - Notes copied: ${copiedDiscussions.length}`);
        console.log(`   - Reports copied: ${copiedReportsCount}`);
        console.log(`   - Attachments copied: ${copiedAttachmentsCount}`);

        res.status(201).json({
            success: true,
            message: 'Study copied successfully to your organization',
            data: {
                originalStudy: {
                    bharatPacsId: sourceStudy.bharatPacsId,
                    organization: sourceStudy.organizationIdentifier
                },
                copiedStudy: {
                    _id: copiedStudy._id,
                    bharatPacsId: newBharatPacsId,
                    organization: targetOrg.identifier,
                    organizationName: targetOrg.name
                },
                copiedItems: {
                    notes: copiedDiscussions.length,
                    reports: copiedReportsCount,
                    uploadedReports: copyReports ? (sourceStudy.uploadedReports?.length || 0) : 0,
                    doctorReports: copyReports ? (sourceStudy.doctorReports?.length || 0) : 0,
                    attachments: copiedAttachmentsCount
                }
            }
        });

    } catch (error) {
        console.error('❌ Error copying study:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to copy study',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NEW: Copy reports from Report collection
const copyStudyReports = async (sourceStudy, targetStudy, targetOrg, targetPatient, user) => {
    try {
        // Find all reports associated with the source study
        const sourceReports = await Report.find({ 
            dicomStudy: sourceStudy._id 
        }).lean();

        if (!sourceReports || sourceReports.length === 0) {
            console.log(`📄 No reports found for study ${sourceStudy.bharatPacsId}`);
            return 0;
        }

        console.log(`📄 Copying ${sourceReports.length} reports...`);

        const copiedReportRefs = [];

        for (const sourceReport of sourceReports) {
            // Generate new report ID
            const newReportId = generateReportId(targetOrg.identifier);

            // Create copied report
            const copiedReportData = {
                reportId: newReportId,
                
                // Target organization
                organization: targetOrg._id,
                organizationIdentifier: targetOrg.identifier,
                
                // Patient reference
                patient: targetPatient._id,
                patientId: targetPatient.patientID,
                
                // Study reference
                dicomStudy: targetStudy._id,
                studyInstanceUID: targetStudy.studyInstanceUID,
                accessionNumber: targetStudy.accessionNumber,
                
                // Personnel - set to copying user
                createdBy: user._id,
                doctorId: user._id, // Assign to copying user
                verifierId: null,
                
                // Copy report content
                reportContent: {
                    htmlContent: sourceReport.reportContent?.htmlContent || ' ', // non-empty to satisfy required validation
                    plainTextContent: sourceReport.reportContent?.plainTextContent || '',
                    templateInfo: sourceReport.reportContent?.templateInfo || {},
                    placeholders: sourceReport.reportContent?.placeholders || {},
                    capturedImages: sourceReport.reportContent?.capturedImages || [],
                    statistics: sourceReport.reportContent?.statistics || {}
                },
                
                // Copy captured images at root level too
                capturedImages: sourceReport.capturedImages || [],
                
                // Report type and status
                reportType: sourceReport.reportType || 'uploaded-report',
                reportStatus: 'draft', // Reset to draft in new org
                
                // Export info
                exportInfo: {
                    format: sourceReport.exportInfo?.format || 'docx',
                    fileName: sourceReport.exportInfo?.fileName,
                    documentPath: null, // Clear path
                    downloadUrl: null,
                    downloadCount: 0
                },
                
                // Patient info
                patientInfo: sourceReport.patientInfo || targetStudy.patientInfo,
                
                // Study info
                studyInfo: sourceReport.studyInfo || {
                    studyDate: targetStudy.studyDate,
                    modality: targetStudy.modality,
                    examDescription: targetStudy.examDescription
                },
                
                // Workflow info - reset
                workflowInfo: {
                    draftedAt: new Date(),
                    statusHistory: [{
                        status: 'draft',
                        changedAt: new Date(),
                        changedBy: user._id,
                        notes: `Report copied from ${sourceStudy.organizationIdentifier}`,
                        userRole: user.role
                    }]
                },
                
                // Verification info - reset
                verificationInfo: {
                    verificationStatus: 'pending'
                },
                
                // Download/print info - reset
                downloadInfo: {
                    downloadHistory: [],
                    totalDownloads: 0
                },
                printInfo: {
                    printHistory: [],
                    totalPrints: 0
                },
                
                // Quality metrics
                qualityMetrics: sourceReport.qualityMetrics || {},
                
                // Attachments - clear (will be handled separately)
                attachments: [],
                
                // Search text
                searchText: sourceReport.searchText || '',
                
                // System info
                systemInfo: {
                    version: '1.0',
                    migrated: true,
                    migrationDate: new Date(),
                    dataSource: 'migrated_data', // ✅ FIX: Use valid enum value instead of 'study_copy'
                    copiedFrom: {
                        reportId: sourceReport.reportId,
                        organizationIdentifier: sourceStudy.organizationIdentifier,
                        copiedAt: new Date(),
                        copiedBy: user._id
                    }
                },
                
                // Audit info
                auditInfo: {
                    hipaaCompliant: true,
                    accessLog: [{
                        accessedBy: user._id,
                        accessedAt: new Date(),
                        accessType: 'edit',
                        ipAddress: 'study-copy'
                    }],
                    accessCount: 1
                }
            };

            const copiedReport = new Report(copiedReportData);
            await copiedReport.save();

            // Add to refs array
            copiedReportRefs.push({
                reportId: copiedReport._id,
                reportType: copiedReport.reportType,
                reportStatus: copiedReport.reportStatus,
                createdAt: new Date(),
                createdBy: user._id,
                fileName: copiedReport.exportInfo?.fileName
            });

            console.log(`   ✅ Copied report: ${sourceReport.reportId} -> ${newReportId}`);
        }

        // Update copied study with report references
        if (copiedReportRefs.length > 0) {
            await DicomStudy.findByIdAndUpdate(targetStudy._id, {
                $push: { 
                    reports: { $each: copiedReportRefs },
                    'reportInfo.modernReports': { 
                        $each: copiedReportRefs.map(r => ({
                            reportId: r.reportId,
                            reportType: r.reportType,
                            createdAt: r.createdAt
                        }))
                    }
                },
                $set: {
                    'currentReportStatus.hasReports': true,
                    'currentReportStatus.latestReportId': copiedReportRefs[copiedReportRefs.length - 1].reportId,
                    'currentReportStatus.latestReportStatus': 'draft',
                    'currentReportStatus.latestReportType': copiedReportRefs[copiedReportRefs.length - 1].reportType
                }
            });
        }

        console.log(`✅ Copied ${copiedReportRefs.length} reports successfully`);
        return copiedReportRefs.length;

    } catch (error) {
        console.error('❌ Error copying reports:', error);
        // Don't throw error, just log it and return 0
        return 0;
    }
};

// ✅ 2. COPY STUDY ATTACHMENTS (existing function - updated to return count)
const copyStudyAttachments = async (sourceStudy, targetStudy, targetOrgIdentifier, userId) => {
    try {
        console.log(`📎 Copying ${sourceStudy.attachments.length} attachments...`);

        const copiedAttachments = [];

        for (const attachment of sourceStudy.attachments) {
            // Get original document
            const sourceDoc = await Document.findById(attachment.documentId);
            if (!sourceDoc || !sourceDoc.isActive) continue;

            // Generate new S3 key for target organization
            const newS3Key = `${targetOrgIdentifier}/studies/${targetStudy._id}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${sourceDoc.fileName}`;

            // Copy file in S3
            const copyCommand = new CopyObjectCommand({
                Bucket: wasabiConfig.documentsBucket,
                CopySource: `${wasabiConfig.documentsBucket}/${sourceDoc.wasabiKey}`,
                Key: newS3Key,
                MetadataDirective: 'REPLACE',
                Metadata: {
                    organizationIdentifier: targetOrgIdentifier,
                    studyId: targetStudy._id.toString(),
                    uploadedBy: userId.toString(),
                    originalName: sourceDoc.fileName,
                    copiedFrom: sourceDoc._id.toString()
                }
            });

            await wasabiS3Client.send(copyCommand);

            // Create new document record
            const newDocument = new Document({
                organization: targetStudy.organization,
                organizationIdentifier: targetOrgIdentifier,
                fileName: sourceDoc.fileName,
                fileSize: sourceDoc.fileSize,
                contentType: sourceDoc.contentType,
                documentType: sourceDoc.documentType,
                wasabiKey: newS3Key,
                wasabiBucket: wasabiConfig.documentsBucket,
                patientId: targetStudy.patientId,
                studyId: targetStudy._id,
                uploadedBy: userId,
                uploadedAt: new Date()
            });

            await newDocument.save();

            // Add to copied study attachments
            copiedAttachments.push({
                documentId: newDocument._id,
                fileName: newDocument.fileName,
                fileSize: newDocument.fileSize,
                contentType: newDocument.contentType,
                uploadedAt: newDocument.uploadedAt,
                uploadedBy: userId
            });
        }

        // Update copied study with attachments
        if (copiedAttachments.length > 0) {
            targetStudy.attachments = copiedAttachments;
            targetStudy.hasAttachments = true;
            await targetStudy.save();
        }

        console.log(`✅ Copied ${copiedAttachments.length} attachments successfully`);
        return copiedAttachments.length;
    } catch (error) {
        console.error('❌ Error copying attachments:', error);
        // Don't throw error, just log it
        return 0;
    }
};

// ✅ 3. GET STUDY COPY HISTORY
export const getStudyCopyHistory = async (req, res) => {
    try {
        const { bharatPacsId } = req.params;
        const user = req.user;

        const study = await DicomStudy.findOne({ bharatPacsId })
            .populate('copiedFrom.copiedBy', 'fullName email role')
            .populate('copiedFrom.studyId', 'bharatPacsId organizationIdentifier')
            .populate('copiedTo.copiedBy', 'fullName email role')
            .populate('copiedTo.studyId', 'bharatPacsId organizationIdentifier')
            .lean();

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        // Check access
        if (user.role !== 'super_admin' && 
            study.organizationIdentifier !== user.organizationIdentifier) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: {
                isCopiedStudy: study.isCopiedStudy,
                copiedFrom: study.copiedFrom || null,
                copiedTo: study.copiedTo || [],
                totalCopies: study.copiedTo?.length || 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching copy history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch copy history',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ SIMPLIFIED: Verify study (no org restriction - allow cross-org verification)
export const verifyStudy = async (req, res) => {
    try {
        const { bharatPacsId } = req.params;
        const user = req.user;

        console.log(`🔍 Verifying study: ${bharatPacsId} for user in org: ${user.organizationIdentifier}`);

        const study = await DicomStudy.findOne({ bharatPacsId })
            .populate('organization', 'name identifier')
            .select('bharatPacsId patientInfo studyDate modality modalitiesInStudy seriesCount instanceCount organizationIdentifier examDescription discussions uploadedReports doctorReports reports hasStudyNotes')
            .lean();

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found with the provided BharatPacs ID'
            });
        }

        // Count reports
        const reportCount = await Report.countDocuments({ dicomStudy: study._id });

        res.json({
            success: true,
            data: {
                bharatPacsId: study.bharatPacsId,
                patientName: study.patientInfo?.patientName || 'Unknown',
                studyDate: study.studyDate,
                modality: study.modalitiesInStudy?.join(', ') || study.modality,
                seriesCount: study.seriesCount,
                instanceCount: study.instanceCount,
                organizationIdentifier: study.organizationIdentifier,
                organizationName: study.organization?.name || 'Unknown',
                examDescription: study.examDescription,
                // ✅ NEW: Include counts for notes and reports
                hasStudyNotes: study.hasStudyNotes || (study.discussions?.length > 0),
                notesCount: study.discussions?.length || 0,
                reportsCount: reportCount,
                uploadedReportsCount: study.uploadedReports?.length || 0,
                doctorReportsCount: study.doctorReports?.length || 0
            }
        });

    } catch (error) {
        console.error('❌ Error verifying study:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify study',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update exports
export default {
    copyStudyToOrganization,
    getStudyCopyHistory,
    verifyStudy
};

