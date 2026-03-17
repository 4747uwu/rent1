// models/Patient.model.js
import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema({
    // Organization Reference - CRITICAL for multi-tenancy
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    
    organizationIdentifier: {
        type: String,
        required: true,
        uppercase: true,
        index: true
    },
    
    // Patient identifiers with organization prefix
    patientID: {
        type: String,
        required: [true, 'Application Patient ID is required'],
        trim: true,
        index: true,
    },
    
    // Global unique patient identifier
    globalPatientID: {
        type: String,
        unique: true,
        // index: true
    },
    
    mrn: {
        type: String,
        trim: true,
        index: true,
        sparse: true
    },
    issuerOfPatientID: {
        type: String,
        trim: true,
    },

    // Demographics
    salutation: {
        type: String,
        trim: true,
        enum: ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Master', 'Miss', 'n/a', 'N/A', '']
    },
    firstName: {
        type: String,
        trim: true,
    },
    lastName: {
        type: String,
        trim: true,
    },
    patientNameRaw: {
        type: String,
        trim: true,
    },
    dateOfBirth: {
        type: String,
        trim: true,
    },
    gender: {
        type: String,
        trim: true,
        uppercase: true,
        enum: ['M', 'F', 'O', 'N/A', ''],
        index: true
    },
    ageString: {
        type: String,
        trim: true,
    },

    // Workflow status
    currentWorkflowStatus: {
        type: String,
        enum: [
            'no_active_study',
            'new_study_received',
            'pending_assignment',
            'assigned_to_doctor',
            'report_in_progress',
            'report_downloaded_radiologist',
            'report_finalized',
            'report_drafted',
            'verification_pending',        // ✅ ADD THIS
            'report_verified',             // ✅ ADD THIS
            'report_rejected',             // ✅ ADD THIS
            'report_completed',  
            "report_reprint_needed",
            'revert_to_radiologist',          // ✅ ADD THIS
            'report_downloaded',
            'final_report_downloaded',
            'archived'
        ],
        default: 'no_active_study',
        index: true
    },
    
    activeDicomStudyRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DicomStudy',
        index: true
    },
    
    // Performance optimizations
    studyCount: { type: Number, default: 0 },
    lastStudyDate: { type: Date, index: true },
    
    contactInformation: {
        phone: { type: String, default: '' },
        email: { type: String, default: '', index: 'text' }
    },
    
    clinicalInfo: {
        clinicalHistory: String,
        previousInjury: String,
        previousSurgery: String,
        lastModifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        lastModifiedAt: { type: Date, index: true }
    },
    
    computed: {
        fullName: String,
        displayAge: String,
        lastActivity: Date
    }
}, { 
    timestamps: true,
    read: 'primary',
    writeConcern: { w: 1, j: false }
});

// Multi-tenant indexes
PatientSchema.index({ organizationIdentifier: 1, patientID: 1 }, { unique: true });
PatientSchema.index({ organization: 1, currentWorkflowStatus: 1, createdAt: -1 });
PatientSchema.index({ organizationIdentifier: 1, currentWorkflowStatus: 1, createdAt: -1 });
PatientSchema.index({ globalPatientID: 1 });

// Pre-save middleware
PatientSchema.pre('save', function(next) {
    // Create global patient ID
    if (this.organizationIdentifier && this.patientID) {
        this.globalPatientID = `${this.organizationIdentifier}_${this.patientID}`;
    }
    
    // Update computed fields
    this.computed.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
    this.computed.lastActivity = new Date();
    
    next();
});

export default mongoose.model('Patient', PatientSchema);