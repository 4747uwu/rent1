// controllers/auth.controller.js
import User from '../models/userModel.js';
import Doctor from '../models/doctorModel.js';
import Lab from '../models/labModel.js';
import Organization from '../models/organisation.js';
import generateToken from '../utils/generateToken.js';
import ms from 'ms'; 
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

export const loginUser = async (req, res) => {
    console.log(req.body);
    const { email, password } = req.body;
    console.log('Login attempt with email:', email);

    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please provide email and password.' 
        });
    }

    try {
        // Find user by email only - let backend determine role and context
        let user = await User.findOne({ 
            email: email.trim().toLowerCase() 
        })
        .select('+password')
        .populate('organization', 'name identifier status displayName features subscription')
        .populate('lab', 'name identifier isActive fullIdentifier settings');

        // Verify user exists and password is correct
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password.' 
            });
        }

        // Check if user account is active
        if (!user.isActive) {
            return res.status(403).json({ 
                success: false, 
                message: 'Your account has been deactivated.' 
            });
        }

        // Check organization status (for non-super admin users)
        if (user.role !== 'super_admin' && user.organization) {
            if (user.organization.status !== 'active') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Your organization account is not active. Please contact support.' 
                });
            }

            // Check subscription status
            if (user.organization.subscription?.subscriptionEndDate && 
                new Date() > new Date(user.organization.subscription.subscriptionEndDate)) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Your organization subscription has expired. Please renew to continue.' 
                });
            }
        }

        // Update login tracking
        user.isLoggedIn = true;
        user.lastLoginAt = new Date();
        user.loginCount = (user.loginCount || 0) + 1;
        await user.save();

        // Generate JWT token with organization context
        const tokenPayload = {
            userId: user._id,
            role: user.role,
            organizationId: user.organization?._id,
            organizationIdentifier: user.organizationIdentifier
        };
        const token = generateToken(tokenPayload);

        // Set cookie with token
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
            sameSite: 'None',  // ✅ Allow cross-origin requests
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/'
        });

        // Prepare user response data
        const userResponseData = {
            _id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            permissions: user.permissions,
            isActive: user.isActive,
            isLoggedIn: true,
            organizationIdentifier: user.organizationIdentifier,
            lastLoginAt: user.lastLoginAt,
            loginCount: user.loginCount,
            // ✅ ADD NEW FIELDS
            visibleColumns: user.visibleColumns || [],
            accountRoles: user.accountRoles || [],
            primaryRole: user.primaryRole || user.role,
            linkedLabs: user.linkedLabs || []
        };

        // Add organization data for non-super admin users
        if (user.organization) {
            userResponseData.organization = {
                _id: user.organization._id,
                name: user.organization.name,
                identifier: user.organization.identifier,
                displayName: user.organization.displayName,
                status: user.organization.status,
                features: user.organization.features,
                subscription: {
                    plan: user.organization.subscription?.plan,
                    maxUsers: user.organization.subscription?.maxUsers,
                    maxStudiesPerMonth: user.organization.subscription?.maxStudiesPerMonth,
                    subscriptionEndDate: user.organization.subscription?.subscriptionEndDate
                }
            };
        }

        // Add role-specific data
        if (user.role === 'lab_staff' && user.lab) {
            userResponseData.lab = {
                _id: user.lab._id,
                name: user.lab.name,
                identifier: user.lab.identifier,
                fullIdentifier: user.lab.fullIdentifier,
                isActive: user.lab.isActive,
                settings: user.lab.settings
            };

        console.log('Lab data added to response for lab_staff:', userResponseData.lab);
        } else if (user.role === 'doctor_account') {
            const doctorProfile = await Doctor.findOne({ 
                userAccount: user._id,
                organizationIdentifier: user.organizationIdentifier 
            })
            .select('-userAccount -createdAt -updatedAt -__v')
            .populate('organization', 'name identifier displayName');
            
            if (doctorProfile) {
                userResponseData.doctorProfile = doctorProfile.toObject();
            }
        }

        // Determine organization context for response
        let organizationContext = 'global'; // Default for super admin
        if (user.role !== 'super_admin') {
            organizationContext = user.organizationIdentifier;
        }

        // Success response
        res.json({
            success: true,
            message: 'Login successful.',
            user: userResponseData,
            token: token,
            expiresIn: '24h',
            organizationContext: organizationContext,
            redirectTo: getDashboardRouteForRole(user.role) // Helper function to determine redirect
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login.' 
        });
    }
};

