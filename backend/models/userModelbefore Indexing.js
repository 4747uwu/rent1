// // models/User.model.js
// import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs';
// import dotenv from 'dotenv';

// dotenv.config();

// const UserSchema = new mongoose.Schema({
//     // Organization Reference - CRITICAL for multi-tenancy
//     organization: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Organization',
//         required: function() {
//             return this.role !== 'super_admin'; // Super admin doesn't need organization
//         },
//         index: true
//     },
    
//     organizationIdentifier: {
//         type: String,
//         required: function() {
//             return this.role !== 'super_admin';
//         },
//         uppercase: true,
//         index: true // Critical for tenant separation
//     },
    
//     username: {
//         type: String,
//         required: [true, 'Username is required'],
//         trim: true,
//         lowercase: true,
//         // Compound unique index with organization for multi-tenancy
//         index: true
//     },
    
//     email: {
//         type: String,
//         required: [true, 'Email is required'],
//         trim: true,
//         lowercase: true,
//         match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
//         index: true
//     },
    
//     password: {
//         type: String,
//         required: [true, 'Password is required'],
//         minlength: [6, 'Password must be at least 6 characters long'],
//         select: false,
//     },
    
//     tempPassword:{
//         type: String,
//         required: [true, 'Temp Password is Needed'],
//         select: false,
//     },
    
//     fullName: {
//         type: String,
//         required: [true, 'Full name is required'],
//         trim: true,
//     },

    
//     // ✅ UPDATED ROLE SYSTEM
//     role: {
//         type: String,
//         enum: [
//             'super_admin',        // System-wide control
//             'admin',              // Company/Center admin (can create all other roles)
//             'group_id',           // Role creator (can create assignor, radiologist, verifier, etc.)
//             'assignor',           // Assigns cases to radiologists/verifiers
//             'radiologist',        // Views cases, creates reports, forwards to verifier
//             'verifier',           // Reviews and finalizes reports
//             'physician',          // Referral doctor (view reports of referred patients)
//             'receptionist',       // Patient registration, print reports
//             'billing',            // Generate bills, maintain billing info
//             'typist',             // Support radiologist by typing reports
//             'dashboard_viewer',   // Read-only dashboard access
//             'lab_staff',          // Legacy role (kept for backward compatibility)
//             'doctor_account',     // Legacy role (kept for backward compatibility)
//             'owner'               // Legacy role (kept for backward compatibility)
//         ],
//         required: [true, 'User role is required'],
//         index: true
//     },
    
//     // ✅ HIERARCHY RELATIONSHIPS
//     hierarchy: {
//         // Who created this user
//         createdBy: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             index: true
//         },
        
//         // Parent role in hierarchy (e.g., assignor for radiologist)
//         parentUser: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             index: true
//         },
        
//         // Child users created by this user
//         childUsers: [{
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User'
//         }],
        
//         // Company/Center type
//         organizationType: {
//             type: String,
//             enum: ['teleradiology_company', 'diagnostic_center', 'hospital', 'clinic'],
//             default: 'teleradiology_company'
//         }
//     },
    
//     // ✅ ROLE-SPECIFIC CONFIGURATIONS
//     roleConfig: {
//         // For Typist - linked to specific radiologist
//         linkedRadiologist: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User',
//             index: true
//         },
        
//         // For Verifier - which radiologists can send to them
//         assignedRadiologists: [{
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'User'
//         }],
        
//         // For Assignor - which radiologists/verifiers they can assign to
//         assignableUsers: [{
//             userId: {
//                 type: mongoose.Schema.Types.ObjectId,
//                 ref: 'User'
//             },
//             role: {
//                 type: String,
//                 enum: ['radiologist', 'verifier']
//             }
//         }],
        
//         // ✅ NEW: For Assignor - Lab access control
//         assignedLabs: [{
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Lab'
//         }],
        
//         // ✅ NEW: Lab access mode
//         labAccessMode: {
//             type: String,
//             enum: ['all', 'selected', 'none'],
//             default: 'all',
//             description: 'all = see all labs, selected = only assigned labs, none = no lab access'
//         },
        
