import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
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
    
    // File identification
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
    
    // Document classification
    documentType: {
        type: String,
        enum: ['clinical', 'report', 'image', 'other'],
        default: 'other'
    },
    
    // Wasabi storage with organization prefix
    wasabiKey: {
        type: String,
        required: true,
        unique: true
    },
    wasabiBucket: {
        type: String,
        required: true
    },
    
    // Medical references with organization context
    patientId: {
        type: String,
        index: true
    },
    studyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DicomStudy',
        index: true
    },
    
    // Audit trail
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'documents'
});

// Multi-tenant indexes
documentSchema.index({ organizationIdentifier: 1, patientId: 1, documentType: 1 });
documentSchema.index({ organization: 1, studyId: 1, uploadedAt: -1 });
documentSchema.index({ organizationIdentifier: 1, wasabiKey: 1 });

export default mongoose.model('Document', documentSchema);