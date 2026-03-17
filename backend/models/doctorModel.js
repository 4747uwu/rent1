// models/Doctor.model.js
import mongoose from 'mongoose';

const DoctorSchema = new mongoose.Schema({
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
    
    userAccount: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    
    specialization: {
        type: String,
        required: [true, "Doctor's specialization is required"],
        trim: true,
    },
    licenseNumber: {
        type: String,
        trim: true,
    },
    department: {
        type: String,
        trim: true,
    },
    qualifications: [{
        type: String,
        trim: true,
    }],
    yearsOfExperience: {
        type: Number,
        min: 0,
    },
    contactPhoneOffice: {
        type: String,
        trim: true,
    },

    assigned: {
        type: Boolean,
        default: false,
    },

    // ✅ NEW: Verification Mode Toggle for Doctor
    requireReportVerification: {
        type: Boolean,
        default: true, // By default, reports need verification
        description: 'If true, finalized reports go to verifier. If false, they go directly to completed.'
    },
    verificationEnabledAt: { 
        type: Date 
    },
    verificationEnabledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    signature: {
        type: String,
        trim: true,
        default: '',
    },
    
    signatureMetadata: {
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        originalSize: {
            type: Number,
            default: 0
        },
        optimizedSize: {
            type: Number,
            default: 0
        },
        originalName: {
            type: String,
            default: ''
        },
        mimeType: {
            type: String,
            default: 'image/png'
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        format: {
            type: String,
            default: 'base64',
            enum: ['base64', 'buffer']
        },
        width: {
            type: Number,
            default: 400
        },
        height: {
            type: Number,
            default: 200
        }
    },
    
    signaturePresignedUrl: {
        type: String,
        default: ''
    },

    // Tracking arrays for assigned and completed studies
    assignedStudies: [{
        study: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DicomStudy',
            required: true
        },
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: true
        },
        assignedDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['assigned', 'in_progress'],
            default: 'assigned'
        }
    }],

    completedStudies: [{
        study: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DicomStudy'
        },
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient'
        },
        completedDate: {
            type: Date,
            default: Date.now
        }
    }],

    isActiveProfile: {
        type: Boolean,
        default: true,
    }
}, { 
    timestamps: true,
    collection: 'doctors'
});

// Multi-tenant indexes
DoctorSchema.index({ organizationIdentifier: 1, userAccount: 1 });
DoctorSchema.index({ organization: 1, isActiveProfile: 1 });
DoctorSchema.index({ 'assignedStudies.study': 1 });
DoctorSchema.index({ 'assignedStudies.patient': 1 });
DoctorSchema.index({ 'completedStudies.study': 1 });

const Doctor = mongoose.model('Doctor', DoctorSchema);
export default Doctor;