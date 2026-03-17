// models/DicomStudy.model.js
import mongoose from 'mongoose';

// ✅ NEW: Action types enum for comprehensive tracking
const ACTION_TYPES = {
    // Upload & Ingestion
    STUDY_UPLOADED: 'study_uploaded',
    STUDY_RECEIVED: 'study_received',
    METADATA_EXTRACTED: 'metadata_extracted',
    
    // History & Clinical
    HISTORY_CREATED: 'history_created',
    HISTORY_UPDATED: 'history_updated',
    CLINICAL_NOTES_ADDED: 'clinical_notes_added',
    
    // Assignment
    STUDY_ASSIGNED: 'study_assigned',
    STUDY_REASSIGNED: 'study_reassigned',
    ASSIGNMENT_ACCEPTED: 'assignment_accepted',
    ASSIGNMENT_REJECTED: 'assignment_rejected',
    
    // Study Lock
    STUDY_LOCKED: 'study_locked',
    STUDY_UNLOCKED: 'study_unlocked',
    LOCK_TRANSFERRED: 'lock_transferred',
    
    // Report Actions
    REPORT_STARTED: 'report_started',
    REPORT_DRAFTED: 'report_drafted',
    REPORT_SAVED: 'report_saved',
    REPORT_FINALIZED: 'report_finalized',
    REPORT_VERIFIED: 'report_verified',
    REPORT_REVERTED: 'report_reverted',
    REPORT_RESOLVED: 'report_resolved',
    REPORT_REJECTED: 'report_rejected',
    REPORT_REPRINT_NEEDED: 'report_reprint_needed',
    
    // Print Actions
    REPORT_PRINTED: 'report_printed',
    REPORT_REPRINTED: 'report_reprinted',
    REPORT_DOWNLOADED: 'report_downloaded',
    
    // Workflow
    STATUS_CHANGED: 'status_changed',
    PRIORITY_CHANGED: 'priority_changed',
    STUDY_OPENED: 'study_opened',
    STUDY_VIEWED: 'study_viewed',
        STUDY_COPIED: 'study_copied',

    
    // Administrative
    STUDY_DELETED: 'study_deleted',
    STUDY_ARCHIVED: 'study_archived',
    STUDY_RESTORED: 'study_restored',
    NOTES_ADDED: 'notes_added',
    ATTACHMENT_ADDED: 'attachment_added'
};

const DicomStudySchema = new mongoose.Schema({
    // ✅ NEW: BharatPacs ID - Auto-generated unique identifier
    bharatPacsId: {
        type: String,
        unique: true,
        sparse: true,
        index: { background: true }
    },
    
    studyInstanceUID: {
        type: String,
        // unique: true,
        index: { background: true } 
    },

    copiedFrom: {
    studyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DicomStudy'
    },
    bharatPacsId: String,
    organizationIdentifier: String,
    organizationName: String,
    copiedAt: Date,
    copiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reason: String
},

copiedTo: [{
    studyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DicomStudy'
    },
    bharatPacsId: String,
    organizationIdentifier: String,
    organizationName: String,
    copiedAt: Date,
    copiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}],