//         // For Physician - which patients they can view
//         allowedPatients: [String], // Patient IDs they can access
        
//         // For Dashboard Viewer - what they can see
//         dashboardAccess: {
//             viewWorkload: { type: Boolean, default: false },
//             viewTAT: { type: Boolean, default: false },
//             viewRevenue: { type: Boolean, default: false },
//             viewReports: { type: Boolean, default: false }
//         }
//     },
    
//     // ✅ NEW FEATURE 1: Column-based Restriction
//     visibleColumns: [{
//         type: String,
//         trim: true
//     }],
    
//     // ✅ NEW FEATURE 2: Multi-Account Setup
//     accountRoles: [{
//         type: String,
//         enum: ['super_admin', 'admin', 'group_id', 'assignor', 'radiologist', 
//                'verifier', 'physician', 'receptionist', 'billing', 'typist', 
//                'dashboard_viewer', 'lab_staff', 'doctor_account', 'owner'],
//         trim: true
//     }],
    
//     primaryRole: {
//         type: String,
//         enum: ['super_admin', 'admin', 'group_id', 'assignor', 'radiologist', 
//                'verifier', 'physician', 'receptionist', 'billing', 'typist', 
//                'dashboard_viewer', 'lab_staff', 'doctor_account', 'owner'],
//         required: function() {
//             return this.accountRoles && this.accountRoles.length > 1;
//         }
//     },
    
//     // ✅ FEATURE 3: Lab/Center Linking
//     linkedLabs: [{
//         labId: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: 'Lab',
//             required: true
//         },
//         labName: {
//             type: String,
//             trim: true
//         },
//         labIdentifier: {
//             type: String,
//             uppercase: true,
//             trim: true
//         },
//         linkedAt: {
//             type: Date,
//             default: Date.now
//         },
//         permissions: {
//             canViewStudies: { type: Boolean, default: true },
//             canAssignStudies: { type: Boolean, default: false },
//             canManageStaff: { type: Boolean, default: false }
//         }
//     }],
    
//     // ✅ ENHANCED PERMISSIONS SYSTEM
//     permissions: {
//         // Case Management
//         canCreateCases: { type: Boolean, default: false },
//         canAssignCases: { type: Boolean, default: false },
//         canViewCases: { type: Boolean, default: false },
//         canEditCases: { type: Boolean, default: false },
        
//         // Report Management
//         canCreateReports: { type: Boolean, default: false },
//         canEditReports: { type: Boolean, default: false },
//         canVerifyReports: { type: Boolean, default: false },
//         canFinalizeReports: { type: Boolean, default: false },
//         canDownloadReports: { type: Boolean, default: false },
//         canPrintReports: { type: Boolean, default: false },
        
//         // User Management
//         canCreateUsers: { type: Boolean, default: false },
//         canManageUsers: { type: Boolean, default: false },
//         canViewUsers: { type: Boolean, default: false },
        
//         // Patient Management
//         canRegisterPatients: { type: Boolean, default: false },
//         canEditPatients: { type: Boolean, default: false },
//         canViewPatients: { type: Boolean, default: false },
        
//         // Billing & Financial
//         canGenerateBills: { type: Boolean, default: false },
//         canViewBilling: { type: Boolean, default: false },
//         canManagePricing: { type: Boolean, default: false },
        
//         // Dashboard & Analytics
//         canViewDashboard: { type: Boolean, default: false },
//         canViewAnalytics: { type: Boolean, default: false },
//         canExportData: { type: Boolean, default: false },
        
//         // DICOM Viewer
//         canUseDicomViewer: { type: Boolean, default: false },
//         canUse2DTools: { type: Boolean, default: false },
//         canUseMPRTools: { type: Boolean, default: false },
//         canUse3DTools: { type: Boolean, default: false },
        
//         // Voice & Templates
//         canUseVoiceDictation: { type: Boolean, default: false },
//         canUseSavedTemplates: { type: Boolean, default: false },
//         canCreateTemplates: { type: Boolean, default: false },
        
//         // System Administration
//         canManageOrganizations: { type: Boolean, default: false },
//         canViewSystemReports: { type: Boolean, default: false },
//         canManageBackups: { type: Boolean, default: false }
//     },
    
