import DicomStudy from '../models/dicomStudyModel.js';
import Patient from '../models/patientModel.js';
import User from '../models/userModel.js';
import Lab from '../models/labModel.js';
import mongoose from 'mongoose';

// ✅ GET DETAILED STUDY VIEW
export const getStudyDetailedView = async (req, res) => {
    try {
        const { studyId } = req.params;
        const currentUser = req.user;

        console.log(`🔍 Fetching detailed view for study: ${studyId}`);

        // Validate studyId
        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid study ID format'
            });
        }

        // ✅ COMPREHENSIVE STUDY QUERY with all related data
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: currentUser.organizationIdentifier
        })
        .populate({
            path: 'patient',
            select: 'patientID firstName lastName dateOfBirth gender phone email address patientName patientNameRaw clinicalHistory'
        })
        .populate({
            path: 'sourceLab',
            select: 'name identifier contactPerson contactEmail contactPhone address'
        })
        .populate({
            path: 'assignment.assignedTo',
            select: 'fullName email role username'
        })
        .populate({
            path: 'assignment.assignedBy',
            select: 'fullName email role'
        })
        .populate({
            path: 'statusHistory.changedBy',
            select: 'fullName email role'
        })
        .populate({
            path: 'discussions.userId',
            select: 'fullName email role'
        })
        .lean();

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        // ✅ CHECK ACCESS PERMISSIONS
        const hasAccess = await checkStudyAccess(currentUser, study);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this study'
            });
        }

        // ✅ FORMAT COMPREHENSIVE STUDY DATA
        const detailedStudy = formatDetailedStudyData(study);

        // ✅ GET ADDITIONAL METADATA
        const metadata = await getStudyMetadata(study);

        // ✅ GET RELATED STUDIES (same patient)
        const relatedStudies = await getRelatedStudies(study.patient._id, study._id, currentUser.organizationIdentifier);

        console.log(`✅ Successfully fetched detailed view for study: ${studyId}`);

        res.json({
            success: true,
            data: {
                study: detailedStudy,
                metadata,
                relatedStudies,
                permissions: getUserStudyPermissions(currentUser, study)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching study detailed view:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch study details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ UPDATE CLINICAL HISTORY
export const updateStudyClinicalHistory = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { clinicalHistory, previousInjury, previousSurgery } = req.body;
        const currentUser = req.user;

        console.log(`🔄 Updating clinical history for study: ${studyId}`);

        // Validate studyId
        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid study ID format'
            });
        }

        // Find study and check access
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: currentUser.organizationIdentifier
        });

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        // Check permissions
        if (!currentUser.permissions?.canEditCases && !['admin', 'super_admin'].includes(currentUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions to edit clinical history'
            });
        }

        // ✅ UPDATE CLINICAL HISTORY
        const updateData = {
            'clinicalHistory.clinicalHistory': clinicalHistory || '',
            'clinicalHistory.previousInjury': previousInjury || '',
            'clinicalHistory.previousSurgery': previousSurgery || '',
            'clinicalHistory.lastModifiedBy': currentUser._id,
            'clinicalHistory.lastModifiedAt': new Date(),
            'clinicalHistory.lastModifiedFrom': 'study_detail',
            'clinicalHistory.dataSource': 'user_input'
        };

        const updatedStudy = await DicomStudy.findByIdAndUpdate(
            studyId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('clinicalHistory.lastModifiedBy', 'fullName email');

        // ✅ ADD TO STATUS HISTORY
        await DicomStudy.findByIdAndUpdate(studyId, {
            $push: {
                statusHistory: {
                    status: 'clinical_history_updated',
                    changedAt: new Date(),
                    changedBy: currentUser._id,
                    note: 'Clinical history updated via detailed view'
                }
            }
        });

        console.log(`✅ Clinical history updated for study: ${studyId}`);

        res.json({
            success: true,
            message: 'Clinical history updated successfully',
            data: {
                clinicalHistory: updatedStudy.clinicalHistory,
                updatedAt: updatedStudy.clinicalHistory.lastModifiedAt,
                updatedBy: updatedStudy.clinicalHistory.lastModifiedBy
            }
        });

    } catch (error) {
        console.error('❌ Error updating clinical history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update clinical history',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ UPDATE PATIENT INFORMATION
export const updateStudyPatientInfo = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { patientID, fullName, age, gender, phone, email } = req.body;
        const currentUser = req.user;

        console.log(`🔄 Updating patient info for study: ${studyId}`);

        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid study ID format'
            });
        }

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: currentUser.organizationIdentifier
        }).populate('patient');

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        if (!currentUser.permissions?.canEditCases && !['admin', 'super_admin'].includes(currentUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        // Update patient info
        const updatedPatient = await Patient.findByIdAndUpdate(
            study.patient._id,
            {
                patientID,
                patientName: fullName,
                dateOfBirth: age ? new Date(new Date().getFullYear() - age, 0, 1) : study.patient.dateOfBirth,
                gender,
                phone,
                email
            },
            { new: true }
        );

        console.log(`✅ Patient info updated for study: ${studyId}`);

        res.json({
            success: true,
            message: 'Patient information updated successfully',
            data: {
                patient: {
                    patientID: updatedPatient.patientID,
                    fullName: updatedPatient.patientName,
                    age: calculateAge(updatedPatient.dateOfBirth),
                    gender: updatedPatient.gender,
                    phone: updatedPatient.phone,
                    email: updatedPatient.email
                }
            }
        });

    } catch (error) {
        console.error('❌ Error updating patient info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update patient information',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ UPDATE STUDY DETAILS
export const updateStudyDetails = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { examDescription, modality, accessionNumber, priority } = req.body;
        const currentUser = req.user;

        console.log(`🔄 Updating study details for: ${studyId}`);

        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid study ID format'
            });
        }

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: currentUser.organizationIdentifier
        });

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        if (!currentUser.permissions?.canEditCases && !['admin', 'super_admin'].includes(currentUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        // Update study details
        const updatedStudy = await DicomStudy.findByIdAndUpdate(
            studyId,
            {
                examDescription,
                modality,
                accessionNumber,
                studyPriority: priority
            },
            { new: true }
        );

        console.log(`✅ Study details updated for: ${studyId}`);

        res.json({
            success: true,
            message: 'Study details updated successfully',
            data: {
                studyDetails: {
                    examDescription: updatedStudy.examDescription,
                    modality: updatedStudy.modality
                },
                accessionNumber: updatedStudy.accessionNumber,
                workflow: {
                    priority: updatedStudy.studyPriority
                }
            }
        });

    } catch (error) {
        console.error('❌ Error updating study details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update study details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ HELPER FUNCTIONS

// Check if user has access to study
const checkStudyAccess = async (user, study) => {
    // Super admin and admin have full access
    if (['super_admin', 'admin'].includes(user.role)) {
        return true;
    }

    // Check organization match
    if (user.organizationIdentifier !== study.organizationIdentifier) {
        return false;
    }

    // Role-specific access checks
    switch (user.role) {
        case 'radiologist':
            return study.assignment?.some(assign => 
                assign.assignedTo?._id?.toString() === user._id.toString()
            );
        case 'verifier':
            return study.assignment?.some(assign => 
                user.roleConfig?.assignedRadiologists?.includes(assign.assignedTo?._id)
            );
        case 'physician':
            return study.referringPhysician?.id === user._id.toString();
        case 'assignor':
        case 'receptionist':
        case 'billing':
            return true; // These roles can view all studies in their organization
        default:
            return user.permissions?.canViewCases || false;
    }
};

// Format comprehensive study data
const formatDetailedStudyData = (study) => {
    return {
        // ✅ BASIC STUDY INFORMATION
        _id: study._id,
        studyInstanceUID: study.studyInstanceUID,
        orthancStudyID: study.orthancStudyID,
        accessionNumber: study.accessionNumber,
        
        // ✅ PATIENT INFORMATION
        patient: {
            _id: study.patient?._id,
            patientID: study.patient?.patientID || study.patientId,
            firstName: study.patient?.firstName,
            lastName: study.patient?.lastName,
            fullName: study.patient?.patientName || study.patient?.patientNameRaw || 
                     `${study.patient?.firstName || ''} ${study.patient?.lastName || ''}`.trim(),
            dateOfBirth: study.patient?.dateOfBirth,
            age: calculateAge(study.patient?.dateOfBirth),
            gender: study.patient?.gender || study.patientInfo?.gender,
            phone: study.patient?.phone,
            email: study.patient?.email,
            address: study.patient?.address
        },

        // ✅ STUDY DETAILS
        studyDetails: {
            studyDate: study.studyDate,
            studyTime: study.studyTime,
            modality: study.modality,
            modalitiesInStudy: study.modalitiesInStudy,
            examDescription: study.examDescription,
            seriesCount: study.seriesCount,
            instanceCount: study.instanceCount,
            seriesImages: study.seriesImages,
            institutionName: study.institutionName
        },

        // ✅ WORKFLOW INFORMATION
        workflow: {
            status: study.workflowStatus,
            currentCategory: study.currentCategory,
            priority: study.studyPriority,
            caseType: study.caseType,
            generated: study.generated,
            reportAvailable: study.ReportAvailable
        },

        // ✅ ASSIGNMENT INFORMATION
        assignments: study.assignment?.map(assign => ({
            assignedTo: {
                _id: assign.assignedTo?._id,
                name: assign.assignedTo?.fullName,
                email: assign.assignedTo?.email,
                role: assign.assignedTo?.role
            },
            assignedBy: {
                _id: assign.assignedBy?._id,
                name: assign.assignedBy?.fullName,
                email: assign.assignedBy?.email
            },
            assignedAt: assign.assignedAt,
            dueDate: assign.dueDate,
            priority: assign.priority,
            status: assign.status
        })) || [],

        // ✅ LAB INFORMATION
        lab: study.sourceLab ? {
            _id: study.sourceLab._id,
            name: study.sourceLab.name,
            identifier: study.sourceLab.identifier,
            contactPerson: study.sourceLab.contactPerson,
            contactEmail: study.sourceLab.contactEmail,
            contactPhone: study.sourceLab.contactPhone,
            address: study.sourceLab.address
        } : null,

        // ✅ CLINICAL HISTORY
        clinicalHistory: {
            clinicalHistory: study.clinicalHistory?.clinicalHistory || '',
            previousInjury: study.clinicalHistory?.previousInjury || '',
            previousSurgery: study.clinicalHistory?.previousSurgery || '',
            lastModifiedBy: study.clinicalHistory?.lastModifiedBy,
            lastModifiedAt: study.clinicalHistory?.lastModifiedAt,
            lastModifiedFrom: study.clinicalHistory?.lastModifiedFrom,
            dataSource: study.clinicalHistory?.dataSource
        },

        // ✅ PHYSICIAN INFORMATION
        physicians: {
            referring: study.physicians?.referring || {
                name: study.referringPhysicianName || study.referringPhysician?.name,
                institution: study.referringPhysician?.institution,
                contactInfo: study.referringPhysician?.contactInfo
            },
            requesting: study.physicians?.requesting
        },

        // ✅ TECHNOLOGIST INFORMATION
        technologist: study.technologist,

        // ✅ TIMING INFORMATION
        timing: {
            createdAt: study.createdAt,
            updatedAt: study.updatedAt,
            modifiedDate: study.modifiedDate,
            reportDate: study.reportDate,
            timingInfo: study.timingInfo,
            calculatedTAT: study.calculatedTAT
        },

        // ✅ REPORTS
        reports: {
            uploaded: study.uploadedReports?.map(report => ({
                filename: report.filename,
                contentType: report.contentType,
                size: report.size,
                reportType: report.reportType,
                uploadedAt: report.uploadedAt,
                uploadedBy: report.uploadedBy,
                reportStatus: report.reportStatus,
                doctorId: report.doctorId
            })) || [],
            doctor: study.doctorReports?.map(report => ({
                filename: report.filename,
                contentType: report.contentType,
                size: report.size,
                reportType: report.reportType,
                uploadedAt: report.uploadedAt,
                uploadedBy: report.uploadedBy,
                reportStatus: report.reportStatus,
                doctorId: report.doctorId
            })) || [],
            info: study.reportInfo
        },

        // ✅ DISCUSSIONS
        discussions: study.discussions?.map(discussion => ({
            _id: discussion._id,
            comment: discussion.comment,
            userName: discussion.userName,
            userRole: discussion.userRole,
            user: discussion.userId ? {
                _id: discussion.userId._id,
                name: discussion.userId.fullName,
                email: discussion.userId.email
            } : null,
            dateTime: discussion.dateTime
        })) || [],

        // ✅ STATUS HISTORY
        statusHistory: study.statusHistory?.map(history => ({
            status: history.status,
            changedAt: history.changedAt,
            changedBy: history.changedBy ? {
                _id: history.changedBy._id,
                name: history.changedBy.fullName,
                email: history.changedBy.email
            } : null,
            note: history.note
        })) || [],

        // ✅ DICOM FILES
        dicomFiles: study.dicomFiles || [],

        // ✅ DOWNLOAD INFORMATION
        preProcessedDownload: study.preProcessedDownload
    };
};

// Get study metadata
const getStudyMetadata = async (study) => {
    const now = new Date();
    
    return {
        createdDaysAgo: Math.floor((now - new Date(study.createdAt)) / (1000 * 60 * 60 * 24)),
        studyDaysAgo: study.studyDate ? Math.floor((now - new Date(study.studyDate)) / (1000 * 60 * 60 * 24)) : null,
        isOverdue: study.calculatedTAT?.isOverdue || false,
        assignmentCount: study.assignment?.length || 0,
        reportCount: (study.uploadedReports?.length || 0) + (study.doctorReports?.length || 0),
        discussionCount: study.discussions?.length || 0,
        statusChanges: study.statusHistory?.length || 0,
        lastActivity: getLastActivity(study),
        urgency: getUrgencyLevel(study)
    };
};

// Get related studies for the same patient
const getRelatedStudies = async (patientId, currentStudyId, organizationIdentifier) => {
    return await DicomStudy.find({
        patient: patientId,
        _id: { $ne: currentStudyId },
        organizationIdentifier: organizationIdentifier
    })
    .select('studyInstanceUID studyDate modality examDescription workflowStatus ReportAvailable createdAt')
    .sort({ studyDate: -1 })
    .limit(10)
    .lean();
};

// Get user permissions for this study
const getUserStudyPermissions = (user, study) => {
    const isAssigned = study.assignment?.some(assign => 
        assign.assignedTo?._id?.toString() === user._id.toString()
    );
    
    return {
        canView: true, // If they got this far, they can view
        canEdit: user.permissions?.canEditCases || ['admin', 'super_admin'].includes(user.role),
        canEditClinicalHistory: user.permissions?.canEditCases || ['admin', 'super_admin', 'radiologist', 'assignor'].includes(user.role),
        canCreateReport: (user.permissions?.canCreateReports && isAssigned) || ['admin', 'super_admin'].includes(user.role),
        canDownload: user.permissions?.canDownloadReports || ['admin', 'super_admin'].includes(user.role),
        canDiscuss: user.permissions?.canViewCases || ['admin', 'super_admin'].includes(user.role),
        canAssign: user.permissions?.canAssignCases || ['admin', 'super_admin', 'assignor'].includes(user.role),
        isAssigned: isAssigned
    };
};

// Helper to calculate age
const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
};

// Get last activity timestamp
const getLastActivity = (study) => {
    const activities = [
        study.updatedAt,
        study.reportInfo?.finalizedAt,
        ...(study.discussions?.map(d => d.dateTime) || []),
        ...(study.statusHistory?.map(h => h.changedAt) || [])
    ].filter(Boolean);
    
    if (activities.length === 0) return study.createdAt;
    
    return new Date(Math.max(...activities.map(d => new Date(d))));
};

// Get urgency level
const getUrgencyLevel = (study) => {
    if (study.assignment?.some(a => a.priority === 'URGENT') || 
        study.studyPriority === 'Emergency Case' ||
        study.caseType === 'emergency') {
        return 'emergency';
    }
    
    if (study.assignment?.some(a => a.priority === 'HIGH') ||
        study.studyPriority === 'MLC Case') {
        return 'high';
    }
    
    return 'normal';
};