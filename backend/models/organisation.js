import mongoose from 'mongoose';

const OrganizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Organization name is required'],
        unique: true, // Automatically creates a unique index
        trim: true
    },
    identifier: {
        type: String,
        required: [true, 'Organization identifier is required'],
        unique: true, // Automatically creates a unique index
        trim: true,
        uppercase: true,
        match: [/^[A-Z0-9_]+$/, 'Identifier must contain only uppercase letters, numbers, and underscores']
    },
    displayName: {
        type: String,
        required: true,
        trim: true
    },

    // Company Information
    companyType: {
        type: String,
        enum: ['hospital', 'clinic', 'imaging_center', 'teleradiology', 'diagnostic_center'],
        required: true
    },

    // Contact Information
    contactInfo: {
        primaryContact: {
            name: { type: String, trim: true },
            email: { type: String, trim: true, lowercase: true }, // Emails often need indexing if used for lookup
            phone: { type: String, trim: true },
            designation: { type: String, trim: true }
        },
        billingContact: {
            name: { type: String, trim: true },
            email: { type: String, trim: true, lowercase: true },
            phone: { type: String, trim: true }
        },
        technicalContact: {
            name: { type: String, trim: true },
            email: { type: String, trim: true, lowercase: true },
            phone: { type: String, trim: true }
        }
    },

    // Address Information
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true },
        country: { type: String, trim: true, default: 'USA' }
    },

    // Organization Settings
    settings: {
        timezone: { type: String, default: 'UTC' },
        dateFormat: { type: String, default: 'MM/DD/YYYY' },
        currency: { type: String, default: 'USD' },
        language: { type: String, default: 'en' }
    },

    // Subscription & Billing
    subscription: {
        plan: {
            type: String,
            enum: ['basic', 'professional', 'enterprise', 'custom'],
            default: 'basic'
        },
        maxUsers: { type: Number, default: 10 },
        maxStudiesPerMonth: { type: Number, default: 1000 },
        maxStorageGB: { type: Number, default: 100 },
        billingCycle: {
            type: String,
            enum: ['monthly', 'quarterly', 'annually'],
            default: 'monthly'
        },
        subscriptionStartDate: Date,
        subscriptionEndDate: Date,
        autoRenewal: { type: Boolean, default: true }
    },

    // Feature Permissions
    features: {
        aiAnalysis: { type: Boolean, default: false },
        advancedReporting: { type: Boolean, default: false },
        multiModalitySupport: { type: Boolean, default: true },
        cloudStorage: { type: Boolean, default: true },
        mobileAccess: { type: Boolean, default: true },
        apiAccess: { type: Boolean, default: false },
        whiteLabeling: { type: Boolean, default: false }
    },

    // Status & Compliance
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'trial', 'expired'],
        default: 'trial'
        // REMOVED inline index: true. It is covered by the compound index below.
    },

    compliance: {
        hipaaCompliant: { type: Boolean, default: false },
        dicomCompliant: { type: Boolean, default: true },
        hl7Integration: { type: Boolean, default: false },
        fda510k: { type: Boolean, default: false }
    },

    // Audit & Tracking
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // Added index below for "Find all orgs created by User X"
    },

    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Navbar Logo (stored as binary in DB)
    navbarLogo: {
        data: { type: Buffer },
        contentType: { type: String },
        filename: { type: String },
        uploadedAt: { type: Date }
    },

    // Query call number displayed in table footer
    queryCallNumber: {
        type: String,
        trim: true,
        default: ''
    },

    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true,
    collection: 'organizations'
});

// ==========================================
// 🚀 ULTRA-FAST INDEX STRATEGY
// ==========================================

// 1. DASHBOARD SORTING (Most Critical)
// Covers: "Show me active organizations, most recently created first."
// This replaces the single index on 'status'.
OrganizationSchema.index({ status: 1, createdAt: -1 });

// 2. SEARCH CAPABILITY
// Covers: Search bar functionality (e.g., searching "General Hospital" or "ORG_001").
// Standard regex is slow; Text index is fast.
OrganizationSchema.index({ name: 'text', displayName: 'text', identifier: 'text' });

// 3. USER RELATIONSHIPS
// Covers: "Show me the organizations I created."
OrganizationSchema.index({ createdBy: 1 });

// Covers: "Find all subscriptions expiring in the next 7 days that have auto-renewal on."
OrganizationSchema.index({ 'subscription.subscriptionEndDate': 1, 'subscription.autoRenewal': 1 });


// Covers: Filtering by plan (e.g., "Show me all Enterprise users").
OrganizationSchema.index({ 'subscription.plan': 1 });

// REMOVED: { identifier: 1, status: 1 }
// Reason: 'identifier' is already unique. If you query by identifier, you find 1 document immediately. 
// Adding 'status' to this index creates overhead with zero speed gain.

// REMOVED: { status: 1 }
// Reason: Covered by the { status: 1, createdAt: -1 } index (Left-Most Prefix Rule).


OrganizationSchema.virtual('activeUsers', {
    ref: 'User',
    localField: '_id',
    foreignField: 'organization',
    count: true,
    match: { isActive: true }
});

OrganizationSchema.virtual('activeLabs', {
    ref: 'Lab',
    localField: '_id',
    foreignField: 'organization',
    count: true,
    match: { isActive: true }
});

export default mongoose.model('Organization', OrganizationSchema);