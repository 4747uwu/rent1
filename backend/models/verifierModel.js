import mongoose from 'mongoose';

const VerifierSchema = new mongoose.Schema({
    // Link to User account
    userAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    
    // Organization reference for multi-tenancy
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
    
    // Professional Information
    specialization: {
        type: [String],
        default: ['General Radiology'],
        enum: [
            'General Radiology',
            'Neuroradiology',
            'Chest Radiology',
            'Abdominal Radiology',
            'Musculoskeletal Radiology',
            'Cardiovascular Radiology',
            'Pediatric Radiology',
            'Emergency Radiology',
            'Interventional Radiology',
            'Nuclear Medicine',
            'Mammography',
            'Ultrasound'
        ]
    },
    
    licenseNumber: {
        type: String,
        trim: true,
        sparse: true
    },
    
    department: {
        type: String,
        trim: true,
        default: 'Radiology'
    },
    
    qualifications: [{
        degree: String,
        institution: String,
        year: Number
    }],
    
    yearsOfExperience: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Verification Configuration
    verificationConfig: {
        // Radiologists this verifier can review reports from
        assignedRadiologists: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true
        }],
        
        // Modalities this verifier specializes in
        specializedModalities: [{
            type: String,
            enum: ['CT', 'MRI', 'X-RAY', 'ULTRASOUND', 'MAMMOGRAPHY', 'PET-CT', 'NUCLEAR', 'FLUOROSCOPY']
        }],
        
        // Maximum concurrent verifications
        maxConcurrentVerifications: {
            type: Number,
            default: 20,
            min: 1,
            max: 100
        },
        
        // Auto-assignment preferences
        autoAcceptAssignments: {
            type: Boolean,
            default: false
        },
        
        // Priority handling
        priorityHandling: {
            type: String,
            enum: ['emergency_first', 'oldest_first', 'balanced'],
            default: 'emergency_first'
        }
    },
    
    // Digital Signature for report verification
    signature: {
        type: String, // Base64 encoded signature image
        select: false // Don't include in regular queries for security
    },
    
    signatureMetadata: {
        uploadedAt: Date,
        originalSize: Number,
        optimizedSize: Number,
        originalName: String,
        mimeType: String,
        lastUpdated: Date,
        format: {
            type: String,
            enum: ['base64', 'url'],
            default: 'base64'
        },
        dimensions: {
            width: Number,
            height: Number
        }
    },
    
    // Contact Information
    contactInfo: {
        phoneOffice: String,
        phoneMobile: String,
        emergencyContact: String,
        alternateEmail: String
    },
    
    // Verification Statistics
    verificationStats: {
        totalReportsVerified: {
            type: Number,
            default: 0,
            min: 0
        },
        
        reportsVerifiedToday: {
            type: Number,
            default: 0,
            min: 0
        },
        
        reportsVerifiedThisMonth: {
            type: Number,
            default: 0,
            min: 0
        },
        
        averageVerificationTime: {
            type: Number, // in minutes
            default: 0
        },
        
        qualityScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        
        // TAT metrics
        averageTATMinutes: {
            type: Number,
            default: 0
        },
        
        onTimeVerificationRate: {
            type: Number, // percentage
            default: 0,
            min: 0,
            max: 100
        },
        
        lastVerificationAt: Date,
        
        // Weekly/Monthly trends
        weeklyVerificationCount: [{
            week: String, // YYYY-WW format
            count: Number
        }],
        
        monthlyVerificationCount: [{
            month: String, // YYYY-MM format
            count: Number
        }]
    },
    
    // Work Schedule
    workSchedule: {
        workingHours: {
            monday: { start: String, end: String, isWorking: { type: Boolean, default: true } },
            tuesday: { start: String, end: String, isWorking: { type: Boolean, default: true } },
            wednesday: { start: String, end: String, isWorking: { type: Boolean, default: true } },
            thursday: { start: String, end: String, isWorking: { type: Boolean, default: true } },
            friday: { start: String, end: String, isWorking: { type: Boolean, default: true } },
            saturday: { start: String, end: String, isWorking: { type: Boolean, default: false } },
            sunday: { start: String, end: String, isWorking: { type: Boolean, default: false } }
        },
        
        timezone: {
            type: String,
            default: 'Asia/Kolkata'
        },
        
        emergencyAvailability: {
            type: Boolean,
            default: false
        }
    },
    
    // Current Status
    currentStatus: {
        type: String,
        enum: ['available', 'busy', 'offline', 'on_leave'],
        default: 'available',
        index: true
    },
    
    currentWorkload: {
        pendingVerifications: {
            type: Number,
            default: 0,
            min: 0
        },
        
        inProgressVerifications: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    
    // Profile flags
    isActiveProfile: {
        type: Boolean,
        default: true,
        index: true
    },
    
    isAvailableForAssignment: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Audit fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Activity tracking
    lastActiveAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    loginHistory: [{
        loginAt: Date,
        ipAddress: String,
        userAgent: String
    }]
}, {
    timestamps: true,
    collection: 'verifiers'
});