//     isLoggedIn: {
//         type: Boolean,
//         default: false,
//     },
    
//     isActive: {
//         type: Boolean,
//         default: true,
//         index: true
//     },
    
//     // ✅ LEGACY FIELDS (for backward compatibility)
//     lab: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Lab',
//         index: true
//     },
    
//     // Password reset fields
//     resetPasswordOTP: {
//         type: String,
//         select: false
//     },
//     resetPasswordOTPExpires: {
//         type: Date,
//         select: false
//     },
//     resetPasswordAttempts: {
//         type: Number,
//         default: 0,
//         select: false
//     },
//     resetPasswordLockedUntil: {
//         type: Date,
//         select: false
//     },
    
//     // Audit fields
//     createdBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//     },
    
//     lastLoginAt: {
//         type: Date,
//         index: true
//     },
    
//     loginCount: {
//         type: Number,
//         default: 0
//     },
    
//     // ✅ ACTIVITY TRACKING
//     activityStats: {
//         casesAssigned: { type: Number, default: 0 },
//         reportsCreated: { type: Number, default: 0 },
//         reportsVerified: { type: Number, default: 0 },
//         reportsTyped: { type: Number, default: 0 },
//         lastActivityAt: { type: Date },
//         totalWorkingHours: { type: Number, default: 0 }
//     }
// }, { 
//     timestamps: true,
//     collection: 'users'
// });

// // Compound indexes for multi-tenancy
// UserSchema.index({ organizationIdentifier: 1, username: 1 }, { unique: true });
// UserSchema.index({ organizationIdentifier: 1, email: 1 }, { unique: true });
// UserSchema.index({ organization: 1, role: 1, isActive: 1 });
// UserSchema.index({ role: 1, isActive: 1 });

// // Pre-save middleware
// UserSchema.pre('save', async function (next) {
//     // Hash password if modified
//     if (this.isModified('password')) {
//         const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
//         this.password = await bcrypt.hash(this.password, salt);
//     }
    
//     // Set permissions based on role
//     if (this.isModified('role') || this.isNew) {
//         this.setPermissionsByRole();
//     }
    
//     next();
// });

// // Method to set permissions based on role
// UserSchema.methods.setPermissionsByRole = function() {
//     // Reset all permissions
//     this.permissions = {};
    
//     switch (this.role) {
//         case 'super_admin':
//             this.permissions = {
//                 canManageOrganizations: true,
//                 canViewAllOrganizations: true,
//                 canManageGlobalSettings: true,
//                 canAccessSystemReports: true,
//                 canManageUsers: true,
//                 canManageLabs: true,
//                 canViewReports: true,
//                 canManageSettings: true,
//                 canViewAllLabs: true,
//                 canManageBilling: true,
//                 canSetPricing: true,
//                 canGenerateReports: true
//             };
//             break;
            
//         case 'admin':
//             this.permissions = {
//                 canManageUsers: true,
//                 canManageLabs: true,
//                 canViewReports: true,
//                 canManageSettings: true,
//                 canViewAllLabs: true
//             };
//             break;
            
//         case 'owner':
//             this.permissions = {
//                 canViewAllLabs: true,
//                 canManageBilling: true,
//                 canSetPricing: true,
//                 canGenerateReports: true
//             };
//             break;
            
//         case 'doctor_account':
//             this.permissions = {
//                 canViewReports: true
//             };
//             break;
            
//         case 'lab_staff':
//             this.permissions = {};
//             break;
//     }
// };

// UserSchema.methods.comparePassword = async function (enteredPassword) {
//     return await bcrypt.compare(enteredPassword, this.password);
// };

// const User = mongoose.model('User', UserSchema);
// export default User;



