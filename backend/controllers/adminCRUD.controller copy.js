import User from '../models/userModel.js';
import Doctor from '../models/doctorModel.js';
import Lab from '../models/labModel.js';
import Organization from '../models/organisation.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// ✅ CREATE DOCTOR (with signature support)
export const createDoctor = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            // User account details
            fullName,
            email,
            password,
            username,
            
            // Doctor profile details
            specialization,
            licenseNumber,
            department,
            qualifications,
            yearsOfExperience,
            contactPhoneOffice,
            requireReportVerification,
            
            // ✅ SIGNATURE DATA
            signature,
            signatureMetadata,
            
            // ✅ NEW: Column configuration
            visibleColumns = []
        } = req.body;

        // Validate admin permissions
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can create doctor accounts'
            });
        }

        // Validate required fields
        if (!fullName || !email || !password || !specialization) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, password, and specialization are required'
            });
        }

        const userOrgId = req.user.organization;
        const userOrgIdentifier = req.user.organizationIdentifier;

        if (!userOrgId || !userOrgIdentifier) {
            return res.status(400).json({
                success: false,
                message: 'Admin must belong to an organization'
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

        // Create user account
        const newUser = new User({
            organization: userOrgId,
            organizationIdentifier: userOrgIdentifier,
            username: finalUsername,
            email: email.toLowerCase().trim(),
            password: password, // Will be hashed by pre-save hook
            
            fullName: fullName.trim(),
            role: 'radiologist', // ✅ Changed from 'doctor_account'
            createdBy: req.user._id,
            isActive: true,
            visibleColumns: Array.isArray(visibleColumns) ? visibleColumns : [] // ✅ NEW
        });

        await newUser.save({ session });

        // ✅ PREPARE SIGNATURE DATA
        const doctorData = {
            organization: userOrgId,
            organizationIdentifier: userOrgIdentifier,
            userAccount: newUser._id,
            specialization: specialization.trim(),
            licenseNumber: licenseNumber?.trim() || '',
            department: department?.trim() || '',
            qualifications: qualifications || [],
            yearsOfExperience: yearsOfExperience || 0,
            contactPhoneOffice: contactPhoneOffice?.trim() || '',
            assigned: false,
            isActiveProfile: true,

            requireReportVerification: requireReportVerification !== undefined ? requireReportVerification : true,
            verificationEnabledAt: requireReportVerification !== undefined ? new Date() : undefined,
            verificationEnabledBy: requireReportVerification !== undefined ? req.user._id : undefined
        };

        // ✅ ADD SIGNATURE IF PROVIDED
        if (signature) {
            doctorData.signature = signature;
            
            // Set signature metadata with defaults
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

        // Create doctor profile
        const newDoctor = new Doctor(doctorData);
        await newDoctor.save({ session });

        await session.commitTransaction();

        // Return created doctor with populated user account (exclude password)
        const createdDoctor = await Doctor.findById(newDoctor._id)
            .populate('userAccount', 'fullName email username isActive')
            .populate('organization', 'name displayName identifier')
            .select('-signature'); // Exclude signature from response for security

        res.status(201).json({
            success: true,
            message: 'Doctor created successfully',
            data: {
                ...createdDoctor.toObject(),
                hasSignature: !!signature
            }
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Create doctor error:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email or username already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create doctor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

// ✅ CREATE LAB WITH USER ACCOUNT and verification settings
// Backend update for adminCRUD.controller.js - createLab function

export const createLab = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            name,
            identifier, // Now auto-generated from frontend
            contactPerson,
            contactEmail,
            contactPhone,
            address,
            settings,
            staffUserDetails: {
                fullName,
                email: staffEmail,
                username,
                password,
                role = 'lab_staff',
                visibleColumns = []
            } = {}
        } = req.body;

        // Validate admin permissions
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can create labs'
            });
        }

        // Validate required fields
        if (!name || !contactPerson) {
            return res.status(400).json({
                success: false,
                message: 'Lab name and contact person are required'
            });
        }

        // ✅ Auto-generate identifier if not provided
        let finalIdentifier = identifier;
        if (!finalIdentifier) {
            const cleaned = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
            finalIdentifier = cleaned.substring(0, 5).padEnd(5, 'X');
        }

        // ✅ VALIDATE: Staff user details if provided
        if (staffEmail || fullName || username || password) {
            if (!staffEmail || !fullName || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Staff email, full name, and password are required for lab staff account'
                });
            }
        }

        const userOrgId = req.user.organization;
        const userOrgIdentifier = req.user.organizationIdentifier;

        if (!userOrgId || !userOrgIdentifier) {
            return res.status(400).json({
                success: false,
                message: 'Admin must belong to an organization'
            });
        }

        // Check if lab identifier already exists in the organization
        const existingLab = await Lab.findOne({
            organizationIdentifier: userOrgIdentifier,
            identifier: finalIdentifier.toUpperCase().trim()
        });

        if (existingLab) {
            return res.status(409).json({
                success: false,
                message: 'Lab identifier already exists in this organization'
            });
        }

        // ✅ CHECK: If staff email already exists
        let staffUser = null;
        if (staffEmail) {
            const existingStaffUser = await User.findOne({
                email: staffEmail.toLowerCase().trim(),
                organizationIdentifier: userOrgIdentifier
            });

            if (existingStaffUser) {
                await session.abortTransaction();
                return res.status(409).json({
                    success: false,
                    message: 'Staff email already exists in this organization'
                });
            }

            const finalUsername = username || staffEmail.split('@')[0].toLowerCase();
            
            const existingUsername = await User.findOne({
                username: finalUsername,
                organizationIdentifier: userOrgIdentifier
            });

            if (existingUsername) {
                await session.abortTransaction();
                return res.status(409).json({
                    success: false,
                    message: 'Username already exists in this organization'
                });
            }
        }

        // ✅ CREATE LAB (removed notes field)
        const newLab = new Lab({
            organization: userOrgId,
            organizationIdentifier: userOrgIdentifier,
            name: name.trim(),
            identifier: finalIdentifier.toUpperCase().trim(),
            contactPerson: contactPerson?.trim() || '',
            contactEmail: contactEmail?.toLowerCase().trim() || '',
            contactPhone: contactPhone?.trim() || '',
            address: address || {},
            isActive: true,
            settings: {
                autoAssignStudies: settings?.autoAssignStudies || false,
                defaultPriority: settings?.defaultPriority || 'NORMAL',
                maxConcurrentStudies: settings?.maxConcurrentStudies || 100,
                requireReportVerification: settings?.requireReportVerification !== undefined 
                    ? settings.requireReportVerification 
                    : true,
                verificationEnabledAt: settings?.requireReportVerification !== undefined 
                    ? new Date() 
                    : undefined,
                verificationEnabledBy: settings?.requireReportVerification !== undefined 
                    ? req.user._id 
                    : undefined
            }
        });

        await newLab.save({ session });

        console.log('✅ [CreateLab] Lab created successfully:', {
            labId: newLab._id,
            identifier: newLab.identifier,
            requireVerification: newLab.settings.requireReportVerification
        });

        // ✅ CREATE: Staff user account if details provided
        if (staffEmail) {
            const finalStaffUsername = username || staffEmail.split('@')[0].toLowerCase();

            staffUser = new User({
                organization: userOrgId,
                organizationIdentifier: userOrgIdentifier,
                lab: newLab._id,  // ✅ CRITICAL: Link to lab
                username: finalStaffUsername,
                email: staffEmail.toLowerCase().trim(),
                password: password,
                fullName: fullName.trim(),
                role: role,
                createdBy: req.user._id,
                isActive: true,
                visibleColumns: Array.isArray(visibleColumns) ? visibleColumns : []
            });

            await staffUser.save({ session });

            // ✅ ADD USER TO LAB'S STAFF LIST
            newLab.staffUsers.push({
                userId: staffUser._id,
                role: role,
                addedAt: new Date(),
                isActive: true
            });
            
            await newLab.save({ session });

            console.log('✅ [CreateLab] Staff user created and linked to lab:', {
                userId: staffUser._id,
                labId: newLab._id,
                email: staffEmail
            });
        }

        await session.commitTransaction();

        // Return created lab with staff user
        const createdLab = await Lab.findById(newLab._id)
            .populate('organization', 'name displayName');

        const responseData = {
            lab: createdLab,
            staffUser: staffUser ? {
                _id: staffUser._id,
                fullName: staffUser.fullName,
                email: staffUser.email,
                username: staffUser.username,
                role: staffUser.role,
                isActive: staffUser.isActive
            } : null
        };

        res.status(201).json({
            success: true,
            message: staffUser 
                ? 'Lab and staff account created successfully!' 
                : 'Lab created successfully!',
            data: responseData
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Create lab error:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Lab with this identifier already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create lab',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

// ✅ GET ALL DOCTORS (for admin)
export const getAllDoctors = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view all doctors'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';

        const query = {
            organizationIdentifier: req.user.organizationIdentifier
        };

        if (search) {
            query.$or = [
                { specialization: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } },
                { licenseNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const doctors = await Doctor.find(query)
            .populate('userAccount', 'fullName email username isActive lastLoginAt')
            .populate('organization', 'name displayName')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await Doctor.countDocuments(query);

        res.json({
            success: true,
            data: doctors,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get doctors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch doctors'
        });
    }
};

// ✅ GET ALL LABS (for admin)
export const getAllLabs = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can view all labs'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';

        const query = {
            organizationIdentifier: req.user.organizationIdentifier
        };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { identifier: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } }
            ];
        }

        const labs = await Lab.find(query)
            .populate('organization', 'name displayName')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await Lab.countDocuments(query);

        res.json({
            success: true,
            data: labs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get labs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch labs'
        });
    }
};