isCopiedStudy: {
    type: Boolean,
    default: false,
    index: { background: true }
},
    
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: { background: true } 
    },
    organizationIdentifier: {
        type: String,
        required: true,
        index: { background: true } 
    },
    
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        index: { background: true } 
    },
    patientId: { 
        type: String, 
        required: true,
        index: { background: true } 
    },
    
    patientInfo: {
        patientID: { type: String, index: { sparse: true, background: true } },
        patientName: { type: String, index: { sparse: true, background: true } },
        age: String,
        gender: { type: String, index: { sparse: true, background: true } }
    },

    studyDate: { 
        type: Date, 
        index: { background: true },
        default: Date.now
    },
    modality: { 
        type: String, 
        index: { background: true },
        enum: ['CT', 'MRI', 'MR', 'XR', 'US', 'DX', 'CR', 'MG', 'NM', 'PT', 'RF', 'RTSTRUCT', 'RTDOSE', 'RTPLAN', 'OT', 'SR', 'SC', 'ECG', 'EPS', 'HD', 'IO', 'IVUS', 'KER', 'LEN', 'OAM', 'OP', 'PR', 'PROSPECTIVE_SERIES', 'SEG', 'SM', 'SRF', 'STAIN', 'US_MSK', 'XA'],
        default: 'CT'
    },
    accessionNumber: { 
        type: String, 
        index: { sparse: true, background: true }
    },
    age: { type: String },
    gender: { type: String },

    // ✅ ENHANCED: Extended workflow statuses matching your categories
    workflowStatus: {
        type: String,
        enum: [
            'no_active_study',
            // CREATED
            'new_study_received',
            'metadata_extracted',
            
            // HISTORY CREATED
            'history_pending',
            'history_created',
            'history_verified',
            
            // UNASSIGNED
            'pending_assignment',
            'awaiting_radiologist',
            
            // ASSIGNED
            'assigned_to_doctor',
            'assignment_accepted',
            
            // PENDING
            'doctor_opened_report',
            'report_in_progress',
            'pending_completion',
            
            // DRAFT
            'report_drafted',
            'draft_saved',
            
            // VERIFICATION PENDING
            'verification_pending',
            'verification_in_progress',
            
            // FINAL
            'report_finalized',
            'final_approved',
            'revert_to_radiologist', // ✅ NEW
            'report_reprint_needed',
            'report_completed', 
            
            // URGENT
            'urgent_priority',
            'emergency_case',
            
            // REPRINT NEED
            'reprint_requested',
            'correction_needed',
            
            // Download/Archive statuses
            'report_uploaded',
            'report_downloaded_radiologist',
            'report_downloaded',
            'final_report_downloaded',
            'report_verified',
            'report_rejected',
            'archived'
        ],
        default: 'new_study_received',
        index: { background: true }
    },

    ohif:{
        type: String,
        default: 'ohif1'

    },

    notesCount:{
        type: Number,
        default: 0
    },

    currentCategory: {
        type: String,
        enum: [
            'ALL',
            'CREATED',
            'HISTORY_CREATED',
            'UNASSIGNED',
            'ASSIGNED',
            'PENDING',
            'DRAFT',
            'VERIFICATION_PENDING',
            "verification_pending",
            'REVERTED', // ✅ NEW - For studies reverted back to radiologist
            'FINAL',
            'COMPLETED', // ✅ ADD THIS - Maps to report_completed status
            'REPRINT',
            'URGENT',
            'REPRINT_NEED'
        ],
        default: 'CREATED',
        index: { background: true }
    },

    reprintNeeded: {
        type: Boolean,
        default: false,
    },
    
    generated: {
        type: String,
        enum: ['yes', 'no'],
        default: 'no',
        index: { sparse: true, background: true }
    },

    // ✅ NEW: Study Lock Management
    studyLock: {
        isLocked: {
            type: Boolean,
            default: false,
            index: { background: true }
        },
        lockedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            sparse: true,
            index: { sparse: true, background: true }
        },
        lockedByName: {
            type: String
        },
        lockedByRole: {
            type: String,
            enum: ['admin', 'assignor', 'doctor_account', 'radiologist', 'verifier', 'lab_staff'] // ✅ Added 'assignor'
        },
        lockedAt: {
            type: Date,
            index: { sparse: true, background: true }
        },
        lockReason: {
            type: String,
            enum: ['reporting', 'verification', 'review', 'correction', 'administrative'],
            default: 'reporting'
        },
        lockExpiry: {
            type: Date // Auto-unlock after certain time
        },
        previousLocks: [{
            lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            lockedByName: String,
            lockedAt: Date,
            unlockedAt: Date,
            lockDuration: Number, // in minutes
            lockReason: String
        }]
    },

    // ✅ NEW: Comprehensive Action Log
    actionLog: [{
        actionType: {
            type: String,
            enum: Object.values(ACTION_TYPES),
            required: true,
            index: { background: true }
        },
        actionCategory: {
            type: String,
            enum: ['upload', 'history', 'assignment', 'lock', 'report', 'print', 'workflow', 'administrative'],
            required: true
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        performedByName: {
            type: String,
            required: true
        },
        performedByRole: {
            type: String,
            enum: ['admin', 'assignor', 'doctor_account', 'radiologist', 'verifier', 'lab_staff', 'technician', 'system']
        },
        performedAt: {
            type: Date,
            default: Date.now,
            index: { background: true }
        },
        // For actions involving another user (assignment, lock transfer, etc.)
        targetUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        targetUserName: {
            type: String
        },
        targetUserRole: {
            type: String
        },
        // Action details
        actionDetails: {
            previousValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
            changes: mongoose.Schema.Types.Mixed,
            metadata: mongoose.Schema.Types.Mixed
        },
        // Print-specific tracking
        printInfo: {
            printCount: Number,
            isPrintOriginal: Boolean,
            printMethod: String, // 'pdf', 'physical', 'email'
            printerName: String,
            copies: Number
        },
        // History-specific tracking
        historyInfo: {
            clinicalHistoryUpdated: Boolean,
            previousInjuryUpdated: Boolean,
            previousSurgeryUpdated: Boolean,
            source: String // 'patient_modal', 'study_detail', 'admin_panel'
        },
        // Assignment-specific tracking
        assignmentInfo: {
            assignmentType: String, // 'initial', 'reassignment', 'transfer'
            previousAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            priority: String,
            dueDate: Date
        },
        notes: {
            type: String,
            maxlength: 2000
        },
        ipAddress: String,
        userAgent: String,
        sessionId: String
    }],

    // ✅ NEW: Category-specific tracking
    categoryTracking: {
        // CREATED tracking
        created: {
            uploadedAt: Date,
            uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            uploadSource: String, // 'orthanc', 'dicom_upload', 'manual'
            instancesReceived: Number,
            seriesReceived: Number
        },
        
        // HISTORY CREATED tracking
        historyCreated: {
            createdAt: Date,
            createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            lastUpdatedAt: Date,
            lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            isComplete: { type: Boolean, default: false },
            verifiedAt: Date,
            verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        },
        
        // UNASSIGNED tracking
        unassigned: {
            waitingSince: Date,
            escalatedAt: Date,
            escalationCount: { type: Number, default: 0 },
            autoAssignmentAttempts: { type: Number, default: 0 }
        },
        
        // ASSIGNED tracking
        assigned: {
            assignedAt: Date,
            assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            acceptedAt: Date,
            assignmentHistory: [{
                assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                assignedAt: Date,
                unassignedAt: Date,
                reason: String
            }]
        },
        
        // PENDING tracking
        pending: {
            startedAt: Date,
            lastActivityAt: Date,
            estimatedCompletionTime: Date,
            remindersSent: { type: Number, default: 0 }
        },
        
        // DRAFT tracking
        draft: {
            draftCreatedAt: Date,
            draftSavedAt: Date,
            draftVersion: { type: Number, default: 1 },
            autosaveCount: { type: Number, default: 0 },
            lastAutosaveAt: Date
        },
        
        // VERIFICATION PENDING tracking
        verificationPending: {
            submittedForVerificationAt: Date,
            submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            verifier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            verificationStartedAt: Date,
            verificationDeadline: Date
        },
        
        // FINAL tracking
        final: {
            finalizedAt: Date,
            finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            approvedAt: Date,
            approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            signedDigitally: { type: Boolean, default: false },
            digitalSignature: String
        },
        
        // URGENT tracking
        urgent: {
            markedUrgentAt: Date,
            markedUrgentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            urgentReason: String,
            urgentLevel: { type: String, enum: ['high', 'critical', 'emergency'] },
            escalationPath: [String],
            resolvedAt: Date
        },
        
        // REPRINT tracking
        reprint: {
            reprintRequestedAt: Date,
            reprintRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            reprintReason: String,
            correctionDetails: String,
            originalPrintDate: Date,
            reprintCount: { type: Number, default: 0 },
            reprintHistory: [{
                reprintedAt: Date,
                reprintedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                reason: String,
                changes: String
            }]
        }
    },

    // ✅ ENHANCED: Print tracking with detailed history
    printHistory: [{
        printedAt: {
            type: Date,
            default: Date.now
        },
        printedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        printedByName: String,
        printType: {
            type: String,
            enum: ['original', 'reprint', 'copy', 'draft'],
            default: 'original'
        },
        printMethod: {
            type: String,
            enum: ['pdf_download', 'physical_print', 'email', 'fax'],
            default: 'pdf_download'
        },
        reportVersion: Number,
        reportStatus: {
            type: String,
            enum: ['draft', 'finalized', 'verified']
        },
        copies: {
            type: Number,
            default: 1
        },
        printerName: String,
        recipientEmail: String,
        faxNumber: String,
        printReason: String,
        reprintReason: String, // For reprints
        bharatPacsId: String, // Reference to study
        watermark: String, // 'ORIGINAL', 'REPRINT', 'COPY', 'DRAFT'
        ipAddress: String,
        userAgent: String
    }],

    technologist: {
        name: { type: String, trim: true },
        mobile: { type: String, trim: true },
        comments: { type: String, trim: true },
        reasonToSend: { type: String, trim: true }
    },
    
    assignment: [{
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: { sparse: true, background: true }
        },
        assignedAt: { 
            type: Date, 
            index: { sparse: true, background: true }
        },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        dueDate: { 
            type: Date, 
            index: { sparse: true, background: true }
        },
        priority: {
            type: String,
            enum: ['EMERGENCY', 'PRIORITY', 'MLC', 'NORMAL', 'STAT'],
            default: 'NORMAL',
            index: { background: true }
        }
    }],

    preProcessedDownload: {
        zipUrl: { type: String, sparse: true },
        zipFileName: { type: String },
        zipSizeMB: { type: Number },
        zipCreatedAt: { type: Date },
        zipBucket: { type: String, default: 'medical-dicom-zips' },
        zipStatus: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed', 'expired'],
            default: 'pending',
            index: { background: true }
        },
        zipKey: { type: String },
        zipJobId: { type: String },
        zipExpiresAt: { type: Date },
        zipMetadata: {
            orthancStudyId: String,
            instanceCount: Number,
            seriesCount: Number,
            compressionRatio: Number,
            processingTimeMs: Number,
            createdBy: String,
            error: String
        },
        downloadCount: { type: Number, default: 0 },
        lastDownloaded: { type: Date }
    },

    priority: {
    type: String,
    enum: ['NORMAL', 'EMERGENCY', 'PRIORITY', 'MLC', 'STAT'],
    default: 'NORMAL',
    index: { background: true }
},

    lastAssignedDoctor: [{
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor',
            index: { sparse: true, background: true }
        },
        assignedAt: {
            type: Date,
            index: { sparse: true, background: true }
        }
    }],
    
    statusHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String
    }],
    
    reportInfo: {
        startedAt: Date,
        finalizedAt: Date,
        downloadedAt: Date,
        reporterName: String,
        reportContent: String,
        
        verificationInfo: {
            verifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                index: { sparse: true, background: true }
            },
            verifiedAt: {
                type: Date,
                index: { sparse: true, background: true }
            },
            verificationStatus: {
                type: String,
                enum: ['pending', 'in_progress', 'verified', 'rejected', 'reverted', 'report_reprint_needed'], // ✅ Added 'reverted'
                default: 'pending',
                index: { background: true }
            },
            verificationNotes: {
                type: String,
                trim: true,
                maxlength: 2000
            },
            corrections: [{
                section: {
                    type: String,
                    enum: ['findings', 'impression', 'recommendation', 'clinical_correlation', 'technique', 'other']
                },
                comment: {
                    type: String,
                    required: true,
                    trim: true,
                    maxlength: 1000
                },
                severity: {
                    type: String,
                    enum: ['minor', 'major', 'critical'],
                    default: 'minor'
                },
                correctedAt: {
                    type: Date,
                    default: Date.now
                }
            }],
            rejectionReason: {
                type: String,
                trim: true,
                maxlength: 1000
            },
            verificationTimeMinutes: {
                type: Number,
                min: 0
            },
            verificationHistory: [{
                action: {
                    type: String,
                    enum: ['assigned_for_verification', 'verification_started', 'verified', 'rejected', 'corrections_requested', 'reverted_to_radiologist', 'report_reprint_needed'] // ✅ Added 'reverted_to_radiologist'
                },
                performedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User'
                },
                performedAt: {
                    type: Date,
                    default: Date.now
                },
                notes: String
            }]
        },

        modernReports: [{
            reportId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Report'
            },
            reportType: String,
            createdAt: Date
        }]
    },

        // ✅ NEW: Revert to Radiologist tracking
    revertInfo: {
        isReverted: {
            type: Boolean,
            default: false,
            index: true
        },
        revertCount: {
            type: Number,
            default: 0
        },
        currentRevert: {
            revertedAt: Date,
            revertedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            revertedByName: String,
            revertedByRole: String,
            previousStatus: String,
            reason: String,
            notes: String,
            resolved: {
                type: Boolean,
                default: false
            },
            resolvedAt: Date,
            resolvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            resolutionNotes: String
        },
        revertHistory: [{
            revertedAt: {
                type: Date,
                default: Date.now
            },
            revertedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            revertedByName: String,
            revertedByRole: String,
            previousStatus: String,
            reason: String,
            notes: String,
            resolved: {
                type: Boolean,
                default: false
            },
            resolvedAt: Date,
            resolvedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            resolutionNotes: String,
            _id: {
                type: mongoose.Schema.Types.ObjectId,
                auto: true
            }
        }]
    },
    
    timingInfo: {
        uploadToAssignmentMinutes: { type: Number, index: { sparse: true, background: true } },
        assignmentToReportMinutes: { type: Number, index: { sparse: true, background: true } },
        reportToDownloadMinutes: { type: Number, index: { sparse: true, background: true } },
        totalTATMinutes: { type: Number, index: { sparse: true, background: true } }
    },
    
    sourceLab: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lab',
        index: { background: true }
    },

   
    labLocation: {
        type: String,
        trim: true,
        default: '',
        index: { sparse: true, background: true }
    },


    ReportAvailable: {
        type: Boolean,
        default: false,
        index: { background: true },
        required: false
    },
    
    searchText: { 
        type: String, 
        index: { 
            name: 'searchTextIndex',
            background: true,
            weights: {
                searchText: 10,
                'patientInfo.patientName': 5,
                'patientInfo.patientID': 3,
                accessionNumber: 2
            }
        }
    },
    
    uploadedReports: [{
        filename: String,
        contentType: String,
        data: String,
        size: Number,
        reportType: {
            type: String,
            enum: ['uploaded-report', 'generated-template'],
            default: 'uploaded-report'
        },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: String,
        reportStatus: {
            type: String,
            enum: ['draft', 'finalized'],
            default: 'finalized'
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor'
        }
    }],

    doctorReports: [{
        filename: String,
        contentType: String,
        data: String,
        size: Number,
        reportType: {
            type: String,
            enum: ['doctor-report', 'radiologist-report'],
            default: 'doctor-report'
        },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: String,
        reportStatus: {
            type: String,
            enum: ['draft', 'finalized'],
            default: 'finalized'
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor'
        }
    }],

    reports: [{
        reportId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Report',
            index: { sparse: true, background: true }
        },
        reportType: {
            type: String,
            enum: ['draft', 'finalized', 'radiologist-report', 'doctor-report', 'generated-template']
        },
        reportStatus: {
            type: String,
            enum: ['draft', 'in_progress', 'finalized', 'verified', 'rejected']
        },
        createdAt: { type: Date, default: Date.now },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        fileName: String,
        downloadUrl: String
    }],

    currentReportStatus: {
        hasReports: { type: Boolean, default: false },
        latestReportId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Report'
        },
        latestReportStatus: {
            type: String,
            enum: ['draft', 'in_progress', 'finalized', 'verified', 'rejected']
        },
        latestReportType: {
            type: String,
            enum: ['draft', 'finalized', 'radiologist-report', 'doctor-report', 'generated-template']
        },
        reportCount: { type: Number, default: 0 },
        lastReportedAt: Date,
        lastReportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    
    seriesCount: {
        type: Number,
        default: 0,
        index: { sparse: true, background: true }
    },
    instanceCount: {
        type: Number,
        default: 0,
        index: { sparse: true, background: true }
    },
    seriesImages: {
        type: String,
        default: "0/0"
    },
    
    studyTime: { type: String },
    modalitiesInStudy: [{ type: String }],
    examDescription: { 
        type: String,
        index: { sparse: true, background: true }
    },
    institutionName: { 
        type: String,
        index: { sparse: true, background: true }
    },
    orthancStudyID: { 
        type: String, 
        index: { sparse: true, background: true }
    },
    
    dicomFiles: [{
        sopInstanceUID: String,
        seriesInstanceUID: String,
        orthancInstanceId: String,
        modality: String,
        storageType: { type: String, default: 'orthanc' },
        uploadedAt: { type: Date, default: Date.now }
    }],
    
    caseType: {
        type: String,
        enum: [
            'routine', 'urgent', 'stat', 'emergency',
            'ROUTINE', 'URGENT', 'STAT', 'EMERGENCY',
            'Billed Study', 'New Study'
        ],
        default: 'routine',
        index: { background: true }
    },
    
    discussions: [{
        comment: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },
        userName: {
            type: String,
            required: true,
            trim: true
        },
        userRole: {
            type: String,
            required: true,
            enum: ['admin', 'doctor_account', 'lab_staff', 'technician'],
            index: { background: true }
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
            index: { sparse: true, background: true }
        },
        dateTime: {
            type: Date,
            required: true,
            default: Date.now,
            index: { background: true }
        }
    }],

     hasStudyNotes: {
        type: Boolean,
        default: false,
        index: { background: true }
    },
    hasAttachments: {
        type: Boolean,
        default: false,
        index: { background: true }
    },

    attachments: [{
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    contentType: {
        type: String,
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}],
    
    referringPhysician: {
        name: { type: String, trim: true },
        institution: { type: String, trim: true },
        contactInfo: { type: String, trim: true }
    },
    referringPhysicianName: { 
        type: String, 
        trim: true,
        index: { sparse: true, background: true }
    },

    physicians: {
        referring: {
            name: { type: String, trim: true },
            email: { type: String, trim: true },
            mobile: { type: String, trim: true },
            institution: { type: String, trim: true }
        },
        requesting: {
            name: { type: String, trim: true },
            email: { type: String, trim: true },
            mobile: { type: String, trim: true },
            institution: { type: String, trim: true }
        }
    },
    modifiedDate: { type: Date },
    modifiedTime: { type: String },
    reportDate: { 
        type: Date,
        index: { sparse: true, background: true }
    },
    reportTime: { type: String },
    
    calculatedTAT: {
        studyToUploadTAT: { type: Number, default: null, index: { sparse: true, background: true } },
        uploadToAssignmentTAT: { type: Number, default: null, index: { sparse: true, background: true } },
        assignmentToReportTAT: { type: Number, default: null, index: { sparse: true, background: true } },
        studyToReportTAT: { type: Number, default: null, index: { sparse: true, background: true } },
        uploadToReportTAT: { type: Number, default: null, index: { sparse: true, background: true } },
        totalTATMinutes: { type: Number, default: null, index: { sparse: true, background: true } },
        totalTATDays: { type: Number, default: null, index: { sparse: true, background: true } },
        
        resetAwareTATDays: { type: Number, default: null },
        resetAwareTATMinutes: { type: Number, default: null },
        
        studyToUploadTATFormatted: { type: String, default: 'N/A' },
        uploadToAssignmentTATFormatted: { type: String, default: 'N/A' },
        assignmentToReportTATFormatted: { type: String, default: 'N/A' },
        studyToReportTATFormatted: { type: String, default: 'N/A' },
        uploadToReportTATFormatted: { type: String, default: 'N/A' },
        totalTATFormatted: { type: String, default: 'N/A' },
        
        isCompleted: { type: Boolean, default: false },
        isOverdue: { type: Boolean, default: false, index: { background: true } },
        phase: { 
            type: String, 
            enum: ['not_started', 'uploaded', 'assigned', 'completed'],
            default: 'not_started',
            index: { background: true }
        },
        
        calculatedAt: { type: Date, default: Date.now },
        calculatedBy: { type: String, default: 'system' },
        lastUpdated: { type: Date, default: Date.now },
        
        resetAt: { type: Date },
        resetReason: { type: String },
        resetCount: { type: Number, default: 0 },
        
        keyDates: {
            studyDate: { type: Date },
            uploadDate: { type: Date },
            assignedDate: { type: Date },
            reportDate: { type: Date },
            calculationTime: { type: Date }
        }
    },

    timingInfo: {
        uploadToAssignmentMinutes: { type: Number, index: { sparse: true, background: true } },
        assignmentToReportMinutes: { type: Number, index: { sparse: true, background: true } },
        reportToDownloadMinutes: { type: Number, index: { sparse: true, background: true } },
        totalTATMinutes: { type: Number, index: { sparse: true, background: true } },
        
        tatResetAt: { type: Date },
        tatResetReason: { type: String },
        tatResetCount: { type: Number, default: 0 },
        
        lastCalculated: { type: Date },
        calculationMethod: { type: String, default: 'tatCalculator' }
    },

    clinicalHistory: {
        clinicalHistory: { 
            type: String, 
            trim: true, 
            default: '',
            index: { sparse: true, background: true }
        },
        previousInjury: { 
            type: String, 
            trim: true, 
            default: '' 
        },
        previousSurgery: { 
            type: String, 
            trim: true, 
            default: '' 
        },
        lastModifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: { sparse: true, background: true }
        },
        lastModifiedAt: { 
            type: Date, 
            index: { sparse: true, background: true }
        },
        lastModifiedFrom: {
            type: String,
            enum: ['patient_modal', 'study_detail', 'admin_panel', 'system'],
            default: 'study_detail'
        },
        dataSource: {
            type: String,
            enum: ['dicom_study_primary', 'migrated_from_patient', 'user_input'],
            default: 'dicom_study_primary'
        }
    },

    legacyClinicalHistoryRef: {
        fromPatientModel: { type: Boolean, default: false },
        lastSyncedAt: { type: Date },
        syncedBy: { type: String, default: 'system' }
    }

}, { 
    timestamps: true,
    collection: 'dicomstudies',
    minimize: false,
    versionKey: false,
    read: 'primary',
    strict: true,
    validateBeforeSave: true,
    autoIndex: false,
    bufferCommands: false,
});

