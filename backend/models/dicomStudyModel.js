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
    
    bharatPacsId: {
        type: String,
        unique: true,   // ✅ KEEP - this is a constraint not just an index
        sparse: true,
        // ❌ REMOVED: index: { background: true }
    },
    
    studyInstanceUID: {
        type: String,
        // ❌ REMOVED: index: { background: true }
    },

    copiedFrom: {
        studyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DicomStudy' },
        bharatPacsId: String,
        organizationIdentifier: String,
        organizationName: String,
        copiedAt: Date,
        copiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: String
    },

    copiedTo: [{
        studyId: { type: mongoose.Schema.Types.ObjectId, ref: 'DicomStudy' },
        bharatPacsId: String,
        organizationIdentifier: String,
        organizationName: String,
        copiedAt: Date,
        copiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],

    isCopiedStudy: {
        type: Boolean,
        default: false,
        // ❌ REMOVED: index: { background: true }
    },
    
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        // ❌ REMOVED: index: { background: true }
    },

    organizationIdentifier: {
        type: String,
        required: true,
        // ❌ REMOVED: index: { background: true }
    },
    
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true,
        // ❌ REMOVED: index: { background: true }
    },

    patientId: { 
        type: String, 
        required: true,
        // ❌ REMOVED: index: { background: true }
    },
    
    patientInfo: {
        patientID: { type: String },   // ❌ REMOVED inline index
        patientName: { type: String }, // ❌ REMOVED inline index
        age: String,
        gender: { type: String }       // ❌ REMOVED inline index
    },

    studyDate: { 
        type: Date, 
        default: Date.now
        // ❌ REMOVED: index: { background: true }
    },

    modality: { 
        type: String, 
        enum: ['CT', 'MRI', 'MR', 'XR', 'US', 'DX', 'CR', 'MG', 'NM', 'PT', 'RF', 'RTSTRUCT', 'RTDOSE', 'RTPLAN', 'OT', 'SR', 'SC', 'ECG', 'EPS', 'HD', 'IO', 'IVUS', 'KER', 'LEN', 'OAM', 'OP', 'PR', 'PROSPECTIVE_SERIES', 'SEG', 'SM', 'SRF', 'STAIN', 'US_MSK', 'XA'],
        default: 'CT'
        // ❌ REMOVED: index: { background: true }
    },

    accessionNumber: { 
        type: String
        // ❌ REMOVED: index: { sparse: true, background: true }
    },

    age: { type: String },
    gender: { type: String },

    workflowStatus: {
        type: String,
        enum: [
            'no_active_study',
            'new_study_received', 'metadata_extracted',
            'history_pending', 'history_created', 'history_verified',
            'pending_assignment', 'awaiting_radiologist',
            'assigned_to_doctor', 'assignment_accepted',
            'doctor_opened_report', 'report_in_progress', 'pending_completion',
            'report_drafted', 'draft_saved',
            'verification_pending', 'verification_in_progress',
            'report_finalized', 'final_approved', 'revert_to_radiologist',
            'report_reprint_needed', 'report_completed',
            'urgent_priority', 'emergency_case',
            'reprint_requested', 'correction_needed',
            'report_uploaded', 'report_downloaded_radiologist',
            'report_downloaded', 'final_report_downloaded',
            'report_verified', 'report_rejected', 'archived'
        ],
        default: 'new_study_received'
        // ❌ REMOVED: index: { background: true }
    },

    ohif: { type: String, default: 'ohif1' },
    notesCount: { type: Number, default: 0 },

    currentCategory: {
        type: String,
        enum: ['ALL','CREATED','HISTORY_CREATED','UNASSIGNED','ASSIGNED','PENDING',
               'DRAFT','VERIFICATION_PENDING','verification_pending','REVERTED',
               'FINAL','COMPLETED','REPRINT','URGENT','REPRINT_NEED'],
        default: 'CREATED'
        // ❌ REMOVED: index: { background: true }
    },

    reprintNeeded: { type: Boolean, default: false },
    
    generated: {
        type: String,
        enum: ['yes', 'no'],
        default: 'no'
        // ❌ REMOVED: index: { sparse: true, background: true }
    },

    studyLock: {
        isLocked: { type: Boolean, default: false },    // ❌ REMOVED inline index
        lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true }, // ❌ REMOVED inline index
        lockedByName: { type: String },
        lockedByRole: {
            type: String,
            enum: ['admin', 'assignor', 'doctor_account', 'radiologist', 'verifier', 'lab_staff']
        },
        lockedAt: { type: Date },   // ❌ REMOVED inline index
        lockReason: {
            type: String,
            enum: ['reporting', 'verification', 'review', 'correction', 'administrative'],
            default: 'reporting'
        },
        lockExpiry: { type: Date },
        previousLocks: [{
            lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            lockedByName: String,
            lockedAt: Date,
            unlockedAt: Date,
            lockDuration: Number,
            lockReason: String
        }]
    },

    actionLog: [{
        actionType: {
            type: String,
            enum: Object.values(ACTION_TYPES),
            required: true
            // ❌ REMOVED inline index
        },
        actionCategory: {
            type: String,
            enum: ['upload', 'history', 'assignment', 'lock', 'report', 'print', 'workflow', 'administrative'],
            required: true
        },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        performedByName: { type: String, required: true },
        performedByRole: {
            type: String,
            enum: ['admin', 'assignor', 'doctor_account', 'radiologist', 'verifier', 'lab_staff', 'technician', 'system']
        },
        performedAt: {
            type: Date,
            default: Date.now
            // ❌ REMOVED inline index
        },
        targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        targetUserName: { type: String },
        targetUserRole: { type: String },
        actionDetails: {
            previousValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
            changes: mongoose.Schema.Types.Mixed,
            metadata: mongoose.Schema.Types.Mixed
        },
        printInfo: {
            printCount: Number, isPrintOriginal: Boolean,
            printMethod: String, printerName: String, copies: Number
        },
        historyInfo: {
            clinicalHistoryUpdated: Boolean, previousInjuryUpdated: Boolean,
            previousSurgeryUpdated: Boolean, source: String
        },
        assignmentInfo: {
            assignmentType: String,
            previousAssignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            priority: String, dueDate: Date
        },
        notes: { type: String, maxlength: 2000 },
        ipAddress: String, userAgent: String, sessionId: String
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
        printedAt: { type: Date, default: Date.now },
        printedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        printedByName: String,
        printType: { type: String, enum: ['original', 'reprint', 'copy', 'draft', 'pdf_download', 'docx_download'], default: 'original' },
        printMethod: { type: String, enum: ['pdf_download', 'docx_download', 'physical_print', 'email', 'fax'], default: 'pdf_download' },
        reportVersion: Number,
        reportStatus: { type: String, enum: ['draft', 'finalized', 'verified'] },
        copies: { type: Number, default: 1 },
        printerName: String, recipientEmail: String, faxNumber: String,
        printReason: String, reprintReason: String,
        bharatPacsId: String, watermark: String,
        ipAddress: String, userAgent: String
    }],

    lastDownload: {
        downloadedAt: { type: Date },
        downloadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        downloadedByName: { type: String },
        downloadType: { type: String, enum: ['pdf', 'docx', 'print'] },
        reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    },

    technologist: {
        name: { type: String, trim: true },
        mobile: { type: String, trim: true },
        comments: { type: String, trim: true },
        reasonToSend: { type: String, trim: true }
    },
    
    assignment: [{
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // ❌ REMOVED inline index
        assignedAt: { type: Date },   // ❌ REMOVED inline index
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        dueDate: { type: Date },      // ❌ REMOVED inline index
        priority: {
            type: String,
            enum: ['EMERGENCY', 'PRIORITY', 'MLC', 'NORMAL', 'STAT'],
            default: 'NORMAL'
            // ❌ REMOVED inline index
        }
    }],

    preProcessedDownload: {
        zipUrl: { type: String },
        zipFileName: { type: String },
        zipSizeMB: { type: Number },
        zipCreatedAt: { type: Date },
        zipBucket: { type: String, default: 'medical-dicom-zips' },
        zipStatus: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed', 'expired'],
            default: 'pending'
            // ❌ REMOVED inline index
        },
        zipKey: { type: String },
        zipJobId: { type: String },
        zipExpiresAt: { type: Date },
        zipMetadata: {
            orthancStudyId: String, instanceCount: Number, seriesCount: Number,
            compressionRatio: Number, processingTimeMs: Number,
            createdBy: String, error: String
        },
        downloadCount: { type: Number, default: 0 },
        lastDownloaded: { type: Date }
    },

    priority: {
        type: String,
        enum: ['NORMAL', 'EMERGENCY', 'PRIORITY', 'MLC', 'STAT'],
        default: 'NORMAL'
        // ❌ REMOVED inline index
    },

    lastAssignedDoctor: [{
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },  // ❌ REMOVED inline index
        assignedAt: { type: Date }  // ❌ REMOVED inline index
    }],
    
    statusHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String
    }],
    
    reportInfo: {
        startedAt: Date, finalizedAt: Date, downloadedAt: Date,
        reporterName: String, reportContent: String,
        verificationInfo: {
            verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // ❌ REMOVED inline index
            verifiedAt: { type: Date },   // ❌ REMOVED inline index
            verificationStatus: {
                type: String,
                enum: ['pending', 'in_progress', 'verified', 'rejected', 'reverted', 'report_reprint_needed', 'report_completed'],
                default: 'pending'
                // ❌ REMOVED inline index
            },
            verificationNotes: { type: String, trim: true, maxlength: 2000 },
            corrections: [{
                section: { type: String, enum: ['findings', 'impression', 'recommendation', 'clinical_correlation', 'technique', 'other'] },
                comment: { type: String, required: true, trim: true, maxlength: 1000 },
                severity: { type: String, enum: ['minor', 'major', 'critical'], default: 'minor' },
                correctedAt: { type: Date, default: Date.now }
            }],
            rejectionReason: { type: String, trim: true, maxlength: 1000 },
            verificationTimeMinutes: { type: Number, min: 0 },
            verificationHistory: [{
                action: { type: String, enum: ['assigned_for_verification', 'verification_started', 'verified', 'rejected', 'corrections_requested', 'reverted_to_radiologist', 'report_reprint_needed','report_completed'] },
                performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                performedAt: { type: Date, default: Date.now },
                notes: String
            }]
        },
        modernReports: [{
            reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
            reportType: String, createdAt: Date
        }]
    },

    revertInfo: {
        isReverted: { type: Boolean, default: false },  // ❌ REMOVED inline index: true
        revertCount: { type: Number, default: 0 },
        currentRevert: {
            revertedAt: Date,
            revertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            revertedByName: String, revertedByRole: String,
            previousStatus: String, reason: String, notes: String,
            resolved: { type: Boolean, default: false },
            resolvedAt: Date,
            resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            resolutionNotes: String
        },
        revertHistory: [{
            revertedAt: { type: Date, default: Date.now },
            revertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            revertedByName: String, revertedByRole: String,
            previousStatus: String, reason: String, notes: String,
            resolved: { type: Boolean, default: false },
            resolvedAt: Date,
            resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            resolutionNotes: String,
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
        }]
    },
    
    timingInfo: {
        uploadToAssignmentMinutes: { type: Number },   // ❌ REMOVED inline index
        assignmentToReportMinutes: { type: Number },   // ❌ REMOVED inline index
        reportToDownloadMinutes: { type: Number },     // ❌ REMOVED inline index
        totalTATMinutes: { type: Number },             // ❌ REMOVED inline index
        tatResetAt: { type: Date },
        tatResetReason: { type: String },
        tatResetCount: { type: Number, default: 0 },
        lastCalculated: { type: Date },
        calculationMethod: { type: String, default: 'tatCalculator' }
    },
    
    sourceLab: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lab'
        // ❌ REMOVED: index: { background: true }
    },

    labLocation: {
        type: String, trim: true, default: ''
        // ❌ REMOVED: index: { sparse: true, background: true }
    },

    ReportAvailable: {
        type: Boolean, default: false, required: false
        // ❌ REMOVED: index: { background: true }
    },
    
    searchText: { 
        type: String
        // ❌ REMOVED: index: { name: 'searchTextIndex', background: true }
        // covered by text index idx_text_search below
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
        reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },  // ❌ REMOVED inline index
        reportType: { type: String, enum: ['draft', 'finalized', 'radiologist-report', 'doctor-report', 'generated-template'] },
        reportStatus: { type: String, enum: ['draft', 'in_progress', 'finalized', 'verified', 'rejected'] },
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        fileName: String, downloadUrl: String
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
    
    seriesCount: { type: Number, default: 0 },       // ❌ REMOVED inline index
    instanceCount: { type: Number, default: 0 },     // ❌ REMOVED inline index
    seriesImages: { type: String, default: "0/0" },
    
    studyTime: { type: String },
    modalitiesInStudy: [{ type: String }],
    examDescription: { type: String },               // ❌ REMOVED inline index
    institutionName: { type: String },               // ❌ REMOVED inline index
    orthancStudyID: { type: String },                // ❌ REMOVED inline index
    
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
        enum: ['routine','urgent','stat','emergency','ROUTINE','URGENT','STAT','EMERGENCY','Billed Study','New Study'],
        default: 'routine'
        // ❌ REMOVED inline index
    },
    
    discussions: [{
        comment: { type: String, required: true, trim: true, maxlength: 2000 },
        userName: { type: String, required: true, trim: true },
        userRole: { type: String, required: true, enum: ['admin', 'doctor_account', 'lab_staff', 'technician'] }, // ❌ REMOVED inline index
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },  // ❌ REMOVED inline index
        dateTime: { type: Date, required: true, default: Date.now }   // ❌ REMOVED inline index
    }],

    hasStudyNotes: { type: Boolean, default: false },     // ❌ REMOVED inline index
    hasAttachments: { type: Boolean, default: false },    // ❌ REMOVED inline index

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
    referringPhysicianName: { type: String, trim: true },  // ❌ REMOVED inline index
    
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
    reportDate: { type: Date },     // ❌ REMOVED inline index
    reportTime: { type: String },

    followUp: {
        isFollowUp: { type: Boolean, default: false },
        markedAt: { type: Date },
        markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        markedByName: { type: String },
        reason: { type: String, trim: true, maxlength: 500 },
        followUpDate: { type: Date }, // optional: when should follow-up happen
        resolvedAt: { type: Date },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        history: [{
            action: { type: String, enum: ['marked', 'resolved', 'updated'] },
            performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            performedByName: String,
            performedAt: { type: Date, default: Date.now },
            reason: String
        }]
    },
    
    calculatedTAT: {
        studyToUploadTAT: { type: Number, default: null },       // ❌ REMOVED inline index
        uploadToAssignmentTAT: { type: Number, default: null },  // ❌ REMOVED inline index
        assignmentToReportTAT: { type: Number, default: null },  // ❌ REMOVED inline index
        studyToReportTAT: { type: Number, default: null },       // ❌ REMOVED inline index
        uploadToReportTAT: { type: Number, default: null },      // ❌ REMOVED inline index
        totalTATMinutes: { type: Number, default: null },        // ❌ REMOVED inline index
        totalTATDays: { type: Number, default: null },           // ❌ REMOVED inline index
        resetAwareTATDays: { type: Number, default: null },
        resetAwareTATMinutes: { type: Number, default: null },
        studyToUploadTATFormatted: { type: String, default: 'N/A' },
        uploadToAssignmentTATFormatted: { type: String, default: 'N/A' },
        assignmentToReportTATFormatted: { type: String, default: 'N/A' },
        studyToReportTATFormatted: { type: String, default: 'N/A' },
        uploadToReportTATFormatted: { type: String, default: 'N/A' },
        totalTATFormatted: { type: String, default: 'N/A' },
        isCompleted: { type: Boolean, default: false },
        isOverdue: { type: Boolean, default: false },   // ❌ REMOVED inline index
        phase: { 
            type: String, 
            enum: ['not_started', 'uploaded', 'assigned', 'completed'],
            default: 'not_started'
            // ❌ REMOVED inline index
        },
        calculatedAt: { type: Date, default: Date.now },
        calculatedBy: { type: String, default: 'system' },
        lastUpdated: { type: Date, default: Date.now },
        resetAt: { type: Date }, resetReason: { type: String },
        resetCount: { type: Number, default: 0 },
        keyDates: {
            studyDate: { type: Date }, uploadDate: { type: Date },
            assignedDate: { type: Date }, reportDate: { type: Date },
            calculationTime: { type: Date }
        }
    },

    clinicalHistory: {
        clinicalHistory: { type: String, trim: true, default: '' },  // ❌ REMOVED inline index
        previousInjury: { type: String, trim: true, default: '' },
        previousSurgery: { type: String, trim: true, default: '' },
        lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // ❌ REMOVED inline index
        lastModifiedAt: { type: Date },   // ❌ REMOVED inline index
        lastModifiedFrom: { type: String, enum: ['patient_modal', 'study_detail', 'admin_panel', 'system'], default: 'study_detail' },
        dataSource: { type: String, enum: ['dicom_study_primary', 'migrated_from_patient', 'user_input'], default: 'dicom_study_primary' }
    },

    legacyClinicalHistoryRef: {
        fromPatientModel: { type: Boolean, default: false },
        lastSyncedAt: { type: Date },
        syncedBy: { type: String, default: 'system' }
    },

    // ✅ BILLING: Set by verifier during verification
    billing: {
        billingModule: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BillingModule',
            default: null,
        },
        moduleName: { type: String, default: null },
        moduleCode: { type: String, default: null },
        modality: { type: String, default: null },
        amount: { type: Number, default: null, min: 0 },
        currency: { type: String, default: 'INR' },
        billedAt: { type: Date, default: null },
        billedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        billedByName: { type: String, default: null },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'waived', 'disputed'],
            default: 'pending',
        },
        isBilled: { type: Boolean, default: false },
    },

}, { 
    timestamps: true,
    collection: 'dicomstudies',
    minimize: false,
    versionKey: false,
    read: 'primary',
    strict: true,
    validateBeforeSave: true,
    autoIndex: false,   // ✅ CRITICAL - prevents auto single-field index creation
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



// ── TIER 1: PRIMARY HOT PATH INDEXES ─────────────────────────
// Every single admin/study list query hits these

// #1 - THE MASTER INDEX: org + date (covers 80% of all queries)


DicomStudySchema.index(
    { organizationIdentifier: 1, createdAt: -1, _id: -1 },
    { name: 'idx_org_createdAt_id', background: true }
);

DicomStudySchema.index(
    { organizationIdentifier: 1, modalitiesInStudy: 1, createdAt: -1 },
    { name: 'idx_org_modalitiesInStudy_createdAt', background: true }
);

// #2 - org + category + date (covers all category tab clicks)
DicomStudySchema.index(
    { organizationIdentifier: 1, currentCategory: 1, createdAt: -1 },
    { name: 'idx_org_category_createdAt', background: true }
);

// #3 - org + workflowStatus + date (covers category endpoint queries)
DicomStudySchema.index(
    { organizationIdentifier: 1, workflowStatus: 1, createdAt: -1 },
    { name: 'idx_org_status_createdAt', background: true }
);

// ── TIER 2: FILTER INDEXES ────────────────────────────────────
// Single filter applied on top of org scope

// #4 - modality filter (CT was 463ms → now <50ms)
DicomStudySchema.index(
    { organizationIdentifier: 1, modality: 1, createdAt: -1 },
    { name: 'idx_org_modality_createdAt', background: true }
);

// #5 - priority filter (EMERGENCY, STAT, PRIORITY)
DicomStudySchema.index(
    { organizationIdentifier: 1, priority: 1, createdAt: -1 },
    { name: 'idx_org_priority_createdAt', background: true }
);

// #6 - source lab filter (lab dashboard view)
DicomStudySchema.index(
    { organizationIdentifier: 1, sourceLab: 1, createdAt: -1 },
    { name: 'idx_org_lab_createdAt', background: true }
);

// #7 - studyDate range (for dateFilter using studyDate field)
DicomStudySchema.index(
    { organizationIdentifier: 1, studyDate: -1 },
    { name: 'idx_org_studyDate', background: true }
);

// #8 - ReportAvailable flag (for report tracking dashboard)
DicomStudySchema.index(
    { organizationIdentifier: 1, ReportAvailable: 1, createdAt: -1 },
    { name: 'idx_org_reportAvailable_createdAt', background: true }
);

// ── TIER 3: COMBINED FILTER INDEXES ──────────────────────────
// Two filters applied simultaneously

// #9 - category + modality (tab filter + modality dropdown)
DicomStudySchema.index(
    { organizationIdentifier: 1, currentCategory: 1, modality: 1, createdAt: -1 },
    { name: 'idx_org_category_modality_createdAt', background: true }
);

// #10 - status + modality (workflowStatus category + modality)
DicomStudySchema.index(
    { organizationIdentifier: 1, workflowStatus: 1, modality: 1, createdAt: -1 },
    { name: 'idx_org_status_modality_createdAt', background: true }
);

// #11 - modality + priority (CT + STAT, MR + EMERGENCY etc.)
DicomStudySchema.index(
    { organizationIdentifier: 1, modality: 1, priority: 1, createdAt: -1 },
    { name: 'idx_org_modality_priority_createdAt', background: true }
);

// #12 - lab + workflowStatus (lab-scoped category views)
DicomStudySchema.index(
    { organizationIdentifier: 1, sourceLab: 1, workflowStatus: 1, createdAt: -1 },
    { name: 'idx_org_lab_status_createdAt', background: true }
);

// #13 - lab + currentCategory
DicomStudySchema.index(
    { organizationIdentifier: 1, sourceLab: 1, currentCategory: 1, createdAt: -1 },
    { name: 'idx_org_lab_category_createdAt', background: true }
);

// #14 - priority + category (urgent tab with priority filter)
DicomStudySchema.index(
    { organizationIdentifier: 1, currentCategory: 1, priority: 1, createdAt: -1 },
    { name: 'idx_org_category_priority_createdAt', background: true }
);

// ── TIER 4: RADIOLOGIST / DOCTOR DASHBOARD ────────────────────
// Queries scoped to a specific assigned doctor

// #15 - doctor workload (my assigned studies)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'assignment.assignedTo': 1, workflowStatus: 1, createdAt: -1 },
    { name: 'idx_org_doctor_status_createdAt', background: true, sparse: true }
);