// ✅ UPDATE DOCTOR (with verification toggle support)
export const updateDoctor = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { doctorId } = req.params;
        const updates = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can update doctor accounts'
            });
        }

        const doctor = await Doctor.findOne({
            _id: doctorId,
            organizationIdentifier: req.user.organizationIdentifier
        }).populate('userAccount');

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Update doctor profile
        const doctorUpdates = {};
        if (updates.specialization) doctorUpdates.specialization = updates.specialization;
        if (updates.licenseNumber) doctorUpdates.licenseNumber = updates.licenseNumber;
        if (updates.department) doctorUpdates.department = updates.department;
        if (updates.qualifications) doctorUpdates.qualifications = updates.qualifications;
        if (updates.yearsOfExperience !== undefined) doctorUpdates.yearsOfExperience = updates.yearsOfExperience;
        if (updates.contactPhoneOffice) doctorUpdates.contactPhoneOffice = updates.contactPhoneOffice;
        if (updates.isActiveProfile !== undefined) doctorUpdates.isActiveProfile = updates.isActiveProfile;
        
        // ✅ NEW: Handle verification toggle
        if (updates.requireReportVerification !== undefined) {
            doctorUpdates.requireReportVerification = updates.requireReportVerification;
            doctorUpdates.verificationEnabledAt = new Date();
            doctorUpdates.verificationEnabledBy = req.user._id;
            
            console.log('✅ [UpdateDoctor] Verification toggle updated:', {
                doctorId,
                requireVerification: updates.requireReportVerification,
                updatedBy: req.user.fullName
            });
        }

        await Doctor.findByIdAndUpdate(doctorId, doctorUpdates, { session });

        // Update user account if needed
        const userUpdates = {};
        if (updates.fullName) userUpdates.fullName = updates.fullName;
        if (updates.isActive !== undefined) userUpdates.isActive = updates.isActive;

        if (Object.keys(userUpdates).length > 0) {
            await User.findByIdAndUpdate(doctor.userAccount._id, userUpdates, { session });
        }

        await session.commitTransaction();

        // Return updated doctor
        const updatedDoctor = await Doctor.findById(doctorId)
            .populate('userAccount', 'fullName email username isActive')
            .populate('organization', 'name displayName identifier');

        res.json({
            success: true,
            message: 'Doctor updated successfully',
            data: updatedDoctor
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Update doctor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update doctor'
        });
    } finally {
        session.endSession();
    }
};