// ✅ NEW: Pre-save middleware to generate BharatPacs ID
DicomStudySchema.pre('save', async function(next) {
    // Generate BharatPacs ID if not exists
    if (!this.bharatPacsId && this.isNew) {
        const orgPrefix = this.organizationIdentifier ? this.organizationIdentifier.substring(0, 3).toUpperCase() : 'GEN';
        const labPrefix = this.sourceLab ? 'LAB' : 'STD';
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        this.bharatPacsId = `BP-${orgPrefix}-${labPrefix}-${timestamp}-${random}`;
        
        // Log the generation
        this.actionLog.push({
            actionType: ACTION_TYPES.STUDY_RECEIVED,
            actionCategory: 'upload',
            performedBy: this.createdBy || new mongoose.Types.ObjectId('000000000000000000000000'),
            performedByName: 'System',
            performedByRole: 'system',
            actionDetails: {
                metadata: {
                    bharatPacsId: this.bharatPacsId,
                    generatedAt: new Date()
                }
            },
            notes: `BharatPacs ID generated: ${this.bharatPacsId}`
        });
    }
    
    // Existing pre-save logic
    if (this.statusHistory && this.statusHistory.length > 50) {
        this.statusHistory = this.statusHistory.slice(-50);
    }
    
    if (this.uploadedReports && this.uploadedReports.length > 20) {
        this.uploadedReports = this.uploadedReports.slice(-20);
    }
    
    if (this.doctorReports && this.doctorReports.length > 20) {
        this.doctorReports = this.doctorReports.slice(-20);
    }
    
    if (this.caseType) {
        this.caseType = this.caseType.toLowerCase();
    }
    
    const searchTerms = [
        this.bharatPacsId || '',
        this.patientInfo?.patientName || '',
        this.patientInfo?.patientID || '',
        this.accessionNumber || '',
        this.modality || '',
        this.referringPhysicianName || '',
        this.examDescription || '',
        this.studyInstanceUID || ''
    ].filter(term => term.trim().length > 0);
    
    this.searchText = searchTerms.join(' ').toLowerCase();
    
    if (this.seriesCount >= 0 && this.instanceCount >= 0) {
        this.seriesImages = `${this.seriesCount}/${this.instanceCount}`;
    }
    
    next();
});