// #16 - doctor + category
DicomStudySchema.index(
    { organizationIdentifier: 1, 'assignment.assignedTo': 1, currentCategory: 1, createdAt: -1 },
    { name: 'idx_org_doctor_category_createdAt', background: true, sparse: true }
);

// #17 - doctor + modality (radiologist filtering their own CT/MR)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'assignment.assignedTo': 1, modality: 1, createdAt: -1 },
    { name: 'idx_org_doctor_modality_createdAt', background: true, sparse: true }
);

// ── TIER 5: PATIENT LOOKUP ────────────────────────────────────

// #18 - patient history (all studies for a patient)
DicomStudySchema.index(
    { organizationIdentifier: 1, patient: 1, studyDate: -1 },
    { name: 'idx_org_patient_studyDate', background: true }
);

// #19 - patientID lookup (quick search by patient ID)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'patientInfo.patientID': 1, createdAt: -1 },
    { name: 'idx_org_patientID_createdAt', background: true }
);

// #20 - patientName lookup (search by name)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'patientInfo.patientName': 1, createdAt: -1 },
    { name: 'idx_org_patientName_createdAt', background: true }
);

// ── TIER 6: UNIQUE / LOOKUP INDEXES ──────────────────────────

// #21 - bharatPacsId (primary unique ID lookup)
DicomStudySchema.index(
    { bharatPacsId: 1 },
    { name: 'idx_bharatPacsId', unique: true, sparse: true, background: true }
);

