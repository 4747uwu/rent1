import User from '../models/userModel.js';
import Organization from '../models/organisation.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// ✅ GET AVAILABLE ROLES FOR GROUP ID
export const getAvailableRoles = async (req, res) => {
    try {
        const user = req.user;
        
        if (!['group_id', 'admin', 'super_admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        const availableRoles = {
            assignor: {
                name: 'Assignor',
                description: 'Assign cases to radiologists and verifiers, manage workload distribution'
            },
            radiologist: {
                name: 'Radiologist',
                description: 'View cases in DICOM viewer, create reports, forward to verifier'
            },
            verifier: {
                name: 'Verifier',
                description: 'Review radiologist reports, correct errors, finalize and approve reports'
            },
            physician: {
                name: 'Physician / Referral Doctor',
                description: 'View reports of referred patients, limited download/share access'
            },
            receptionist: {
                name: 'Receptionist',
                description: 'Register patients, print reports, update patient demographic details'
            },
            billing: {
                name: 'Billing Section',
                description: 'Generate patient bills, maintain billing information linked with reports'
            },
            typist: {
                name: 'Typist',
                description: 'Support radiologist by typing dictated reports'
            },
            dashboard_viewer: {
                name: 'Dashboard Viewer',
                description: 'View workload, TAT, revenue, pending/completed cases - read-only access'
            }
        };

        res.json({
            success: true,
            data: availableRoles
        });

    } catch (error) {
        console.error('Error fetching available roles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch available roles'
        });
    }
};

// ✅ GET USERS FOR GROUP ID
export const getUsers = async (req, res) => {
    try {
        const user = req.user;
        
        if (!['group_id', 'admin', 'super_admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        const users = await User.find({
            organizationIdentifier: user.organizationIdentifier,
            role: { $ne: 'super_admin' } // Exclude super admin
        })
        .select('fullName email role isActive lastLoginAt createdAt password')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: { users }
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
};

// ✅ CREATE USER FOR GROUP ID
export const createUser = async (req, res) => {
    try {
        const {
            fullName,
            email,
            password,
            username,
            role,
            organizationType,
            roleConfig
        } = req.body;

        const user = req.user;
        
        if (!['group_id', 'admin', 'super_admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        // Validate required fields
        if (!fullName || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, password, and role are required'
            });
        }

        const userOrgId = user.organization;
        const userOrgIdentifier = user.organizationIdentifier;

        if (!userOrgId || !userOrgIdentifier) {
            return res.status(400).json({
                success: false,
                message: 'User must belong to an organization'
            });
        }

        // Check if email already exists in organization
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

        // Create new user
        const newUser = new User({
            organization: userOrgId,
            organizationIdentifier: userOrgIdentifier,
            username: finalUsername,
            email: email.toLowerCase().trim(),
            password: password, // Will be hashed by pre-save hook
            fullName: fullName.trim(),
            role: role,
            createdBy: user._id,
            isActive: true,
            roleConfig: roleConfig || {}
        });

        await newUser.save();

        // Return created user (exclude password)
        const createdUser = await User.findById(newUser._id)
            .populate('organization', 'name displayName identifier')
            .select('-password');

        res.status(201).json({
            success: true,
            message: `${role.replace('_', ' ').toUpperCase()} created successfully`,
            data: createdUser
        });

    } catch (error) {
        console.error('Error creating user:', error);

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
    }
};

// ✅ UPDATE USER CREDENTIALS
export const updateUserCredentials = async (req, res) => {
    try {
        const { userId } = req.params;
        const { fullName, email, password } = req.body;
        const currentUser = req.user;

        if (!['group_id', 'admin', 'super_admin'].includes(currentUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        const user = await User.findOne({
            _id: userId,
            organizationIdentifier: currentUser.organizationIdentifier
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const updates = {};
        if (fullName) updates.fullName = fullName.trim();
        if (email) updates.email = email.toLowerCase().trim();
        if (password) updates.password = password; // Will be hashed by pre-save hook

        await User.findByIdAndUpdate(userId, updates);

        res.json({
            success: true,
            message: 'User credentials updated successfully'
        });

    } catch (error) {
        console.error('Error updating user credentials:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user credentials'
        });
    }
};

// ✅ UPDATE USER ROLE
export const updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newRole } = req.body;
        const currentUser = req.user;

        if (!['group_id', 'admin', 'super_admin'].includes(currentUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        const user = await User.findOne({
            _id: userId,
            organizationIdentifier: currentUser.organizationIdentifier
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await User.findByIdAndUpdate(userId, { role: newRole });

        res.json({
            success: true,
            message: 'User role updated successfully'
        });

    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user role'
        });
    }
};

// ✅ TOGGLE USER STATUS
export const toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isActive } = req.body;
        const currentUser = req.user;

        if (!['group_id', 'admin', 'super_admin'].includes(currentUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        const user = await User.findOne({
            _id: userId,
            organizationIdentifier: currentUser.organizationIdentifier
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await User.findByIdAndUpdate(userId, { isActive });

        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
        });

    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status'
        });
    }
};

// ✅ RESET USER PASSWORD
export const resetUserPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUser = req.user;

        if (!['group_id', 'admin', 'super_admin'].includes(currentUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        const user = await User.findOne({
            _id: userId,
            organizationIdentifier: currentUser.organizationIdentifier
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const defaultPassword = 'password123';
        await User.findByIdAndUpdate(userId, { password: defaultPassword });

        res.json({
            success: true,
            message: 'Password reset successfully',
            defaultPassword
        });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
};

// ✅ DELETE USER
export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { confirmDelete } = req.body;
        const currentUser = req.user;

        if (!['group_id', 'admin', 'super_admin'].includes(currentUser.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        if (!confirmDelete) {
            return res.status(400).json({
                success: false,
                message: 'Confirmation required to delete user'
            });
        }

        const user = await User.findOne({
            _id: userId,
            organizationIdentifier: currentUser.organizationIdentifier
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user'
        });
    }
};

// ✅ GET STATS FOR GROUP ID
export const getStats = async (req, res) => {
    try {
        const user = req.user;
        
        if (!['group_id', 'admin', 'super_admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - insufficient permissions'
            });
        }

        const stats = await User.aggregate([
            {
                $match: {
                    organizationIdentifier: user.organizationIdentifier,
                    role: { $ne: 'super_admin' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    activeUsers: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    },
                    radiologists: {
                        $sum: { $cond: [{ $eq: ['$role', 'radiologist'] }, 1, 0] }
                    },
                    recentLogins: {
                        $sum: {
                            $cond: [
                                {
                                    $gte: [
                                        '$lastLoginAt',
                                        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: stats[0] || {
                totalUsers: 0,
                activeUsers: 0,
                radiologists: 0,
                recentLogins: 0
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats'
        });
    }
};

export default {
    getAvailableRoles,
    getUsers,
    createUser,
    updateUserCredentials,
    updateUserRole,
    toggleUserStatus,
    resetUserPassword,
    deleteUser,
    getStats
};