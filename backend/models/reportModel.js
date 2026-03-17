import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
    // ✅ CORE IDENTIFIERS
    reportId: {
        type: String,
        unique: true,
        required: true,
        index: { background: true }
    },
    
    // ✅ REFERENCES - All the key relationships
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: { background: true }
    },
    
    organizationIdentifier: {
        type: String,
        required: true,
        uppercase: true,
        index: { background: true }
    },
    
    // Patient reference
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
    
    // Study reference
    dicomStudy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DicomStudy',
        required: true,
        index: { background: true }
    },
    
    studyInstanceUID: {
        type: String,
        required: true,
        index: { background: true }
    },
    
    orthancStudyID: {
        type: String,
        index: { sparse: true, background: true }
    },
    
    accessionNumber: {
        type: String,
        index: { sparse: true, background: true }
    },
    
    // ✅ PERSONNEL REFERENCES
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: { background: true }
    },
    
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: { background: true }
    },
    
    verifierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: { sparse: true, background: true }
    },
    
    // ✅ REPORT CONTENT - Based on OnlineReportingSystem data structure
    reportContent: {
        // HTML content from ReportEditor
        htmlContent: {
            type: String,
            required: true
        },
        
        // Plain text version for search
        plainTextContent: {
            type: String,
            index: { sparse: true, background: true }
        },
        
        // Template information
        templateInfo: {
            templateId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'HTMLTemplate'
            },
            templateName: String,
            templateCategory: String,
            templateTitle: String
        },
        
        // Placeholders used (from OnlineReportingSystem)
        placeholders: {
            name: String,           // '--name--'
            patientId: String,      // '--patientid--'
            accessionNo: String,    // '--accessionno--'
            ageGender: String,      // '--agegender--'
            referredBy: String,     // '--referredby--'
            reportedDate: String,   // '--reporteddate--'
            content: String         // '--Content--'
        },
        
        // ✅ NEW: Captured images from OHIF viewer
        capturedImages: [{
            imageData: {
                type: String, // Base64 encoded image data
                required: true
            },
            viewportId: {
                type: String,
                default: 'viewport-1'
            },
            capturedAt: {
                type: Date,
                default: Date.now
            },
            capturedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            imageMetadata: {
                width: Number,
                height: Number,
                format: {
                    type: String,
                    enum: ['png', 'jpeg', 'jpg'],
                    default: 'png'
                },
                fileSize: Number, // in bytes
                modality: String,
                seriesDescription: String,
                instanceNumber: Number
            },
            annotations: {
                type: String,
                maxlength: 500
            },
            displayOrder: {
                type: Number,
                default: 0
            }
        }],
        
        // Word count and statistics
        statistics: {
            wordCount: { type: Number, default: 0 },
            characterCount: { type: Number, default: 0 },
            pageCount: { type: Number, default: 1 },
            imageCount: { type: Number, default: 0 } // ✅ NEW: Track number of images
        }
    },

    // ✅ CAPTURED IMAGES - Store images captured from OHIF viewer