// #22 - studyInstanceUID (DICOM standard lookup)
DicomStudySchema.index(
    { studyInstanceUID: 1 },
    { name: 'idx_studyInstanceUID', sparse: true, background: true }
);

// #23 - orthancStudyID (Orthanc integration lookup)
DicomStudySchema.index(
    { orthancStudyID: 1 },
    { name: 'idx_orthancStudyID', sparse: true, background: true }
);

// #24 - accessionNumber (unique per org)
DicomStudySchema.index(
    { organizationIdentifier: 1, accessionNumber: 1 },
    { name: 'idx_org_accessionNumber', background: true, sparse: true }
);

// ── TIER 7: ANALYTICS & REPORTING INDEXES ────────────────────

// #25 - TAT analytics (turn-around-time reports)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'calculatedTAT.totalTATMinutes': 1, studyDate: -1 },
    { name: 'idx_org_tat_studyDate', background: true, sparse: true }
);

// #26 - overdue studies
DicomStudySchema.index(
    { organizationIdentifier: 1, 'calculatedTAT.isOverdue': 1, workflowStatus: 1 },
    { name: 'idx_org_overdue_status', background: true }
);

// #27 - TAT phase tracking
DicomStudySchema.index(
    { organizationIdentifier: 1, 'calculatedTAT.phase': 1, createdAt: -1 },
    { name: 'idx_org_tat_phase', background: true }
);

