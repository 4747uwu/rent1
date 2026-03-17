import User from '../models/userModel.js';
import Organization from '../models/organisation.js';
import Doctor from '../models/doctorModel.js'; // ✅ NEW: Import Doctor model
import mongoose from 'mongoose';
import { determinePrimaryRole } from '../constant/role.js';

// Add this helper function at the top of your userManagement.controller.js
const sanitizeRoleConfig = (roleConfig, role) => {
    if (!roleConfig || typeof roleConfig !== 'object') {
        return {};
    }

    const sanitized = { ...roleConfig };

    // Fields that should be ObjectId - remove if empty string
    const objectIdFields = [
        'linkedRadiologist',
        'parentUser',
        'supervisorId'
    ];

    objectIdFields.forEach(field => {
        if (sanitized[field] === '' || sanitized[field] === null || sanitized[field] === undefined) {
            delete sanitized[field];
        }
    });

    // Fields that should be arrays - ensure they are arrays
    const arrayFields = [
        'assignedRadiologists',
        'assignableUsers',
        'allowedPatients',
        'assignedLabs' // ✅ NEW: Add assignedLabs
    ];

    arrayFields.forEach(field => {
        if (sanitized[field] && !Array.isArray(sanitized[field])) {
            sanitized[field] = [sanitized[field]];
        }
    });

    // ✅ NEW: Ensure labAccessMode has valid value
    if (role === 'assignor') {
        if (!['all', 'selected', 'none'].includes(sanitized.labAccessMode)) {
            sanitized.labAccessMode = 'all'; // Default to 'all'
        }
        
        // If mode is not 'selected', clear assignedLabs
        if (sanitized.labAccessMode !== 'selected') {
            sanitized.assignedLabs = [];
        }
    }

    // Role-specific validation and defaults
    switch (role) {
        case 'typist':
            // Typist requires linkedRadiologist
            if (!sanitized.linkedRadiologist) {
                throw new Error('Typist role requires a linked radiologist');
            }
            break;
        case 'assignor':
            // Assignor should have assignable users array
            if (!sanitized.assignableUsers) {
                sanitized.assignableUsers = [];
            }
            break;
        case 'dashboard_viewer':
            // Dashboard viewer should have access permissions
            if (!sanitized.dashboardAccess) {
                sanitized.dashboardAccess = {
                    viewWorkload: false,
                    viewTAT: false,
                    viewRevenue: false,
                    viewReports: false
                };
            }
            break;
    }

    return sanitized;
};