// Helper function to determine dashboard route based on role
const getDashboardRouteForRole = (role) => {
    switch (role) {
        case 'super_admin':
            return '/superadmin/dashboard';
        case 'admin':
            return '/admin/dashboard';
        case 'owner':
            return '/owner/dashboard';
        case 'lab_staff':
            return '/lab/dashboard';
        case 'doctor_account':
            return '/doctor/dashboard';
        // ✅ NEW ROLE ROUTES
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
            return '/dashboard/viewer';
        default:
            return '/dashboard';
    }
};

export const getMe = async (req, res) => {
    try {
        let userQuery;
        
        // Super admin can access without organization context
        if (req.user.role === 'super_admin') {
            userQuery = User.findById(req.user._id)
                .populate('organization', 'name identifier status displayName features subscription');
        } else {
            // Regular users must be within their organization context
            userQuery = User.findOne({
                _id: req.user._id,
                organizationIdentifier: req.user.organizationIdentifier
            })
            .populate('organization', 'name identifier status displayName features subscription')
            .populate('lab', 'name identifier isActive fullIdentifier settings');

        }

        const user = await userQuery.exec();
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found or organization context mismatch.'
            });
        }

        const userPayload = user.toObject();

        // Add role-specific data
        if (userPayload.role === 'doctor_account') {
            const doctorProfile = await Doctor.findOne({ 
                userAccount: userPayload._id,
                organizationIdentifier: userPayload.organizationIdentifier 
            })
            .select('-userAccount -createdAt -updatedAt -__v');
            
            if (doctorProfile) {
                userPayload.doctorProfile = doctorProfile.toObject();
            }
        }

        // Add organization statistics for admin/owner roles
        if (['admin', 'owner'].includes(userPayload.role) && userPayload.organization) {
            const [userCount, labCount] = await Promise.all([
                User.countDocuments({ 
                    organization: userPayload.organization._id, 
                    isActive: true 
                }),
                Lab.countDocuments({ 
                    organization: userPayload.organization._id, 
                    isActive: true 
                })
            ]);

            userPayload.organizationStats = {
                activeUsers: userCount,
                activeLabs: labCount
            };
        }

        // ✅ Ensure new fields are included
        if (!userPayload.visibleColumns) userPayload.visibleColumns = [];
        if (!userPayload.accountRoles) userPayload.accountRoles = [];
        if (!userPayload.primaryRole) userPayload.primaryRole = userPayload.role;
        if (!userPayload.linkedLabs) userPayload.linkedLabs = [];

        res.status(200).json({
            success: true,
            data: userPayload,
        });

    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user profile.'
        });
    }
};

export const logoutUser = async (req, res) => {
    try {
        // Update user logout status
        await User.findByIdAndUpdate(
            req.user._id, 
            { 
                isLoggedIn: false,
                lastLogoutAt: new Date()
            }
        );

        res.status(200).json({ 
            success: true, 
            message: 'Logged out successfully.' 
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(200).json({ 
            success: true, 
            message: 'Logged out successfully.' 
        });
    }
};

export const refreshToken = async (req, res) => {
    try {
        // Verify user still exists and is active
        let user;
        
        if (req.user.role === 'super_admin') {
            user = await User.findOne({
                _id: req.user._id,
                role: 'super_admin',
                isActive: true
            }).populate('organization', 'status');
        } else {
            user = await User.findOne({
                _id: req.user._id,
                organizationIdentifier: req.user.organizationIdentifier,
                isActive: true
            }).populate('organization', 'status');
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found or account deactivated.'
            });
        }

        // Check organization status for non-super admin users
        if (user.role !== 'super_admin' && user.organization) {
            if (user.organization.status !== 'active') {
                return res.status(403).json({
                    success: false,
                    message: 'Organization account is not active.'
                });
            }
        }

        // Generate new token
        const tokenPayload = {
            userId: user._id,
            role: user.role,
            organizationId: user.organization?._id,
            organizationIdentifier: user.organizationIdentifier
        };
        const newToken = generateToken(tokenPayload);
        
        res.json({
            success: true,
            token: newToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '1h',
            user: {
                _id: user._id,
                role: user.role,
                organizationIdentifier: user.organizationIdentifier
            }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to refresh token.' 
        });
    }
};