import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const UserSchema = new mongoose.Schema({
    // Organization Reference - CRITICAL for multi-tenancy
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: function() {
            return this.role !== 'super_admin';
        },
        index: true
    },
    
    organizationIdentifier: {
        type: String,
        required: function() {
            return this.role !== 'super_admin';
        },
        uppercase: true,
        index: true
    },
    
    username: {
        type: String,
        required: [true, 'Username is required'],
        trim: true,
        lowercase: true,
        index: true
    },
    
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
        index: true
    },
    
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
        select: false,
    },

    tempPassword:{
        type: String,
        required: [true, 'Temp Password is Needed'],
        select: false,
    },
    
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
    },

    
    // ✅ UPDATED ROLE SYSTEM
    role: {
        type: String,
        enum: [
            'super_admin',        // System-wide control
            'admin',              // Company/Center admin (can create all other roles)
            'group_id',           // Role creator (can create assignor, radiologist, verifier, etc.)
            'assignor',           // Assigns cases to radiologists/verifiers
            'radiologist',        // Views cases, creates reports, forwards to verifier
            'verifier',           // Reviews and finalizes reports
            'physician',          // Referral doctor (view reports of referred patients)
            'receptionist',       // Patient registration, print reports
            'billing',            // Generate bills, maintain billing info
            'typist',             // Support radiologist by typing reports
            'dashboard_viewer',   // Read-only dashboard access
            'lab_staff',          // Legacy role (kept for backward compatibility)
            'doctor_account',     // Legacy role (kept for backward compatibility)
            'owner'               // Legacy role (kept for backward compatibility)
        ],
        required: [true, 'User role is required'],
        index: true
    },
    
    // ✅ HIERARCHY RELATIONSHIPS
    hierarchy: {
        // Who created this user
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true
        },
        
        // Parent role in hierarchy (e.g., assignor for radiologist)
        parentUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true
        },
        
        // Child users created by this user
        childUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        
        // Company/Center type
        organizationType: {
            type: String,
            enum: ['teleradiology_company', 'diagnostic_center', 'hospital', 'clinic'],
            default: 'teleradiology_company'
        }
    },
    
    // ✅ ROLE-SPECIFIC CONFIGURATIONS
    roleConfig: {
        // For Typist - linked to specific radiologist
        linkedRadiologist: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true
        },
        
        // For Verifier - which radiologists can send to them
        assignedRadiologists: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        
        // For Assignor - which radiologists/verifiers they can assign to
        assignableUsers: [{
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            role: {
                type: String,
                enum: ['radiologist', 'verifier']
            }
        }],
        
        // ✅ NEW: For Assignor - Lab access control
        assignedLabs: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lab'
        }],
        
        // ✅ NEW: Lab access mode
        labAccessMode: {
            type: String,
            enum: ['all', 'selected', 'none'],
            default: 'all',
            description: 'all = see all labs, selected = only assigned labs, none = no lab access'
        },
        
        // For Physician - which patients they can view
        allowedPatients: [String], // Patient IDs they can access
        
        // For Dashboard Viewer - what they can see
        dashboardAccess: {
            viewWorkload: { type: Boolean, default: false },
            viewTAT: { type: Boolean, default: false },
            viewRevenue: { type: Boolean, default: false },
            viewReports: { type: Boolean, default: false }
        }
    },
    
    // ✅ NEW FEATURE 1: Column-based Restriction
    visibleColumns: [{
        type: String,
        trim: true
    }],
    
    // ✅ NEW FEATURE 2: Multi-Account Setup
    accountRoles: [{
        type: String,
        enum: ['super_admin', 'admin', 'group_id', 'assignor', 'radiologist', 
               'verifier', 'physician', 'receptionist', 'billing', 'typist', 
               'dashboard_viewer', 'lab_staff', 'doctor_account', 'owner'],
        trim: true
    }],
    
    primaryRole: {
        type: String,
        enum: ['super_admin', 'admin', 'group_id', 'assignor', 'radiologist', 
               'verifier', 'physician', 'receptionist', 'billing', 'typist', 
               'dashboard_viewer', 'lab_staff', 'doctor_account', 'owner'],
        required: function() {
            return this.accountRoles && this.accountRoles.length > 1;
        }
    },
    
    // ✅ FEATURE 3: Lab/Center Linking
    linkedLabs: [{
        labId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lab',
            required: true
        },
        labName: {
            type: String,
            trim: true
        },
        labIdentifier: {
            type: String,
            uppercase: true,
            trim: true
        },
        linkedAt: {
            type: Date,
            default: Date.now
        },
        permissions: {
            canViewStudies: { type: Boolean, default: true },
            canAssignStudies: { type: Boolean, default: false },
            canManageStaff: { type: Boolean, default: false }
        }
    }],
    
    // ✅ ENHANCED PERMISSIONS SYSTEM
    permissions: {
        // Case Management
        canCreateCases: { type: Boolean, default: false },
        canAssignCases: { type: Boolean, default: false },
        canViewCases: { type: Boolean, default: false },
        canEditCases: { type: Boolean, default: false },
        
        // Report Management
        canCreateReports: { type: Boolean, default: false },
        canEditReports: { type: Boolean, default: false },
        canVerifyReports: { type: Boolean, default: false },
        canFinalizeReports: { type: Boolean, default: false },
        canDownloadReports: { type: Boolean, default: false },
        canPrintReports: { type: Boolean, default: false },
        
        // User Management
        canCreateUsers: { type: Boolean, default: false },
        canManageUsers: { type: Boolean, default: false },
        canViewUsers: { type: Boolean, default: false },
        
        // Patient Management
        canRegisterPatients: { type: Boolean, default: false },
        canEditPatients: { type: Boolean, default: false },
        canViewPatients: { type: Boolean, default: false },
        
        // Billing & Financial
        canGenerateBills: { type: Boolean, default: false },
        canViewBilling: { type: Boolean, default: false },
        canManagePricing: { type: Boolean, default: false },
        
        // Dashboard & Analytics
        canViewDashboard: { type: Boolean, default: false },
        canViewAnalytics: { type: Boolean, default: false },
        canExportData: { type: Boolean, default: false },
        
        // DICOM Viewer
        canUseDicomViewer: { type: Boolean, default: false },
        canUse2DTools: { type: Boolean, default: false },
        canUseMPRTools: { type: Boolean, default: false },
        canUse3DTools: { type: Boolean, default: false },
        
        // Voice & Templates
        canUseVoiceDictation: { type: Boolean, default: false },
        canUseSavedTemplates: { type: Boolean, default: false },
        canCreateTemplates: { type: Boolean, default: false },
        
        // System Administration
        canManageOrganizations: { type: Boolean, default: false },
        canViewSystemReports: { type: Boolean, default: false },
        canManageBackups: { type: Boolean, default: false }
    },
    
    isLoggedIn: {
        type: Boolean,
        default: false,
    },
    
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // ✅ LEGACY FIELDS (for backward compatibility)
    lab: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lab',
        index: true
    },
    
    // Password reset fields
    resetPasswordOTP: {
        type: String,
        select: false
    },
    resetPasswordOTPExpires: {
        type: Date,
        select: false
    },
    resetPasswordAttempts: {
        type: Number,
        default: 0,
        select: false
    },
    resetPasswordLockedUntil: {
        type: Date,
        select: false
    },
    
    // Audit fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    lastLoginAt: {
        type: Date,
        index: true
    },
    
    loginCount: {
        type: Number,
        default: 0
    },
    
    // ✅ ACTIVITY TRACKING
    activityStats: {
        casesAssigned: { type: Number, default: 0 },
        reportsCreated: { type: Number, default: 0 },
        reportsVerified: { type: Number, default: 0 },
        reportsTyped: { type: Number, default: 0 },
        lastActivityAt: { type: Date },
        totalWorkingHours: { type: Number, default: 0 }
    }
}, { 
    timestamps: true,
    collection: 'users'
});

