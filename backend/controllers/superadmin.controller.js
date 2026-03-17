import Organization from '../models/organisation.js';
import User from '../models/userModel.js';
import Lab from '../models/labModel.js';
import Doctor from '../models/doctorModel.js';
import generateToken from '../utils/generateToken.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { toNamespacedPath } from 'path';

// Get all organizations (super admin only)
export const getAllOrganizations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { identifier: { $regex: search, $options: 'i' } },
                { displayName: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status) {
            query.status = status;
        }

        const organizations = await Organization.find(query)
            .populate('createdBy', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await Organization.countDocuments(query);

        // Get user and lab counts for each organization
        const organizationsWithStats = await Promise.all(
            organizations.map(async (org) => {
                const [userCount, labCount, doctorCount] = await Promise.all([
                    User.countDocuments({ organization: org._id, isActive: true }),
                    Lab.countDocuments({ organization: org._id, isActive: true }),
                    Doctor.countDocuments({ organization: org._id, isActiveProfile: true })
                ]);

                return {
                    ...org.toObject(),
                    stats: {
                        activeUsers: userCount,
                        activeLabs: labCount,
                        activeDoctors: doctorCount
                    }
                };
            })
        );

        res.json({
            success: true,
            data: organizationsWithStats,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                totalOrganizations: count,
                hasNextPage: page * limit < count,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('Get organizations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch organizations'
        });
    }
};

// Get single organization by ID
export const getOrganizationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid organization ID'
            });
        }

        const organization = await Organization.findById(id)
            .populate('createdBy', 'fullName email')
            .populate('lastModifiedBy', 'fullName email');

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Get detailed stats and admin users WITH tempPassword
        const [userCount, labCount, doctorCount, adminUsers] = await Promise.all([
            User.countDocuments({ organization: organization._id, isActive: true }),
            Lab.countDocuments({ organization: organization._id, isActive: true }),
            Doctor.countDocuments({ organization: organization._id, isActiveProfile: true }),
            User.find({ 
                organization: organization._id, 
                role: 'admin',
                isActive: true 
            }).select('fullName email username tempPassword') // ✅ ADD tempPassword
        ]);

        // Get the primary admin user (first one created)
        const primaryAdmin = adminUsers.length > 0 ? adminUsers[0] : null;

        res.json({
            success: true,
            data: {
                ...organization.toObject(),
                stats: {
                    activeUsers: userCount,
                    activeLabs: labCount,
                    activeDoctors: doctorCount,
                    adminUsers
                },
                // ✅ ADD primary admin details for edit form
                primaryAdmin: primaryAdmin ? {
                    email: primaryAdmin.email,
                    fullName: primaryAdmin.fullName,
                    username: primaryAdmin.username,
                    tempPassword: primaryAdmin.tempPassword // Plain text password for display
                } : null
            }
        });

    } catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch organization'
        });
    }
};

// Create new organization with admin user
export const createOrganization = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            name,
            displayName,
            companyType,
            contactInfo,
            address,
            subscription,
            features,
            compliance,
            notes,
            // Admin user details
            adminEmail,
            adminPassword,
            adminFullName
        } = req.body;

        // Validate required fields
        if (!name || !displayName || !companyType) {
            return res.status(400).json({
                success: false,
                message: 'Missing required organization fields'
            });
        }

        if (!adminEmail || !adminPassword || !adminFullName) {
            return res.status(400).json({
                success: false,
                message: 'Admin user details are required'
            });
        }

        // ✅ AUTO-GENERATE UNIQUE IDENTIFIER
        const identifier = await generateUniqueIdentifier(session);
        console.log('✅ Generated unique identifier:', identifier);

        // ✅ Append @bharatpacs.com if no domain provided
        const finalAdminEmail = adminEmail.includes('@')
            ? adminEmail.toLowerCase().trim()
            : `${adminEmail.toLowerCase().trim()}@bharatpacs.com`;

        // Check if admin email is unique
        const existingUser = await User.findOne({ 
            email: finalAdminEmail
        }).session(session);

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Admin email already exists'
            });
        }

        // Create organization with auto-generated identifier
        const organization = new Organization({
            name: name.trim(),
            identifier: identifier,
            displayName: displayName.trim(),
            companyType,
            contactInfo: contactInfo || {},
            address: address || {},
            subscription: subscription || {},
            features: features || {},
            compliance: compliance || {},
            notes: notes?.trim(),
            createdBy: req.user._id,
            status: 'active'
        });

        await organization.save({ session });

        // Create admin user for the organization
        const adminUser = new User({
            organization: organization._id,
            organizationIdentifier: organization.identifier,
            username: finalAdminEmail.split('@')[0].toLowerCase(),
            email: finalAdminEmail,
            password: adminPassword,
            tempPassword: adminPassword,
            fullName: adminFullName.trim(),
            role: 'admin',
            createdBy: req.user._id
        });

        await adminUser.save({ session });

        await session.commitTransaction();

        // Return organization with populated data
        const populatedOrg = await Organization.findById(organization._id)
            .populate('createdBy', 'fullName email');

        res.status(201).json({
            success: true,
            message: 'Organization created successfully with admin user',
            data: {
                organization: populatedOrg,
                adminUser: {
                    _id: adminUser._id,
                    email: adminUser.email,
                    fullName: adminUser.fullName,
                    role: adminUser.role
                }
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Create organization error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate key error - email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create organization'
        });
    } finally {
        session.endSession();
    }
};