// Existing indexes
DicomStudySchema.index({ 
    organizationIdentifier: 1, 
    workflowStatus: 1, 
    createdAt: -1 
}, { 
    name: 'org_workflow_date',
    background: true 
});

DicomStudySchema.index({ 
    organizationIdentifier: 1, 
    sourceLab: 1, 
    workflowStatus: 1 
}, { 
    name: 'org_lab_workflow',
    background: true 
});

DicomStudySchema.index({ 
    workflowStatus: 1, 
    createdAt: -1 
}, { 
    name: 'workflowStatus_createdAt',
    background: true 
});

DicomStudySchema.index({ 
    'assignment.assignedTo': 1, 
    workflowStatus: 1, 
    createdAt: -1 
}, { 
    name: 'doctor_workload',
    background: true,
    sparse: true 
});

DicomStudySchema.index({ 
    sourceLab: 1, 
    workflowStatus: 1, 
    createdAt: -1 
}, { 
    name: 'lab_dashboard',
    background: true 
});

DicomStudySchema.index({ 
    'preProcessedDownload.zipStatus': 1, 
    'preProcessedDownload.zipExpiresAt': 1 
}, { 
    name: 'zip_management_index',
    background: true 
});

DicomStudySchema.index({ 
    patient: 1, 
    studyDate: -1, 
    createdAt: -1 
}, { 
    name: 'patient_history',
    background: true 
});