// #28 - modality + date (modality-level analytics)
DicomStudySchema.index(
    { organizationIdentifier: 1, modality: 1, studyDate: -1, workflowStatus: 1 },
    { name: 'idx_org_modality_studyDate_status', background: true }
);

// ── TIER 8: FEATURE-SPECIFIC INDEXES ─────────────────────────

// #29 - study lock management (who has what locked)
DicomStudySchema.index(
    { 'studyLock.isLocked': 1, 'studyLock.lockExpiry': 1 },
    { name: 'idx_lock_expiry', background: true }
);

// #30 - study lock by user (show me what I have locked)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'studyLock.lockedBy': 1, 'studyLock.isLocked': 1 },
    { name: 'idx_org_lockedBy', background: true, sparse: true }
);

// #31 - zip download status (pre-processed DICOM downloads)
DicomStudySchema.index(
    { 'preProcessedDownload.zipStatus': 1, 'preProcessedDownload.zipExpiresAt': 1 },
    { name: 'idx_zip_status_expiry', background: true }
);

// #32 - revert tracking (reverted studies dashboard)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'revertInfo.isReverted': 1, createdAt: -1 },
    { name: 'idx_org_reverted_createdAt', background: true }
);

// #33 - assignment priority queue (for assignor dashboard)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'assignment.priority': 1, workflowStatus: 1, createdAt: -1 },
    { name: 'idx_org_assignPriority_status_createdAt', background: true, sparse: true }
);

