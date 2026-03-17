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
        maxConcurrentStudies: { type: Number, default: 100 }
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
    }]
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

const Lab = mongoose.model('Lab', LabSchema);
export default Lab;