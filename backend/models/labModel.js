// models/Lab.model.js
import mongoose from 'mongoose';

const LabSchema = new mongoose.Schema({
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
    
    name: {
        type: String,
        required: [true, 'Laboratory name is required'],
        trim: true,
    },
    
    identifier: {
        type: String,
        required: [true, 'Laboratory identifier is required'],
        trim: true,
        uppercase: true,
    },
    
    // Full unique identifier combining organization and lab
    fullIdentifier: {
        type: String,
        unique: true,
        index: true
    },
    
    contactPerson: {
        type: String,
        trim: true,
    },
    contactEmail: {
        type: String,
        trim: true,
        lowercase: true,
    },
    contactPhone: {
        type: String,
        trim: true,
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    notes: {
        type: String,
        trim: true,
    },
    
    // Lab specific settings
    settings: {
        autoAssignStudies: { type: Boolean, default: false },
        defaultPriority: {
            type: String,
            enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
            default: 'NORMAL'
        },
        maxConcurrentStudies: { type: Number, default: 100 },
        // ✅ NEW: Verification Mode Toggle
        requireReportVerification: { 
            type: Boolean, 
            default: true, // By default, reports need verification
            description: 'If true, finalized reports go to verifier. If false, they go directly to completed.'
        },
        verificationEnabledAt: { type: Date },
        verificationEnabledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        // ✅ NEW: Compression Mode Toggle
        enableCompression: {
            type: Boolean,
            default: false, // By default, compression is disabled
            description: 'If true, DICOM studies will be compressed for storage optimization.'
        },
        compressionEnabledAt: { type: Date },
        compressionEnabledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        compressionDisabledAt: { type: Date },
        compressionDisabledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    
    // ✅ NEW: Staff management
    staffUsers: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        role: {
            type: String,
            enum: ['lab_staff', 'receptionist', 'billing'],
            default: 'lab_staff'
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // ✅ UPDATED: Report Branding Settings with Enhanced Image Storage
    reportBranding: {
        headerImage: {
            url: { type: String, default: '' }, // Base64 data URL: data:image/png;base64,...
            width: { type: Number, default: 0 }, // Actual image width in pixels
            height: { type: Number, default: 0 }, // Actual image height in pixels
            size: { type: Number, default: 0 }, // Size in bytes
            updatedAt: { type: Date },
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        },
        footerImage: {
            url: { type: String, default: '' }, // Base64 data URL: data:image/png;base64,...
            width: { type: Number, default: 0 }, // Actual image width in pixels
            height: { type: Number, default: 0 }, // Actual image height in pixels
            size: { type: Number, default: 0 }, // Size in bytes
            updatedAt: { type: Date },
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        },
        showHeader: { type: Boolean, default: true },
        showFooter: { type: Boolean, default: true },
        // ✅ NEW: A4 Paper Dimensions & Header/Footer Heights (in mm)
        paperSettings: {
            paperWidth: { type: Number, default: 210 }, // A4 width in mm
            paperHeight: { type: Number, default: 297 }, // A4 height in mm
            marginTop: { type: Number, default: 25.4 }, // 1 inch in mm
            marginBottom: { type: Number, default: 25.4 }, // 1 inch in mm
            marginLeft: { type: Number, default: 25.4 }, // 1 inch in mm
            marginRight: { type: Number, default: 25.4 }, // 1 inch in mm
            headerHeight: { type: Number, default: 30 }, // Header area height in mm
            footerHeight: { type: Number, default: 20 }, // Footer area height in mm
            dpi: { type: Number, default: 96 } // DPI for pixel to mm conversion
        },
        // Remove old aspect ratio fields since we're using actual dimensions
        // headerAspectRatio: { type: Number, default: 5 }, // REMOVED
        // footerAspectRatio: { type: Number, default: 5 }  // REMOVED
    }
}, { 
    timestamps: true,
    collection: 'labs'
});

// Compound indexes for multi-tenancy
LabSchema.index({ organizationIdentifier: 1, identifier: 1 }, { unique: true });
LabSchema.index({ organization: 1, isActive: 1 });
LabSchema.index({ fullIdentifier: 1 });
LabSchema.index({ 'staffUsers.userId': 1 }); // ✅ NEW: Staff user index

// Pre-save middleware to create fullIdentifier
LabSchema.pre('save', function(next) {
    if (this.organizationIdentifier && this.identifier) {
        this.fullIdentifier = `${this.organizationIdentifier}_${this.identifier}`;
    }
    next();
});

// ✅ NEW: Virtual for active staff count
LabSchema.virtual('activeStaffCount').get(function() {
    return this.staffUsers ? this.staffUsers.filter(staff => staff.isActive).length : 0;
});

// ✅ NEW: Virtual for calculated dimensions
LabSchema.virtual('reportBranding.calculatedDimensions').get(function() {
    const settings = this.reportBranding?.paperSettings || {};
    const dpi = settings.dpi || 96;
    
    // Convert mm to pixels for display
    const mmToPixels = (mm) => Math.round((mm * dpi) / 25.4);
    
    return {
        paperWidthPx: mmToPixels(settings.paperWidth || 210),
        paperHeightPx: mmToPixels(settings.paperHeight || 297),
        headerHeightPx: mmToPixels(settings.headerHeight || 30),
        footerHeightPx: mmToPixels(settings.footerHeight || 20),
        contentAreaWidthPx: mmToPixels((settings.paperWidth || 210) - (settings.marginLeft || 25.4) - (settings.marginRight || 25.4)),
        contentAreaHeightPx: mmToPixels((settings.paperHeight || 297) - (settings.marginTop || 25.4) - (settings.marginBottom || 25.4) - (settings.headerHeight || 30) - (settings.footerHeight || 20))
    };
});

const Lab = mongoose.model('Lab', LabSchema);
export default Lab;