DicomStudySchema.index({ 
    modality: 1, 
    studyDate: -1, 
    workflowStatus: 1 
}, { 
    name: 'modality_reports',
    background: true 
});

DicomStudySchema.index({ 
    'assignment.priority': 1, 
    workflowStatus: 1, 
    createdAt: -1 
}, { 
    name: 'priority_queue',
    background: true,
    sparse: true 
});

DicomStudySchema.index({ 
    studyDate: -1, 
    createdAt: -1, 
    workflowStatus: 1 
}, { 
    name: 'time_based_queries',
    background: true 
});

DicomStudySchema.index({ 
    searchText: 'text',
    'patientInfo.patientName': 'text',
    'patientInfo.patientID': 'text',
    accessionNumber: 'text'
}, { 
    name: 'comprehensive_search',
    background: true,
    weights: {
        searchText: 10,
        'patientInfo.patientName': 8,
        'patientInfo.patientID': 6,
        accessionNumber: 4
    }
});

DicomStudySchema.index({ 
    'timingInfo.totalTATMinutes': 1, 
    studyDate: -1 
}, { 
    name: 'tat_analytics',
    background: true,
    sparse: true 
});

DicomStudySchema.index({ 
    ReportAvailable: 1, 
    workflowStatus: 1, 
    createdAt: -1 
}, { 
    name: 'report_status',
    background: true 
});