// ✅ UPDATE LAB (with verification toggle support)
export const updateLab = async (req, res) => {
    try {
        const { labId } = req.params;
        const updates = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can update labs'
            });
        }

        const lab = await Lab.findOne({
            _id: labId,
            organizationIdentifier: req.user.organizationIdentifier
        });

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'Lab not found'
            });
        }

        // ✅ NEW: Handle verification toggle in settings
        if (updates.settings?.requireReportVerification !== undefined) {
            if (!updates.settings) updates.settings = {};
            updates.settings.requireReportVerification = updates.settings.requireReportVerification;
            updates.settings.verificationEnabledAt = new Date();
            updates.settings.verificationEnabledBy = req.user._id;
            
            console.log('✅ [UpdateLab] Verification toggle updated:', {
                labId,
                requireVerification: updates.settings.requireReportVerification,
                updatedBy: req.user.fullName
            });
        }

        const updatedLab = await Lab.findByIdAndUpdate(labId, updates, { 
            new: true,
            runValidators: true
        }).populate('organization', 'name displayName identifier');

        res.json({
            success: true,
            message: 'Lab updated successfully',
            data: updatedLab
        });

    } catch (error) {
        console.error('Update lab error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update lab'
        });
    }
};

// ✅ DELETE DOCTOR (soft delete)
export const deleteDoctor = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { doctorId } = req.params;

        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can delete doctor accounts'
            });
        }

        const doctor = await Doctor.findOne({
            _id: doctorId,
            organizationIdentifier: req.user.organizationIdentifier
        });

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }

        // Soft delete - deactivate instead of removing
        await Doctor.findByIdAndUpdate(doctorId, { isActiveProfile: false }, { session });
        await User.findByIdAndUpdate(doctor.userAccount, { isActive: false }, { session });

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Doctor deactivated successfully'
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Delete doctor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete doctor'
        });
    } finally {
        session.endSession();
    }
};