// #34 - report date tracking
DicomStudySchema.index(
    { organizationIdentifier: 1, reportDate: -1 },
    { name: 'idx_org_reportDate', background: true, sparse: true }
);

// #35 - action log audit trail (who did what when)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'actionLog.performedBy': 1, 'actionLog.performedAt': -1 },
    { name: 'idx_org_actionLog_user_date', background: true }
);

// #36 - print history tracking
DicomStudySchema.index(
    { organizationIdentifier: 1, 'printHistory.printedAt': -1 },
    { name: 'idx_org_printHistory_date', background: true }
);

// #37 - copied study tracking
DicomStudySchema.index(
    { organizationIdentifier: 1, isCopiedStudy: 1, createdAt: -1 },
    { name: 'idx_org_isCopied_createdAt', background: true }
);

// #38 - verification status (verifier dashboard)
DicomStudySchema.index(
    { organizationIdentifier: 1, 'reportInfo.verificationInfo.verificationStatus': 1, createdAt: -1 },
    { name: 'idx_org_verificationStatus_createdAt', background: true }
);

// ── TIER 9: TEXT SEARCH ───────────────────────────────────────
// MongoDB allows ONLY 1 text index per collection
// Covers: patient name, patientID, accessionNumber, description, bharatPacsId

DicomStudySchema.index(
    {
        searchText: 'text',
        'patientInfo.patientName': 'text',
        'patientInfo.patientID': 'text',
        accessionNumber: 'text',
        examDescription: 'text',
        referringPhysicianName: 'text',
        bharatPacsId: 'text'
    },
    {
        name: 'idx_text_search',
        background: true,
        weights: {
            'patientInfo.patientID': 10,   // Most specific
            bharatPacsId: 10,              // Unique ID search
            'patientInfo.patientName': 9,  // Name search
            accessionNumber: 7,            // Accession lookup
            referringPhysicianName: 4,     // Physician search
            examDescription: 3,            // Description search
            searchText: 8                  // Pre-computed search field
        }
    }
);