// ✅ CREATE USER WITH NEW ROLE SYSTEM (with Doctor profile for radiologists)
export const createUserWithRole = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            fullName,
            email,
            password,
            username,
            role,
            roleConfig = {},
            organizationType = 'teleradiology_company',
            // ✅ NEW: Radiologist/Doctor-specific fields
            specialization,
            licenseNumber,
            department,
            qualifications = [],
            yearsOfExperience,
            contactPhoneOffice,
            requireReportVerification, // ✅ NEW: Verification toggle
            signature,
            signatureMetadata
        } = req.body;

        console.log('🔥 Creating user with role:', { role, fullName, email, creatorRole: req.user.role });

        // Validate creator permissions
        const canCreateRole = validateRoleCreation(req.user.role, role);
        if (!canCreateRole.allowed) {
            console.warn('❌ Role creation not allowed:', canCreateRole.message);
            return res.status(403).json({
                success: false,
                message: canCreateRole.message
            });
        }

        // Validate required fields
        if (!fullName || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, password, and role are required'
            });
        }

        // ✅ NEW: If creating radiologist, validate doctor-specific fields
        if (role === 'radiologist') {
            if (!specialization) {
                return res.status(400).json({
                    success: false,
                    message: 'Specialization is required for radiologist role'
                });
            }
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const userOrgId = req.user.organization;
        const userOrgIdentifier = req.user.organizationIdentifier;

        if (!userOrgId || !userOrgIdentifier) {
            return res.status(400).json({
                success: false,
                message: 'Creator must belong to an organization'
            });
        }

        // Check if email already exists in the organization
        const existingUser = await User.findOne({
            email: email.toLowerCase().trim(),
            organizationIdentifier: userOrgIdentifier
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists in this organization'
            });
        }

        // Generate username if not provided
        const finalUsername = username || email.split('@')[0].toLowerCase();

        // Check if username exists in organization
        const existingUsername = await User.findOne({
            username: finalUsername,
            organizationIdentifier: userOrgIdentifier
        });

        if (existingUsername) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists in this organization'
            });
        }

        // 🔧 SANITIZE ROLE CONFIG - This fixes the ObjectId error
        let sanitizedRoleConfig;
        try {
            sanitizedRoleConfig = sanitizeRoleConfig(roleConfig, role);
        } catch (error) {
            console.error('❌ Error sanitizing role config:', error);
            sanitizedRoleConfig = {};
        }

        // Prepare optional fields from request
        const { visibleColumns = [], accountRoles = [], primaryRole = '', linkedLabs = [] } = req.body;

        // ✅ AUTO-DETERMINE PRIMARY ROLE based on hierarchy
        let finalPrimaryRole = primaryRole;
        if (Array.isArray(accountRoles) && accountRoles.length > 0) {
            finalPrimaryRole = primaryRole || accountRoles[0];
        } else {
            finalPrimaryRole = role;
        }

        // Basic validation for linkedLabs structure (optional)
        const sanitizedLinkedLabs = Array.isArray(linkedLabs)
          ? linkedLabs.map(l => {
              if (typeof l === 'string') {
                  return { labId: l, permissions: { canViewStudies: true, canAssignStudies: false } };
              }
              return {
                  labId: l.labId,
                  permissions: l.permissions || { canViewStudies: true, canAssignStudies: false }
              };
          }).filter(l => l.labId)
          : [];

        // ✅ NEW: For assignor role, populate roleConfig.assignedLabs from linkedLabs
        if (role === 'assignor' || (accountRoles && accountRoles.includes('assignor'))) {
            sanitizedRoleConfig.assignedLabs = sanitizedLinkedLabs.map(l => l.labId);
            sanitizedRoleConfig.labAccessMode = sanitizedLinkedLabs.length > 0 ? 'selected' : 'all';
            
            console.log('🔐 Assignor lab access configured:', {
                assignedLabsCount: sanitizedRoleConfig.assignedLabs.length,
                labAccessMode: sanitizedRoleConfig.labAccessMode
            });
        }

        // Create new user (include new feature fields)
        const newUser = new User({
            organization: userOrgId,
            organizationIdentifier: userOrgIdentifier,
            username: finalUsername,
            email: email.toLowerCase().trim(),
            password: password,
            fullName: fullName.trim(),
            role: role, 
            hierarchy: {
                createdBy: req.user._id,
                parentUser: req.user._id,
                organizationType: organizationType
            },
            roleConfig: sanitizedRoleConfig,
            visibleColumns: Array.isArray(visibleColumns) ? visibleColumns.map(String) : [],
            accountRoles: Array.isArray(accountRoles) && accountRoles.length > 0 
              ? accountRoles.map(String) 
              : [role],
            primaryRole: finalPrimaryRole,
            linkedLabs: sanitizedLinkedLabs,
            createdBy: req.user._id,
            isActive: true
        });

        await newUser.save({ session });

        // ✅ NEW: If role is radiologist, create Doctor profile
        let doctorProfile = null;
        if (role === 'radiologist') {
            const doctorData = {
                organization: userOrgId,
                organizationIdentifier: userOrgIdentifier,
                userAccount: newUser._id,
                specialization: specialization.trim(),
                licenseNumber: licenseNumber?.trim() || '',
                department: department?.trim() || '',
                qualifications: Array.isArray(qualifications) ? qualifications : [],
                yearsOfExperience: yearsOfExperience || 0,
                contactPhoneOffice: contactPhoneOffice?.trim() || '',
                assigned: false,
                isActiveProfile: true,
                
                // ✅ NEW: Add verification settings
                requireReportVerification: requireReportVerification !== undefined ? requireReportVerification : true,
                verificationEnabledAt: requireReportVerification !== undefined ? new Date() : undefined,
                verificationEnabledBy: requireReportVerification !== undefined ? req.user._id : undefined
            };

            // ✅ ADD SIGNATURE IF PROVIDED
            if (signature) {
                doctorData.signature = signature;
                doctorData.signatureMetadata = {
                    uploadedAt: new Date(),
                    originalSize: signatureMetadata?.originalSize || 0,
                    optimizedSize: signatureMetadata?.optimizedSize || 0,
                    originalName: signatureMetadata?.originalName || 'signature.png',
                    mimeType: signatureMetadata?.mimeType || 'image/png',
                    lastUpdated: new Date(),
                    format: signatureMetadata?.format || 'base64',
                    width: signatureMetadata?.width || 400,
                    height: signatureMetadata?.height || 200
                };
            }

            doctorProfile = new Doctor(doctorData);
            await doctorProfile.save({ session });

            console.log('✅ [CreateUser] Doctor profile created for radiologist:', {
                doctorId: doctorProfile._id,
                userId: newUser._id,
                requireVerification: doctorProfile.requireReportVerification,
                hasSignature: !!signature
            });
        }

        // Update creator's child users
        await User.findByIdAndUpdate(
            req.user._id,
            { $push: { 'hierarchy.childUsers': newUser._id } },
            { session }
        );

        await session.commitTransaction();

        // Return created user (exclude password)
        const createdUser = await User.findById(newUser._id)
            .populate('hierarchy.createdBy', 'fullName email role')
            .populate('organization', 'name displayName identifier')
            .populate('roleConfig.linkedRadiologist', 'fullName email')
            .select('-password');

        console.log('✅ User created successfully:', { 
            userId: createdUser._id, 
            role, 
            email,
            hasDoctorProfile: !!doctorProfile 
        });

        res.status(201).json({
            success: true,
            message: `${role.replace('_', ' ').toUpperCase()} created successfully${doctorProfile ? ' with doctor profile' : ''}`,
            data: {
                user: createdUser,
                doctorProfile: doctorProfile ? {
                    _id: doctorProfile._id,
                    specialization: doctorProfile.specialization,
                    requireReportVerification: doctorProfile.requireReportVerification,
                    hasSignature: !!signature
                } : null
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('❌ Create user error:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email or username already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

// ✅ VALIDATE ROLE CREATION PERMISSIONS
function validateRoleCreation(creatorRole, targetRole) {
    const roleHierarchy = {
        'super_admin': [
            'admin', 'group_id', 'assignor', 'radiologist', 'verifier', 
            'physician', 'receptionist', 'billing', 'typist', 'dashboard_viewer',
            'lab_staff', 'doctor_account', 'owner'
        ],
        'admin': [
            'group_id', 'assignor', 'radiologist', 'verifier', 
            'physician', 'receptionist', 'billing', 'typist', 'dashboard_viewer'
        ],
        'group_id': [
            'assignor', 'radiologist', 'verifier', 'typist', 'receptionist'
        ]
    };

    const allowedRoles = roleHierarchy[creatorRole] || [];
    
    if (!allowedRoles.includes(targetRole)) {
        return {
            allowed: false,
            message: `${creatorRole.replace('_', ' ')} cannot create ${targetRole.replace('_', ' ')} accounts`
        };
    }

    return { allowed: true };
}

// ✅ GET USERS BY ROLE AND HIERARCHY
export const getUsersByRole = async (req, res) => {
    try {
        const { role, includeChildren = false } = req.query;
        
        let query = {
            organizationIdentifier: req.user.organizationIdentifier,
            isActive: true
        };

        // For super admin, show all organizations
        if (req.user.role === 'super_admin') {
            delete query.organizationIdentifier;
        }

        if (role && role !== 'all') {
            query.role = role;
        }

        // If includeChildren is true, include users created by current user
        if (includeChildren === 'true') {
            query['hierarchy.createdBy'] = req.user._id;
        }

        const users = await User.find(query)
            .populate('hierarchy.createdBy', 'fullName email role')
            .populate('hierarchy.parentUser', 'fullName email role')
            .populate('roleConfig.linkedRadiologist', 'fullName email')
            .populate('organization', 'name displayName identifier')
            .select('-password')
            .sort({ createdAt: -1 });

        console.log(`📊 Found ${users.length} users for organization ${req.user.organizationIdentifier || 'super_admin'}`);

        res.json({
            success: true,
            data: users,
            count: users.length
        });

    } catch (error) {
        console.error('❌ Get users by role error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
};

// ✅ UPDATE USER ROLE CONFIGURATION
export const updateUserRoleConfig = async (req, res) => {
    try {
        const { userId } = req.params;
        const { roleConfig } = req.body;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Validate user exists and belongs to same organization
        let query = { _id: userId };
        
        // Non-super admins can only modify users in their organization
        if (req.user.role !== 'super_admin') {
            query.organizationIdentifier = req.user.organizationIdentifier;
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if current user can modify this user
        const canModify = ['super_admin', 'admin'].includes(req.user.role) || 
                         user.hierarchy.createdBy?.toString() === req.user._id.toString();

        if (!canModify) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to modify this user'
            });
        }

        // Update role configuration
        user.roleConfig = { ...user.roleConfig, ...roleConfig };
        await user.save();

        const updatedUser = await User.findById(userId)
            .populate('roleConfig.linkedRadiologist', 'fullName email')
            .populate('organization', 'name displayName identifier')
            .select('-password');

        console.log('✅ User role config updated:', { userId, role: user.role });

        res.json({
            success: true,
            message: 'User role configuration updated successfully',
            data: updatedUser
        });

    } catch (error) {
        console.error('❌ Update user role config error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user configuration'
        });
    }
};

// ✅ GET AVAILABLE ROLES FOR CREATION
export const getAvailableRoles = async (req, res) => {
    try {
        const roleDefinitions = {
            'group_id': {
                name: 'Group ID',
                description: 'Create and manage other user roles including Assignor, Radiologist, Verifier, etc.',
                category: 'management'
            },
            'assignor': {
                name: 'Assignor',
                description: 'Assigns cases to radiologists and verifiers',
                permissions: ['canAssignCases', 'canViewCases', 'canViewDashboard'],
                category: 'management'
            },
            'radiologist': {
                name: 'Radiologist',
                description: 'Views cases in DICOM viewer, creates reports',
                permissions: ['canViewCases', 'canCreateReports', 'canUseDicomViewer'],
                category: 'medical'
            },
            'verifier': {
                name: 'Verifier',
                description: 'Reviews and finalizes radiologist reports',
                permissions: ['canVerifyReports', 'canFinalizeReports', 'canViewCases'],
                category: 'medical'
            },
            'physician': {
                name: 'Physician/Referral Doctor',
                description: 'Views reports of referred patients',
                permissions: ['canViewCases', 'canDownloadReports'],
                category: 'medical'
            },
            'receptionist': {
                name: 'Receptionist',
                description: 'Registers patients, prints reports',
                permissions: ['canRegisterPatients', 'canPrintReports'],
                category: 'administrative'
            },
            'billing': {
                name: 'Billing Section',
                description: 'Generates bills and maintains billing information',
                permissions: ['canGenerateBills', 'canViewBilling'],
                category: 'financial'
            },
            'typist': {
                name: 'Typist',
                description: 'Types dictated reports for radiologists',
                permissions: ['canEditReports', 'canViewCases'],
                category: 'support'
            },
            'dashboard_viewer': {
                name: 'Dashboard Viewer',
                description: 'Read-only dashboard access',
                permissions: ['canViewDashboard', 'canViewAnalytics'],
                category: 'viewer'
            }
        };

        // Filter based on user's role
        const availableRoles = {};

        Object.keys(roleDefinitions).forEach(role => {
            const canCreate = validateRoleCreation(req.user.role, role);
            if (canCreate.allowed) {
                availableRoles[role] = roleDefinitions[role];
            }
        });

        console.log(`📋 Available roles for ${req.user.role}:`, Object.keys(availableRoles));

        res.json({
            success: true,
            data: availableRoles,
            userRole: req.user.role
        });

    } catch (error) {
        console.error('❌ Get available roles error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available roles'
        });
    }
};

// ✅ GET USER HIERARCHY
export const getUserHierarchy = async (req, res) => {
    try {
        let matchQuery = { isActive: true };
        
        // For non-super admins, limit to their organization
        if (req.user.role !== 'super_admin') {
            matchQuery.organizationIdentifier = req.user.organizationIdentifier;
        }

        const hierarchy = await User.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'users',
                    localField: 'hierarchy.parentUser',
                    foreignField: '_id',
                    as: 'parent'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'hierarchy.childUsers',
                    foreignField: '_id',
                    as: 'children'
                }
            },
            {
                $lookup: {
                    from: 'organizations',
                    localField: 'organization',
                    foreignField: '_id',
                    as: 'organizationInfo'
                }
            },
            {
                $project: {
                    fullName: 1,
                    email: 1,
                    role: 1,
                    isActive: 1,
                    createdAt: 1,
                    organizationIdentifier: 1,
                    parent: { $arrayElemAt: ['$parent', 0] },
                    organization: { $arrayElemAt: ['$organizationInfo', 0] },
                    children: {
                        $map: {
                            input: '$children',
                            as: 'child',
                            in: {
                                _id: '$$child._id',
                                fullName: '$$child.fullName',
                                email: '$$child.email',
                                role: '$$child.role',
                                isActive: '$$child.isActive'
                            }
                        }
                    }
                }
            },
            { $sort: { role: 1, createdAt: -1 } }
        ]);

        console.log(`🌳 User hierarchy for organization ${req.user.organizationIdentifier || 'super_admin'}: ${hierarchy.length} users`);

        res.json({
            success: true,
            data: hierarchy,
            count: hierarchy.length
        });

    } catch (error) {
        console.error('❌ Get user hierarchy error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user hierarchy'
        });
    }
};