// ✅ DELETE LAB (soft delete)
export const deleteLab = async (req, res) => {
    try {
        const { labId } = req.params;

        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can delete labs'
            });
        }

        const lab = await Lab.findOne({
            _id: labId,
            organizationIdentifier: req.user.organizationIdentifier
        });

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'Lab not found'
            });
        }

        // Soft delete - deactivate instead of removing
        await Lab.findByIdAndUpdate(labId, { isActive: false });

        res.json({
            success: true,
            message: 'Lab deactivated successfully'
        });

    } catch (error) {
        console.error('Delete lab error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete lab'
        });
    }
};

// ✅ GET ALL USERS IN ADMIN'S ORGANIZATION WITH CREDENTIALS AND VERIFICATION STATUS
export const getOrganizationUsers = async (req, res) => {
    try {
        // Only admin can access this
        if (!['admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can access user credentials'
            });
        }

        let query = { isActive: true };
        
        // For admin, limit to their organization
        if (req.user.role === 'admin') {
            query.organizationIdentifier = req.user.organizationIdentifier;
        }

        // Get users with passwords and tempPassword (sensitive operation)
        const users = await User.find(query)
            .populate('hierarchy.createdBy', 'fullName email role')
            .populate('hierarchy.parentUser', 'fullName email role')
            .populate('roleConfig.linkedRadiologist', 'fullName email')
            .populate('organization', 'name displayName identifier')
            .select('+password +tempPassword') // ✅ Include both password fields
            .sort({ role: 1, createdAt: -1 });

        // ✅ Fetch all doctors and labs for verification status
        const doctors = await Doctor.find({
            organizationIdentifier: req.user.organizationIdentifier
        }).select('userAccount requireReportVerification');

        const labs = await Lab.find({
            organizationIdentifier: req.user.organizationIdentifier
        }).select('_id settings.requireReportVerification');

        // ✅ Create lookup maps
        const doctorMap = new Map(doctors.map(d => [d.userAccount.toString(), d.requireReportVerification]));
        const labMap = new Map(labs.map(l => [l._id.toString(), l.settings?.requireReportVerification]));

        // ✅ Enhance users with verification status
        const enhancedUsers = users.map(user => {
            const userObj = user.toObject();
            
            // Add verification status for radiologists
            if (user.role === 'radiologist') {
                userObj.requireReportVerification = doctorMap.get(user._id.toString()) || false;
            }
            
            // Add verification status for lab_staff
            if (user.role === 'lab_staff' && user.linkedLabs?.[0]?.labId) {
                userObj.requireReportVerification = labMap.get(user.linkedLabs[0].labId.toString()) || false;
            }
            
            return userObj;
        });

        // Get organization info
        const organization = await Organization.findOne({
            identifier: req.user.organizationIdentifier
        });

        console.log(`🔐 Admin ${req.user.email} accessed credentials for ${users.length} users`);

        res.json({
            success: true,
            data: {
                organization: organization,
                users: enhancedUsers
            },
            count: enhancedUsers.length
        });

    } catch (error) {
        console.error('❌ Get organization users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch organization users'
        });
    }
};