// Existing indexes
// DicomStudySchema.index({ 
//     organizationIdentifier: 1, 
//     workflowStatus: 1, 
//     createdAt: -1 
// }, { 
//     name: 'org_workflow_date',
//     background: true 
// });

// DicomStudySchema.index({ 
//     organizationIdentifier: 1, 
//     sourceLab: 1, 
//     workflowStatus: 1 
// }, { 
//     name: 'org_lab_workflow',
//     background: true 
// });

// DicomStudySchema.index({ 
//     workflowStatus: 1, 
//     createdAt: -1 
// }, { 
//     name: 'workflowStatus_createdAt',
//     background: true 
// });

// DicomStudySchema.index({ 
//     'assignment.assignedTo': 1, 
//     workflowStatus: 1, 
//     createdAt: -1 
// }, { 
//     name: 'doctor_workload',
//     background: true,
//     sparse: true 
// });

// DicomStudySchema.index({ 
//     sourceLab: 1, 
//     workflowStatus: 1, 
//     createdAt: -1 
// }, { 
//     name: 'lab_dashboard',
//     background: true 
// });

// DicomStudySchema.index({ 
//     'preProcessedDownload.zipStatus': 1, 
//     'preProcessedDownload.zipExpiresAt': 1 
// }, { 
//     name: 'zip_management_index',
//     background: true 
// });