// Compound indexes for multi-tenancy and hierarchy
UserSchema.index({ organizationIdentifier: 1, username: 1 }, { unique: true });
UserSchema.index({ organizationIdentifier: 1, email: 1 }, { unique: true });
UserSchema.index({ organization: 1, role: 1, isActive: 1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ 'hierarchy.parentUser': 1, role: 1 });
UserSchema.index({ 'roleConfig.linkedRadiologist': 1 });
UserSchema.index({ 'linkedLabs.labId': 1 }); // ✅ NEW: For lab-based filtering
UserSchema.index({ 'linkedAccounts.userId': 1 }); // ✅ NEW: For multi-account linking


//pre-save middleware
UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const rawPassword = this.password; // capture raw before hashing
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
    this.password = await bcrypt.hash(rawPassword, salt);
    this.tempPassword = rawPassword; // now defined (but plaintext!)
  }

  if (this.isModified('role') || this.isNew) {
    this.setPermissionsByRole();
  }

  next();
});

// ensure tempPassword exists before Mongoose runs validation
UserSchema.pre('validate', function(next) {
  if (this.isModified('password') && this.password) {
    this.tempPassword = this.password;
  }
  next();
});

// ✅ ENHANCED METHOD: Set permissions based on new role system
UserSchema.methods.setPermissionsByRole = function() {
    // Reset all permissions
    this.permissions = {};
    
    switch (this.role) {
        case 'super_admin':
            // Full system access
            this.permissions = {
                canCreateCases: true,
                canAssignCases: true,
                canViewCases: true,
                canEditCases: true,
                canCreateReports: true,
                canEditReports: true,
                canVerifyReports: true,
                canFinalizeReports: true,
                canDownloadReports: true,
                canPrintReports: true,
                canCreateUsers: true,
                canManageUsers: true,
                canViewUsers: true,
                canRegisterPatients: true,
                canEditPatients: true,
                canViewPatients: true,
                canGenerateBills: true,
                canViewBilling: true,
                canManagePricing: true,
                canViewDashboard: true,
                canViewAnalytics: true,
                canExportData: true,
                canUseDicomViewer: true,
                canUse2DTools: true,
                canUseMPRTools: true,
                canUse3DTools: true,
                canUseVoiceDictation: true,
                canUseSavedTemplates: true,
                canCreateTemplates: true,
                canManageOrganizations: true,
                canViewSystemReports: true,
                canManageBackups: true
            };
            break;
            
        case 'admin':
            // Company/Center admin
            this.permissions = {
                canCreateCases: true,
                canAssignCases: true,
                canViewCases: true,
                canEditCases: true,
                canCreateReports: true,
                canEditReports: true,
                canVerifyReports: true,
                canFinalizeReports: true,
                canDownloadReports: true,
                canPrintReports: true,
                canCreateUsers: true,
                canManageUsers: true,
                canViewUsers: true,
                canRegisterPatients: true,
                canEditPatients: true,
                canViewPatients: true,
                canGenerateBills: true,
                canViewBilling: true,
                canManagePricing: true,
                canViewDashboard: true,
                canViewAnalytics: true,
                canExportData: true,
                canUseDicomViewer: true,
                canUse2DTools: true,
                canUseMPRTools: true,
                canUse3DTools: true,
                canUseVoiceDictation: true,
                canUseSavedTemplates: true,
                canCreateTemplates: true
            };
            break;
            
        case 'group_id':
            // Role creator
            this.permissions = {
                canViewCases: true,
                canCreateUsers: true,
                canManageUsers: true,
                canViewUsers: true,
                canViewPatients: true,
                canViewDashboard: true,
                canViewAnalytics: true
            };
            break;
            
        case 'assignor':
            // Case assignment specialist
            this.permissions = {
                canAssignCases: true,
                canViewCases: true,
                canEditCases: true,
                canViewPatients: true,
                canViewDashboard: true,
                canViewAnalytics: true,
                canViewUsers: true
            };
            break;
            
        case 'radiologist':
            // Radiologist permissions
            this.permissions = {
                canViewCases: true,
                canCreateReports: true,
                canEditReports: true,
                canDownloadReports: true,
                canViewPatients: true,
                canUseDicomViewer: true,
                canUse2DTools: true,
                canUseMPRTools: true,
                canUse3DTools: true,
                canUseVoiceDictation: true,
                canUseSavedTemplates: true,
                canCreateTemplates: true,
                canViewDashboard: true
            };
            break;
            
        case 'verifier':
            // Report verification specialist
            this.permissions = {
                canViewCases: true,
                canEditReports: true,
                canVerifyReports: true,
                canFinalizeReports: true,
                canDownloadReports: true,
                canViewPatients: true,
                canUseDicomViewer: true,
                canUse2DTools: true,
                canUseMPRTools: true,
                canUse3DTools: true,
                canViewDashboard: true
            };
            break;
            
        case 'physician':
            // Referral doctor - limited access
            this.permissions = {
                canViewCases: true, // Only their referred patients
                canDownloadReports: true, // Limited download
                canViewPatients: true // Only their patients
            };
            break;
            
        case 'receptionist':
            // Patient registration and report printing
            this.permissions = {
                canRegisterPatients: true,
                canEditPatients: true,
                canViewPatients: true,
                canPrintReports: true,
                canViewCases: true
            };
            break;
            
        case 'billing':
            // Billing section
            this.permissions = {
                canGenerateBills: true,
                canViewBilling: true,
                canViewPatients: true,
                canViewCases: true,
                canDownloadReports: true
            };
            break;
            
        case 'typist':
            // Report typing support
            this.permissions = {
                canViewCases: true, // Only assigned radiologist's cases
                canEditReports: true, // Type reports
                canViewPatients: true,
                canUseSavedTemplates: true
            };
            break;
            
        case 'dashboard_viewer':
            // Read-only dashboard access
            this.permissions = {
                canViewDashboard: true,
                canViewAnalytics: true
            };
            // Dashboard access configured in roleConfig.dashboardAccess
            break;
            
        // Legacy roles (backward compatibility)
        case 'doctor_account':
            this.permissions = {
                canViewCases: true,
                canCreateReports: true,
                canEditReports: true,
                canDownloadReports: true,
                canViewPatients: true,
                canUseDicomViewer: true,
                canUse2DTools: true,
                canUseMPRTools: true,
                canUse3DTools: true
            };
            break;
            
        case 'lab_staff':
            this.permissions = {
                canViewCases: true,
                canViewPatients: true,
                canRegisterPatients: true
            };
            break;
            
        case 'owner':
            this.permissions = {
                canViewCases: true,
                canViewDashboard: true,
                canViewAnalytics: true,
                canViewBilling: true,
                canManagePricing: true
            };
            break;
    }
};