capturedImages: [{
    imageData: {
        type: String, // Base64 encoded image data
        required: true
    },
    viewportId: {
        type: String,
        default: 'viewport-1'
    },
    capturedAt: {
        type: Date,
        default: Date.now
    },
    capturedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    imageMetadata: {
        width: Number,
        height: Number,
        format: {
            type: String,
            enum: ['png', 'jpeg', 'jpg'],
            default: 'png'
        },
        fileSize: Number, // in bytes
        modality: String,
        seriesDescription: String,
        instanceNumber: Number
    },
    annotations: {
        type: String,
        maxlength: 500
    },
    displayOrder: {
        type: Number,
        default: 0
    }
}],
    
    // ✅ REPORT METADATA
    reportType: {
        type: String,
        enum: [
            'draft',
            'finalized', 
            'radiologist-report',
            'doctor-report',
            'generated-template',
            'uploaded-report'
        ],
        required: true,
        default: 'draft',
        index: { background: true }
    },
    
    reportStatus: {
        type: String,
        enum: [
            'draft',
            'in_progress',
            'finalized',
            'verified',
            'rejected',
            'report_reprint_needed',
            'archived'
        ],
        required: true,
        default: 'draft',
        index: { background: true }
    },
    
    // ✅ EXPORT INFORMATION
    exportInfo: {
        format: {
            type: String,
            enum: ['docx', 'pdf', 'html'],
            default: 'docx'
        },
        
        fileName: String,
        fileSize: Number, // in bytes
        
        // Generated document details
        documentPath: String,
        downloadUrl: String,
        downloadCount: { type: Number, default: 0 },
        
        // Document metadata
        documentMetadata: {
            createdAt: Date,
            version: { type: String, default: '1.0' },
            checksum: String
        }
    },
    
    // ✅ PATIENT INFORMATION (Denormalized for quick access)
    patientInfo: {
        fullName: String,
        patientName: String,
        age: String,
        gender: String,
        dateOfBirth: Date,
        clinicalHistory: String
    },
    
    // ✅ STUDY INFORMATION (Denormalized for quick access)
    studyInfo: {
        studyDate: Date,
        modality: String,
        examDescription: String,
        institutionName: String,
        referringPhysician: {
            name: String,
            institution: String,
            contactInfo: String
        },
        seriesCount: Number,
        instanceCount: Number,
        priority: String,
        caseType: String
    },
    
    // ✅ WORKFLOW TRACKING
    workflowInfo: {
        // Report creation workflow
        draftedAt: Date,
        finalizedAt: Date,
        verifiedAt: Date,
        downloadedAt: Date,
        
        // Time tracking
        creationTimeMinutes: Number,
        finalizationTimeMinutes: Number,
        verificationTimeMinutes: Number,
        
        // Status history
        statusHistory: [{
            status: {
                type: String,
                enum: ['draft', 'in_progress', 'finalized', 'verified', 'rejected', 'archived']
            },
            changedAt: { type: Date, default: Date.now },
            changedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            notes: String,
            userRole: String
        }]
    },
    
    // ✅ VERIFICATION DETAILS
    verificationInfo: {
        verificationStatus: {
            type: String,
            enum: ['pending', 'in_progress', 'verified', 'rejected', 'report_reprint_needed'], // ✅ Added 'report_reprint_needed'
            default: 'pending',
            index: { background: true }
        },
        
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: { sparse: true, background: true }
        },
        
        verifiedAt: {
            type: Date,
            index: { sparse: true, background: true }
        },
        
        verificationNotes: {
            type: String,
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
            maxlength: 1000
        },
        
        verificationHistory: [{
            action: {
                type: String,
                enum: ['assigned_for_verification', 'verification_started', 'verified', 'rejected', 'corrections_requested', 'reverted_to_radiologist', 'report_reprint_needed', 'report_completed'] // ✅ Added 'report_reprint_needed'
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
    
    // ✅ DOWNLOAD TRACKING
    downloadInfo: {
        downloadHistory: [{
            downloadedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            downloadedAt: {
                type: Date,
                default: Date.now
            },
            downloadType: {
                type: String,
                enum: ['draft', 'final', 'verification', 'pdf', 'docx'] 
            },
            userRole: String,
            ipAddress: String,
            userAgent: String
        }],
        
        totalDownloads: { type: Number, default: 0 },
        lastDownloaded: Date,
        downloadUrls: {
            draftUrl: String,
            finalUrl: String,
            pdfUrl: String
        }
    },

    // 1. ADD THIS TO reportModel.js after downloadInfo (around line 420)

    // ✅ PRINT TRACKING
    printInfo: {
        printHistory: [{
            printedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            printedAt: {
                type: Date,
                default: Date.now
            },
            printType: {
                type: String,
                enum: ['print', 'reprint']
            },
            userRole: String,
            ipAddress: String,
            userAgent: String
        }],
        
        totalPrints: { type: Number, default: 0 },
        firstPrintedAt: Date,
        lastPrintedAt: Date
    },
    
    // ✅ QUALITY METRICS
    qualityMetrics: {
        // Report quality indicators
        completeness: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        
        // Critical findings flagged
        criticalFindings: [{
            finding: String,
            severity: {
                type: String,
                enum: ['low', 'medium', 'high', 'critical']
            },
            flaggedAt: Date,
            flaggedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        }],
        
        // Review scores
        reviewScore: {
            type: Number,
            min: 1,
            max: 5
        },
        
        reviewNotes: String
    },
    
    // ✅ ATTACHMENTS AND ADDITIONAL FILES
    attachments: [{
        fileName: String,
        fileType: String,
        fileSize: Number,
        filePath: String,
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        description: String
    }],
    
    // ✅ SEARCH AND INDEXING
    searchText: {
        type: String,
        index: { 
            name: 'reportSearchIndex',
            background: true,
            weights: {
                searchText: 10,
                'patientInfo.fullName': 8,
                'patientInfo.patientName': 8,
                'reportContent.plainTextContent': 6,
                accessionNumber: 5,
                'studyInfo.examDescription': 4
            }
        }
    },
    
    // ✅ SYSTEM METADATA
    systemInfo: {
        version: { type: String, default: '1.0' },
        migrated: { type: Boolean, default: false },
        migrationDate: Date,
        dataSource: {
            type: String,
            enum: ['online_reporting_system', 'uploaded_report', 'migrated_data', 'external_import'],
            default: 'online_reporting_system'
        },
        
        // Performance tracking
        processingTime: {
            draftGenerationMs: Number,
            finalizationMs: Number,
            verificationMs: Number
        }
    },
    
    // ✅ COMPLIANCE AND AUDIT
    auditInfo: {
        hipaaCompliant: { type: Boolean, default: true },
        dataRetentionExpiry: Date,
        accessLog: [{
            accessedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            accessedAt: { type: Date, default: Date.now },
            accessType: {
                type: String,
                enum: ['view', 'edit', 'download', 'verify', 'delete']
            },
            ipAddress: String,
            userAgent: String
        }],
        
        lastAccessedAt: Date,
        accessCount: { type: Number, default: 0 }
    }
    
}, {
    timestamps: true,
    collection: 'reports',
    minimize: false,
    versionKey: false,
    read: 'primary',
    strict: true,
    validateBeforeSave: true,
    autoIndex: false,
    bufferCommands: false
});

// ✅ INDEXES FOR PERFORMANCE
// Multi-tenant indexes
ReportSchema.index({ 
    organizationIdentifier: 1, 
    reportStatus: 1, 
    createdAt: -1 
}, { 
    name: 'org_status_time',
    background: true 
});

// Doctor workload indexes
ReportSchema.index({ 
    doctorId: 1, 
    reportStatus: 1, 
    createdAt: -1 
}, { 
    name: 'doctor_reports',
    background: true 
});

// Patient reports index
ReportSchema.index({ 
    patient: 1, 
    'studyInfo.studyDate': -1,
    reportStatus: 1 
}, { 
    name: 'patient_reports',
    background: true 
});

// Study reports index
ReportSchema.index({ 
    dicomStudy: 1,
    reportType: 1,
    reportStatus: 1
}, { 
    name: 'study_reports',
    background: true 
});

// Verification workflow index
ReportSchema.index({ 
    verifierId: 1,
    'verificationInfo.verificationStatus': 1,
    'workflowInfo.finalizedAt': -1
}, { 
    name: 'verification_workflow',
    background: true,
    sparse: true
});

// Download tracking index
ReportSchema.index({ 
    'downloadInfo.lastDownloaded': -1,
    reportStatus: 1
}, { 
    name: 'download_tracking',
    background: true,
    sparse: true
});

// Search optimization index
ReportSchema.index({ 
    searchText: 'text',
    'patientInfo.fullName': 'text',
    'reportContent.plainTextContent': 'text'
}, { 
    name: 'comprehensive_report_search',
    background: true,
    weights: {
        searchText: 10,
        'patientInfo.fullName': 8,
        'reportContent.plainTextContent': 6
    }
});

// Replace the existing indexes block with these:

// ── TIER 1: PRIMARY ORG QUERIES ───────────────────────────────
// #1 - all reports in org by date (report management dashboard)
ReportSchema.index(
    { organizationIdentifier: 1, createdAt: -1 },
    { name: 'idx_org_createdAt', background: true }
);

// #2 - org + status + date (filter by status on dashboard)
ReportSchema.index(
    { organizationIdentifier: 1, reportStatus: 1, createdAt: -1 },
    { name: 'idx_org_status_createdAt', background: true }
);

// #3 - org + type + date (filter by report type)
ReportSchema.index(
    { organizationIdentifier: 1, reportType: 1, createdAt: -1 },
    { name: 'idx_org_type_createdAt', background: true }
);

// #4 - org + status + type (combined filter)
ReportSchema.index(
    { organizationIdentifier: 1, reportStatus: 1, reportType: 1, createdAt: -1 },
    { name: 'idx_org_status_type_createdAt', background: true }
);

// ── TIER 2: STUDY ↔ REPORT RELATIONSHIP ──────────────────────
// #5 - get all reports for a study (most common join)
ReportSchema.index(
    { dicomStudy: 1, reportType: 1, reportStatus: 1 },
    { name: 'idx_study_type_status', background: true }
);

// #6 - get report by studyInstanceUID (DICOM lookup)
ReportSchema.index(
    { studyInstanceUID: 1 },
    { name: 'idx_studyInstanceUID', background: true }
);

// #7 - get report by reportId (unique report lookup)
ReportSchema.index(
    { reportId: 1 },
    { name: 'idx_reportId_unique', unique: true, background: true }
);

// ── TIER 3: DOCTOR / RADIOLOGIST DASHBOARD ────────────────────
// #8 - all reports by a doctor (radiologist worklist)
ReportSchema.index(
    { doctorId: 1, reportStatus: 1, createdAt: -1 },
    { name: 'idx_doctor_status_createdAt', background: true }
);

// #9 - doctor + org (multi-org radiologist)
ReportSchema.index(
    { organizationIdentifier: 1, doctorId: 1, reportStatus: 1, createdAt: -1 },
    { name: 'idx_org_doctor_status_createdAt', background: true }
);

// #10 - doctor + type (find drafts vs finalized)
ReportSchema.index(
    { doctorId: 1, reportType: 1, createdAt: -1 },
    { name: 'idx_doctor_type_createdAt', background: true }
);

// ── TIER 4: VERIFIER DASHBOARD ────────────────────────────────
// #11 - verifier workload (pending verification queue)
ReportSchema.index(
    { organizationIdentifier: 1, verifierId: 1, 'verificationInfo.verificationStatus': 1, createdAt: -1 },
    { name: 'idx_org_verifier_verificationStatus_createdAt', background: true, sparse: true }
);

// #12 - verification status across org (admin monitoring)
ReportSchema.index(
    { organizationIdentifier: 1, 'verificationInfo.verificationStatus': 1, createdAt: -1 },
    { name: 'idx_org_verificationStatus_createdAt', background: true }
);

// #13 - verification finalized date (TAT tracking)
ReportSchema.index(
    { organizationIdentifier: 1, 'workflowInfo.finalizedAt': -1, reportStatus: 1 },
    { name: 'idx_org_finalizedAt_status', background: true, sparse: true }
);

// ── TIER 5: PATIENT REPORTS ───────────────────────────────────
// #14 - all reports for a patient  
ReportSchema.index(
    { patient: 1, 'studyInfo.studyDate': -1, reportStatus: 1 },
    { name: 'idx_patient_studyDate_status', background: true }
);

// #15 - org + patient (patient report history page)
ReportSchema.index(
    { organizationIdentifier: 1, patient: 1, createdAt: -1 },
    { name: 'idx_org_patient_createdAt', background: true }
);

// ── TIER 6: DOWNLOAD / PRINT TRACKING ────────────────────────
// #16 - last downloaded (find recently downloaded reports)
ReportSchema.index(
    { organizationIdentifier: 1, 'downloadInfo.lastDownloaded': -1, reportStatus: 1 },
    { name: 'idx_org_lastDownloaded_status', background: true, sparse: true }
);

// #17 - download count analytics
ReportSchema.index(
    { organizationIdentifier: 1, 'downloadInfo.totalDownloads': -1 },
    { name: 'idx_org_totalDownloads', background: true }
);

// ── TIER 7: ANALYTICS QUERIES ─────────────────────────────────
// #18 - report creation time analytics (TAT)
ReportSchema.index(
    { organizationIdentifier: 1, 'workflowInfo.draftedAt': -1 },
    { name: 'idx_org_draftedAt', background: true, sparse: true }
);

// #19 - accession number lookup
ReportSchema.index(
    { organizationIdentifier: 1, accessionNumber: 1 },
    { name: 'idx_org_accessionNumber', background: true, sparse: true }
);

// ── TIER 8: TEXT SEARCH ───────────────────────────────────────
// NOTE: 1 text index per collection max
ReportSchema.index(
    {
        searchText: 'text',
        'patientInfo.fullName': 'text',
        'patientInfo.patientName': 'text',
        'reportContent.plainTextContent': 'text',
        accessionNumber: 'text'
    },
    {
        name: 'idx_report_text_search',
        background: true,
        weights: {
            searchText: 10,
            'patientInfo.fullName': 9,
            'patientInfo.patientName': 9,
            accessionNumber: 7,
            'reportContent.plainTextContent': 4
        }
    }
);

// ✅ PRE-SAVE MIDDLEWARE
ReportSchema.pre('save', function(next) {
    // Generate report ID if not provided
    if (!this.reportId) {
        this.reportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Extract plain text from HTML content for search
    if (this.reportContent?.htmlContent) {
        this.reportContent.plainTextContent = this.reportContent.htmlContent
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
        // Calculate statistics
        const plainText = this.reportContent.plainTextContent;
        this.reportContent.statistics = {
            wordCount: plainText ? plainText.split(/\s+/).length : 0,
            characterCount: plainText ? plainText.length : 0,
            pageCount: this.reportContent.htmlContent.match(/data-page="/g)?.length || 1,
            imageCount: this.reportContent.capturedImages?.length || 0 // ✅ NEW
        };
    }
    
    // Build search text
    const searchTerms = [
        this.patientInfo?.fullName || '',
        this.patientInfo?.patientName || '',
        this.patientId || '',
        this.accessionNumber || '',
        this.studyInfo?.examDescription || '',
        this.reportContent?.plainTextContent || '',
        this.studyInstanceUID || ''
    ].filter(term => term.trim().length > 0);
    
    this.searchText = searchTerms.join(' ').toLowerCase();
    
    // Limit history arrays to prevent document bloat
    if (this.workflowInfo?.statusHistory && this.workflowInfo.statusHistory.length > 50) {
        this.workflowInfo.statusHistory = this.workflowInfo.statusHistory.slice(-50);
    }
    
    if (this.downloadInfo?.downloadHistory && this.downloadInfo.downloadHistory.length > 100) {
        this.downloadInfo.downloadHistory = this.downloadInfo.downloadHistory.slice(-100);
    }
    
    // ✅ NEW: Limit captured images to prevent document bloat (max 50 images)
    if (this.reportContent?.capturedImages && this.reportContent.capturedImages.length > 50) {
        this.reportContent.capturedImages = this.reportContent.capturedImages.slice(-50);
    }
    
    next();
});

// ✅ INSTANCE METHODS
ReportSchema.methods.addStatusChange = function(status, changedBy, notes = '') {
    if (!this.workflowInfo) {
        this.workflowInfo = { statusHistory: [] };
    }
    if (!this.workflowInfo.statusHistory) {
        this.workflowInfo.statusHistory = [];
    }
    
    this.workflowInfo.statusHistory.push({
        status,
        changedAt: new Date(),
        changedBy,
        notes,
        userRole: changedBy.role || 'unknown'
    });
    
    this.reportStatus = status;
    return this.save();
};

ReportSchema.methods.addDownload = function(downloadedBy, downloadType = 'final') {
    if (!this.downloadInfo) {
        this.downloadInfo = { downloadHistory: [], totalDownloads: 0 };
    }
    if (!this.downloadInfo.downloadHistory) {
        this.downloadInfo.downloadHistory = [];
    }
    
    this.downloadInfo.downloadHistory.push({
        downloadedBy,
        downloadedAt: new Date(),
        downloadType,
        userRole: downloadedBy.role || 'unknown'
    });
    
    this.downloadInfo.totalDownloads = (this.downloadInfo.totalDownloads || 0) + 1;
    this.downloadInfo.lastDownloaded = new Date();
    
    return this.save();
};

ReportSchema.methods.addVerificationAction = function(action, performedBy, notes = '') {
    if (!this.verificationInfo) {
        this.verificationInfo = { verificationHistory: [] };
    }
    if (!this.verificationInfo.verificationHistory) {
        this.verificationInfo.verificationHistory = [];
    }
    
    this.verificationInfo.verificationHistory.push({
        action,
        performedBy,
        performedAt: new Date(),
        notes
    });
    
    return this.save();
};

// ✅ NEW: Instance method for verifier updates
ReportSchema.methods.updateDuringVerification = function(htmlContent, verifierId, notes = '') {
    const now = new Date();
    
    // Update content
    this.reportContent.htmlContent = htmlContent;
    
    // Recalculate statistics
    const plainText = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    this.reportContent.statistics = {
        wordCount: plainText ? plainText.split(/\s+/).length : 0,
        characterCount: plainText ? plainText.length : 0,
        pageCount: 1
    };
    
    // ✅ IMPORTANT: Keep status as finalized
    this.reportStatus = 'finalized';
    this.reportType = 'finalized';
    
    // Add workflow history
    if (!this.workflowInfo) {
        this.workflowInfo = { statusHistory: [] };
    }
    if (!this.workflowInfo.statusHistory) {
        this.workflowInfo.statusHistory = [];
    }
    
    this.workflowInfo.statusHistory.push({
        status: 'updated_during_verification',
        changedAt: now,
        changedBy: verifierId,
        notes: notes || 'Updated during verification',
        userRole: 'verifier'
    });
    
    // Add verification action
    this.addVerificationAction('report_updated', verifierId, notes);
    
    // Update timestamps
    this.updatedAt = now;
    
    return this.save();
};

// ✅ STATIC METHODS
ReportSchema.statics.findByPatient = function(patientId, options = {}) {
    const query = { patient: patientId };
    if (options.status) query.reportStatus = options.status;
    
    return this.find(query)
        .sort({ 'studyInfo.studyDate': -1, createdAt: -1 })
        .limit(options.limit || 50)
        .populate('doctorId', 'fullName email role')
        .populate('verifierId', 'fullName email role')
        .lean();
};

ReportSchema.statics.findByDoctor = function(doctorId, options = {}) {
    const query = { doctorId };
    if (options.status) query.reportStatus = options.status;
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .populate('patient', 'fullName patientId')
        .populate('verifierId', 'fullName email role')
        .lean();
};

ReportSchema.statics.findByStudy = function(studyId, options = {}) {
    const query = { dicomStudy: studyId };
    if (options.type) query.reportType = options.type;
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .populate('doctorId', 'fullName email role')
        .populate('verifierId', 'fullName email role')
        .lean();
};

export default mongoose.model('Report', ReportSchema);