// DicomStudySchema.index({ 
//     patient: 1, 
//     studyDate: -1, 
//     createdAt: -1 
// }, { 
//     name: 'patient_history',
//     background: true 
// });

// DicomStudySchema.index({ 
//     modality: 1, 
//     studyDate: -1, 
//     workflowStatus: 1 
// }, { 
//     name: 'modality_reports',
//     background: true 
// });

// DicomStudySchema.index({ 
//     'assignment.priority': 1, 
//     workflowStatus: 1, 
//     createdAt: -1 
// }, { 
//     name: 'priority_queue',
//     background: true,
//     sparse: true 
// });

// DicomStudySchema.index({ 
//     studyDate: -1, 
//     createdAt: -1, 
//     workflowStatus: 1 
// }, { 
//     name: 'time_based_queries',
//     background: true 
// });

// DicomStudySchema.index({ 
//     searchText: 'text',
//     'patientInfo.patientName': 'text',
//     'patientInfo.patientID': 'text',
//     accessionNumber: 'text'
// }, { 
//     name: 'comprehensive_search',
//     background: true,
//     weights: {
//         searchText: 10,
//         'patientInfo.patientName': 8,
//         'patientInfo.patientID': 6,
//         accessionNumber: 4
//     }
// });

// DicomStudySchema.index({ 
//     'timingInfo.totalTATMinutes': 1, 
//     studyDate: -1 
// }, { 
//     name: 'tat_analytics',
//     background: true,
//     sparse: true 
// });