// ✅ NEW METHOD: Check if user can access specific case
UserSchema.methods.canAccessCase = function(caseData) {
    // Super admin and admin can access all cases
    if (['super_admin', 'admin'].includes(this.role)) {
        return true;
    }
    
    // Check organization match
    if (this.organizationIdentifier !== caseData.organizationIdentifier) {
        return false;
    }
    
    switch (this.role) {
        case 'physician':
            // Can only view cases they referred
            return caseData.referringPhysician?.id === this._id.toString();
            
        case 'typist':
            // Can only view cases assigned to their linked radiologist
            return caseData.assignment?.some(assign => 
                assign.assignedTo?.toString() === this.roleConfig.linkedRadiologist?.toString()
            );
            
        case 'radiologist':
            // Can view cases assigned to them
            return caseData.assignment?.some(assign => 
                assign.assignedTo?.toString() === this._id.toString()
            );
            
        case 'verifier':
            // Can view cases from their assigned radiologists
            return caseData.assignment?.some(assign => 
                this.roleConfig.assignedRadiologists?.includes(assign.assignedTo)
            );
            
        default:
            return this.permissions.canViewCases;
    }
};

// ✅ NEW METHOD: Get dashboard route based on role
UserSchema.methods.getDashboardRoute = function() {
    switch (this.role) {
        case 'super_admin':
            return '/superadmin/dashboard';
        case 'admin':
            return '/admin/dashboard';
        case 'group_id':
            return '/group/dashboard';
        case 'assignor':
            return '/assignor/dashboard';
        case 'radiologist':
            return '/radiologist/dashboard';
        case 'verifier':
            return '/verifier/dashboard';
        case 'physician':
            return '/physician/dashboard';
        case 'receptionist':
            return '/receptionist/dashboard';
        case 'billing':
            return '/billing/dashboard';
        case 'typist':
            return '/typist/dashboard';
        case 'dashboard_viewer':
            return '/viewer/dashboard';
        // Legacy routes
        case 'doctor_account':
            return '/doctor/dashboard';
        case 'lab_staff':
            return '/lab/dashboard';
        case 'owner':
            return '/owner/dashboard';
        default:
            return '/dashboard';
    }
};

UserSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);
export default User;