// Update organization
export const updateOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid organization ID'
            });
        }

        // Remove fields that shouldn't be updated directly
        delete updates._id;
        delete updates.identifier; // Identifier should not be changed
        delete updates.createdBy;
        delete updates.createdAt;

        // Add last modified info
        updates.lastModifiedBy = req.user._id;

        const organization = await Organization.findByIdAndUpdate(
            id,
            updates,
            { 
                new: true, 
                runValidators: true 
            }
        ).populate('createdBy', 'fullName email')
         .populate('lastModifiedBy', 'fullName email');

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        res.json({
            success: true,
            message: 'Organization updated successfully',
            data: organization
        });

    } catch (error) {
        console.error('Update organization error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate key error'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update organization'
        });
    }
};

// Delete organization (soft delete by setting status to inactive)
export const deleteOrganization = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid organization ID'
            });
        }

        const organization = await Organization.findById(id).session(session);

        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Soft delete - set status to inactive
        organization.status = 'inactive';
        organization.lastModifiedBy = req.user._id;
        await organization.save({ session });

        // Deactivate all users in the organization
        await User.updateMany(
            { organization: organization._id },
            { 
                isActive: false,
                lastModifiedBy: req.user._id
            },
            { session }
        );

        // Deactivate all labs in the organization
        await Lab.updateMany(
            { organization: organization._id },
            { 
                isActive: false,
                lastModifiedBy: req.user._id
            },
            { session }
        );

        // Deactivate all doctors in the organization
        await Doctor.updateMany(
            { organization: organization._id },
            { 
                isActiveProfile: false,
                lastModifiedBy: req.user._id
            },
            { session }
        );

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Organization deactivated successfully (soft delete)'
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Delete organization error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete organization'
        });
    } finally {
        session.endSession();
    }
};

// Get organization statistics
export const getOrganizationStats = async (req, res) => {
    try {
        const [totalOrgs, activeOrgs, totalUsers, totalLabs] = await Promise.all([
            Organization.countDocuments(),
            Organization.countDocuments({ status: 'active' }),
            User.countDocuments({ isActive: true }),
            Lab.countDocuments({ isActive: true })
        ]);

        res.json({
            success: true,
            data: {
                totalOrganizations: totalOrgs,
                activeOrganizations: activeOrgs,
                inactiveOrganizations: totalOrgs - activeOrgs,
                totalUsers: totalUsers,
                totalLabs: totalLabs
            }
        });
    } catch (error) {
        console.error('Get organization stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
};

// Helper function to generate unique identifier
const generateUniqueIdentifier = async (session) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let identifier = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100;
    
    while (!isUnique && attempts < maxAttempts) {
        // Generate 4 random capital letters
        identifier = '';
        for (let i = 0; i < 4; i++) {
            identifier += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        // Check if identifier exists
        const existing = await Organization.findOne({ identifier }).session(session);
        
        if (!existing) {
            isUnique = true;
        }
        
        attempts++;
    }
    
    if (!isUnique) {
        throw new Error('Failed to generate unique identifier after maximum attempts');
    }
    
    return identifier;
};