// DicomStudySchema.index({ 
//     ReportAvailable: 1, 
//     workflowStatus: 1, 
//     createdAt: -1 
// }, { 
//     name: 'report_status',
//     background: true 
// });

// // ✅ NEW: Additional indexes for new features
// DicomStudySchema.index({ 
//     bharatPacsId: 1 
// }, { 
//     name: 'bharatpacs_id_index',
//     unique: true,
//     sparse: true,
//     background: true 
// });

// DicomStudySchema.index({ 
//     'studyLock.isLocked': 1,
//     'studyLock.lockedBy': 1,
//     'studyLock.lockExpiry': 1
// }, { 
//     name: 'study_lock_index',
//     background: true 
// });

// DicomStudySchema.index({ 
//     'actionLog.actionType': 1,
//     'actionLog.performedAt': -1
// }, { 
//     name: 'action_log_index',
//     background: true 
// });

// DicomStudySchema.index({ 
//     'actionLog.performedBy': 1,
//     'actionLog.performedAt': -1
// }, { 
//     name: 'action_log_user_index',
//     background: true 
// });

// DicomStudySchema.index({ 
//     currentCategory: 1,
//     createdAt: -1
// }, { 
//     name: 'category_tracking_index',
//     background: true 
// });

// DicomStudySchema.index({ 
//     'printHistory.printedAt': -1,
//     'printHistory.printType': 1
// }, { 
//     name: 'print_history_index',
//     background: true 
// });

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