// ✅ GET USERS FOR SPECIFIC ROLE (for dropdowns)
export const getUsersForRole = async (req, res) => {
    try {
        const { role } = req.params;
        
        let query = {
            role: role,
            isActive: true
        };

        // For non-super admins, limit to their organization
        if (req.user.role !== 'super_admin') {
            query.organizationIdentifier = req.user.organizationIdentifier;
        }

        const users = await User.find(query)
            .select('fullName email role specialization')
            .sort({ fullName: 1 });

        res.json({
            success: true,
            data: users,
            count: users.length
        });

    } catch (error) {
        console.error('❌ Get users for role error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users for role'
        });
    }
};

// ✅ TOGGLE USER STATUS (activate/deactivate)
export const toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        let query = { _id: userId };
        
        // Non-super admins can only modify users in their organization
        if (req.user.role !== 'super_admin') {
            query.organizationIdentifier = req.user.organizationIdentifier;
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check permissions
        const canModify = ['super_admin', 'admin'].includes(req.user.role) || 
                         user.hierarchy.createdBy?.toString() === req.user._id.toString();

        if (!canModify) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to modify this user'
            });
        }

        // Update status
        user.isActive = isActive;
        await user.save();

        console.log(`✅ User status updated: ${user.email} -> ${isActive ? 'active' : 'inactive'}`);

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: { userId, isActive }
        });

    } catch (error) {
        console.error('❌ Toggle user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status'
        });
    }
};

// export { getUsersForRole };