// Organization switching endpoint (super admin only)
export const switchOrganization = async (req, res) => {
    const { organizationIdentifier } = req.body;

    if (req.user.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Only super admins can switch organization context.'
        });
    }

    try {
        let organization = null;
        
        if (organizationIdentifier) {
            organization = await Organization.findOne({
                identifier: organizationIdentifier.toUpperCase(),
                status: 'active'
            });

            if (!organization) {
                return res.status(404).json({
                    success: false,
                    message: 'Organization not found or not active.'
                });
            }
        }

        // Generate new token with updated organization context
        const tokenPayload = {
            userId: req.user._id,
            role: req.user.role,
            organizationId: organization?._id || null,
            organizationIdentifier: organization?.identifier || null
        };
        
        const newToken = generateToken(tokenPayload);

        res.json({
            success: true,
            message: organizationIdentifier 
                ? `Switched to organization: ${organizationIdentifier}` 
                : 'Switched to global context',
            token: newToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '1h',
            organizationContext: organizationIdentifier || 'global'
        });

    } catch (error) {
        console.error('Organization switch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to switch organization context.'
        });
    }
};

// Get available organizations (super admin only)
export const getAvailableOrganizations = async (req, res) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Only super admins can view all organizations.'
        });
    }

    try {
        const organizations = await Organization.find({ status: 'active' })
            .select('name identifier displayName status subscription.plan')
            .sort({ name: 1 });

        res.json({
            success: true,
            data: organizations,
            count: organizations.length
        });

    } catch (error) {
        console.error('Get organizations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch organizations.'
        });
    }
};


// ... existing imports

// GET SPECIFIC LAB DETAILS FOR ELECTRON APP
export const labConnectorLogin = async (req, res) => {
    const { email, password } = req.body;

    // 1. Basic Validation
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Please provide email and password.' 
        });
    }

    try {
        // 2. Find User & Populate specifically for Lab context
        // We explicitly need the organization identifier and lab identifier
        const user = await User.findOne({ email: email.trim().toLowerCase() })
            .select('+password')
            .populate('organization', 'name identifier status')
            .populate('lab', 'name identifier isActive settings');

        // 3. Verify Credentials
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password.' 
            });
        }

        // 4. Security Checks
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account is deactivated.' });
        }

        // --- STRICT LAB CHECKS START HERE ---

        // Enforce Role
        if (user.role !== 'lab_staff') {
             return res.status(403).json({ 
                 success: false, 
                 message: 'Access Denied: This application is for Lab Staff only.' 
             });
        }

        // Verify Organization Link & Status
        if (!user.organization || !user.organization.identifier) {
             return res.status(403).json({ success: false, message: 'Configuration Error: No Organization linked to this account.' });
        }
        if (user.organization.status !== 'active') {
             return res.status(403).json({ success: false, message: 'Your Organization account is not active.' });
        }

        // Verify Lab Link & Status
        if (!user.lab || !user.lab.identifier) {
             return res.status(403).json({ success: false, message: 'Configuration Error: No Lab assigned to this account.' });
        }
        if (!user.lab.isActive) {
             return res.status(403).json({ success: false, message: 'Your assigned Lab is currently inactive.' });
        }

        // 5. Generate Token
        // We include the critical identifiers in the token payload too, just in case.
        const tokenPayload = {
            userId: user._id,
            role: user.role,
            organizationIdentifier: user.organization.identifier,
            labIdentifier: user.lab.identifier
        };
        const token = generateToken(tokenPayload);

        // 6. Success Response specifically tailored for the Electron App
        res.json({
            success: true,
            message: 'Lab Connector authenticated successfully.',
            token: token,
            user: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                // The two critical pieces of data for tagwrite.lua:
                organizationIdentifier: user.organization.identifier,
                lab: {
                    identifier: user.lab.identifier,
                    name: user.lab.name,
                    isActive: user.lab.isActive,
                    settings: user.lab.settings
                }
            }
        });

    } catch (error) {
        console.error('Lab Connector Login Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during lab authentication.' 
        });
    }
};