// Indexes for performance
VerifierSchema.index({ organizationIdentifier: 1, isActiveProfile: 1 });
VerifierSchema.index({ 'verificationConfig.assignedRadiologists': 1 });
VerifierSchema.index({ 'verificationConfig.specializedModalities': 1 });
VerifierSchema.index({ currentStatus: 1, isAvailableForAssignment: 1 });
VerifierSchema.index({ 'verificationStats.lastVerificationAt': 1 });
VerifierSchema.index({ createdAt: 1 });

// Virtual for full user information
VerifierSchema.virtual('fullUserInfo', {
    ref: 'User',
    localField: 'userAccount',
    foreignField: '_id',
    justOne: true
});

// Method to update verification statistics
VerifierSchema.methods.updateVerificationStats = function(verificationData) {
    this.verificationStats.totalReportsVerified += 1;
    this.verificationStats.reportsVerifiedToday += 1;
    this.verificationStats.reportsVerifiedThisMonth += 1;
    this.verificationStats.lastVerificationAt = new Date();
    
    if (verificationData.verificationTimeMinutes) {
        // Calculate running average
        const total = this.verificationStats.totalReportsVerified;
        const currentAvg = this.verificationStats.averageVerificationTime;
        this.verificationStats.averageVerificationTime = 
            ((currentAvg * (total - 1)) + verificationData.verificationTimeMinutes) / total;
    }
    
    return this.save();
};

// Method to check availability
VerifierSchema.methods.isAvailable = function() {
    if (!this.isActiveProfile || !this.isAvailableForAssignment) {
        return false;
    }
    
    if (this.currentStatus !== 'available') {
        return false;
    }
    
    // Check workload
    const totalWorkload = this.currentWorkload.pendingVerifications + this.currentWorkload.inProgressVerifications;
    if (totalWorkload >= this.verificationConfig.maxConcurrentVerifications) {
        return false;
    }
    
    return true;
};

// Method to get verification capacity
VerifierSchema.methods.getAvailableCapacity = function() {
    const totalWorkload = this.currentWorkload.pendingVerifications + this.currentWorkload.inProgressVerifications;
    return Math.max(0, this.verificationConfig.maxConcurrentVerifications - totalWorkload);
};

// Static method to find available verifiers
VerifierSchema.statics.findAvailableVerifiers = function(organizationIdentifier, specialization = null, modality = null) {
    const query = {
        organizationIdentifier,
        isActiveProfile: true,
        isAvailableForAssignment: true,
        currentStatus: 'available'
    };
    
    if (specialization) {
        query.specialization = specialization;
    }
    
    if (modality) {
        query['verificationConfig.specializedModalities'] = modality;
    }
    
    return this.find(query)
        .populate('userAccount', 'fullName email isActive')
        .sort({ 'currentWorkload.pendingVerifications': 1, 'verificationStats.averageVerificationTime': 1 });
};

// Pre-save middleware
VerifierSchema.pre('save', function(next) {
    if (this.isModified('lastActiveAt')) {
        this.lastActiveAt = new Date();
    }
    next();
});

// Reset daily counters (should be called by a cron job)
VerifierSchema.statics.resetDailyCounters = async function() {
    return this.updateMany(
        {},
        { $set: { 'verificationStats.reportsVerifiedToday': 0 } }
    );
};

const Verifier = mongoose.model('Verifier', VerifierSchema);
export default Verifier;