// ✅ NEW: Additional indexes for new features
DicomStudySchema.index({ 
    bharatPacsId: 1 
}, { 
    name: 'bharatpacs_id_index',
    unique: true,
    sparse: true,
    background: true 
});

DicomStudySchema.index({ 
    'studyLock.isLocked': 1,
    'studyLock.lockedBy': 1,
    'studyLock.lockExpiry': 1
}, { 
    name: 'study_lock_index',
    background: true 
});

DicomStudySchema.index({ 
    'actionLog.actionType': 1,
    'actionLog.performedAt': -1
}, { 
    name: 'action_log_index',
    background: true 
});

DicomStudySchema.index({ 
    'actionLog.performedBy': 1,
    'actionLog.performedAt': -1
}, { 
    name: 'action_log_user_index',
    background: true 
});

DicomStudySchema.index({ 
    currentCategory: 1,
    createdAt: -1
}, { 
    name: 'category_tracking_index',
    background: true 
});

DicomStudySchema.index({ 
    'printHistory.printedAt': -1,
    'printHistory.printType': 1
}, { 
    name: 'print_history_index',
    background: true 
});

DicomStudySchema.post('save', function(doc) {
    // Analytics could be triggered here
});

DicomStudySchema.statics.findByWorkflowStatus = function(status, limit = 50) {
    return this.find({ workflowStatus: status })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

DicomStudySchema.statics.findByDoctor = function(doctorId, status = null, limit = 50) {
    const query = { 'assignment.assignedTo': doctorId };
    if (status) query.workflowStatus = status;
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

DicomStudySchema.statics.findByLab = function(labId, status = null, limit = 50) {
    const query = { sourceLab: labId };
    if (status) query.workflowStatus = status;
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

DicomStudySchema.statics.findByOrganization = function(orgIdentifier, status = null, limit = 50) {
    const query = { organizationIdentifier: orgIdentifier };
    if (status) query.workflowStatus = status;
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

DicomStudySchema.virtual('isUrgent').get(function() {
    return this.priority === 'EMERGENCY' || 
           this.assignment?.some(a => a.priority === 'EMERGENCY') ||
           this.caseType === 'emergency';
});


DicomStudySchema.methods.toSummary = function() {
    return {
        _id: this._id,
        bharatPacsId: this.bharatPacsId,
        studyInstanceUID: this.studyInstanceUID,
        organization: this.organization,
        organizationIdentifier: this.organizationIdentifier,
        patientInfo: this.patientInfo,
        studyDate: this.studyDate,
        modality: this.modality,
        workflowStatus: this.workflowStatus,
        currentCategory: this.currentCategory,
        assignment: this.assignment,
        seriesImages: this.seriesImages,
        createdAt: this.createdAt,
        ReportAvailable: this.ReportAvailable,
        isLocked: this.studyLock?.isLocked || false,
        lockedBy: this.studyLock?.lockedByName
    };
};

DicomStudySchema.methods.resetTAT = function(reason = 'manual_reset') {
    return import('../utils/tatCalculator.js').then(({ resetStudyTAT }) => {
        return resetStudyTAT(this._id, reason);
    });
};

DicomStudySchema.statics.bulkUpdateTAT = async function(query = {}) {
    const { calculateBatchTAT } = await import('../utils/tatCalculator.js');
    
    const studies = await this.find(query).lean();
    const tatResults = calculateBatchTAT(studies);
    
    const bulkOps = studies.map((study, index) => ({
        updateOne: {
            filter: { _id: study._id },
            update: { 
                $set: { 
                    calculatedTAT: tatResults[index],
                    'timingInfo.totalTATMinutes': tatResults[index].totalTATMinutes,
                    'timingInfo.lastCalculated': new Date()
                }
            }
        }
}));

    if (bulkOps.length > 0) {
        await this.bulkWrite(bulkOps);
        console.log(`✅ Bulk updated TAT for ${bulkOps.length} studies`);
    }
    
    return { updated: bulkOps.length };
};

DicomStudySchema.index({ 'calculatedTAT.totalTATMinutes': 1, workflowStatus: 1 }, { 
    name: 'tat_performance_index',
    background: true 
});

DicomStudySchema.index({ 'calculatedTAT.isOverdue': 1, workflowStatus: 1 }, { 
    name: 'overdue_studies_index',
    background: true 
});

DicomStudySchema.index({ 'calculatedTAT.phase': 1, createdAt: -1 }, { 
    name: 'tat_phase_index',
    background: true 
});

// ✅ Export ACTION_TYPES for use in controllers
export { ACTION_TYPES };
export default mongoose.model('DicomStudy', DicomStudySchema);