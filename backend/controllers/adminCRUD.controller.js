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
            fullName,
            email,           // ✅ frontend sends username here
            password,
            username,
            specialization,
            licenseNumber,
            department,
            qualifications,
            yearsOfExperience,
            contactPhoneOffice,
            requireReportVerification,
            signature,
            signatureMetadata,
            visibleColumns = []
        } = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can create doctor accounts'
            });
        }

        // ✅ Only fullName, email(username), password are required — specialization optional
        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Full name, username and password are required'
            });
        }

        // ✅ Auto-append @radivue.com if no domain given
        const finalEmail = email.includes('@')
            ? email.toLowerCase().trim()
            : `${email.toLowerCase().trim()}@radivue.com`;

        // Check if email already exists in the organization
        const existingUser = await User.findOne({
            email: finalEmail,
            organizationIdentifier: req.user.organizationIdentifier
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists in this organization'
            });
        }

        // ✅ Generate username from email part
        const finalUsername = username || finalEmail.split('@')[0].toLowerCase();

        // Check if username exists in organization
        const existingUsername = await User.findOne({
            username: finalUsername,
            organizationIdentifier: req.user.organizationIdentifier
        });

        if (existingUsername) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists in this organization'
            });
        }

        const newUser = new User({
            organization: req.user.organization,
            organizationIdentifier: req.user.organizationIdentifier,
            username: finalUsername,
            email: finalEmail,          // ✅ username@radivue.com
            password: password,
            fullName: fullName.trim(),
            role: 'radiologist',
            createdBy: req.user._id,
            isActive: true,
            visibleColumns: Array.isArray(visibleColumns) ? visibleColumns : []
        });

        await newUser.save({ session });

        // ✅ specialization defaults to 'General Radiology' if not provided
        const doctorData = {
            organization: req.user.organization,
            organizationIdentifier: req.user.organizationIdentifier,
            userAccount: newUser._id,
            specialization: specialization?.trim() || 'General Radiology',  // ✅ default
            licenseNumber: licenseNumber?.trim() || '',
            department: department?.trim() || '',
            qualifications: qualifications || [],
            yearsOfExperience: yearsOfExperience || 0,
            contactPhoneOffice: contactPhoneOffice?.trim() || '',
            assigned: false,
            isActiveProfile: true,
            requireReportVerification: requireReportVerification !== undefined
                ? requireReportVerification
                : true,
            verificationEnabledAt: new Date(),
            verificationEnabledBy: req.user._id
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

        const newDoctor = new Doctor(doctorData);
        await newDoctor.save({ session });

        await session.commitTransaction();

        console.log('✅ [CreateDoctor] Doctor created:', {
            doctorId: newDoctor._id,
            userId: newUser._id,
            email: finalEmail,
            specialization: doctorData.specialization
        });

        const createdDoctor = await Doctor.findById(newDoctor._id)
            .populate('userAccount', 'fullName email username isActive')
            .populate('organization', 'name displayName identifier')
            .select('-signature');

        res.status(201).json({
            success: true,
            message: 'Doctor created successfully',
            data: {
                ...createdDoctor.toObject(),
                hasSignature: !!signature,
                loginEmail: finalEmail   // ✅ show what login email was set
            }
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error('❌ Create doctor error:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists'
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

// ...existing code...

export const createLab = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            name,
            contactPerson,
            contactEmail,
            contactPhone,
            address,
            settings,
            staffUserDetails: {
                fullName,
                username,        // ✅ username only - no email from frontend
                password,
                role = 'lab_staff',
                visibleColumns = []
            } = {}
        } = req.body;

         const allowedRoles = ['admin', 'super_admin', 'group_id'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only admins can create labs'
            });
        }

        if (!name || !contactPerson) {
            return res.status(400).json({ success: false, message: 'Lab name and contact person are required' });
        }

        // ✅ BACKEND: Auto-generate identifier from lab name
        const generateIdentifier = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let id = '';
            for (let i = 0; i < 5; i++) {
                id += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return id;
        };

        let finalIdentifier = generateIdentifier();

        // ✅ Check uniqueness - keep regenerating random IDs until unique
        let attempts = 0;
        while (await Lab.findOne({ organizationIdentifier: req.user.organizationIdentifier, identifier: finalIdentifier }) && attempts < 100) {
            finalIdentifier = generateIdentifier();
            attempts++;
        }

        // ✅ BACKEND: Build email from username
        let finalStaffEmail = null;
        if (username || fullName || password) {
            if (!username || !fullName || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Staff username, full name, and password are required for lab staff account'
                });
            }
            // ✅ Auto-append @radivue.com
            finalStaffEmail = username.includes('@')
                ? username.toLowerCase().trim()
                : `${username.toLowerCase().trim()}@radivue.com`;
        }

        const userOrgId = req.user.organization;
        const userOrgIdentifier = req.user.organizationIdentifier;

        if (!userOrgId || !userOrgIdentifier) {
            return res.status(400).json({ success: false, message: 'Admin must belong to an organization' });
        }

        // ✅ Check if email already exists
        if (finalStaffEmail) {
            const existingEmail = await User.findOne({
                email: finalStaffEmail,
                organizationIdentifier: userOrgIdentifier
            });
            if (existingEmail) {
                await session.abortTransaction();
                return res.status(409).json({ success: false, message: 'Username already exists in this organization' });
            }
        }

        const newLab = new Lab({
            organization: userOrgId,
            organizationIdentifier: userOrgIdentifier,
            name: name.trim(),
            identifier: finalIdentifier,           // ✅ backend generated
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
                verificationEnabledAt: new Date(),
                verificationEnabledBy: req.user._id
            }
        });

        await newLab.save({ session });

        let staffUser = null;
        if (finalStaffEmail) {
            const finalUsername = username.toLowerCase().trim();

            staffUser = new User({
                organization: userOrgId,
                organizationIdentifier: userOrgIdentifier,
                lab: newLab._id,
                username: finalUsername,
                email: finalStaffEmail,             // ✅ username@radivue.com
                password: password,
                fullName: fullName.trim(),
                role: role,
                tempPassword: password,
                visibleColumns: Array.isArray(visibleColumns) ? visibleColumns : [],
                isActive: true,
                createdBy: req.user._id
            });

            await staffUser.save({ session });
        }

        await session.commitTransaction();

        console.log('✅ [CreateLab] Lab created:', {
            labId: newLab._id,
            identifier: finalIdentifier,
            staffEmail: finalStaffEmail
        });

        return res.status(201).json({
            success: true,
            message: `Lab "${newLab.name}" created successfully`,
            data: {
                lab: newLab,
                staffUser: staffUser ? {
                    _id: staffUser._id,
                    email: staffUser.email,
                    username: staffUser.username,
                    fullName: staffUser.fullName,
                    role: staffUser.role
                } : null
            }
        });

    } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        console.error('❌ [CreateLab] Error:', error);
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username or lab identifier already exists' });
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
// export const getOrganizationUsers = async (req, res) => {
//     try {
//         // Only admin can access this
//         if (!['admin', 'super_admin'].includes(req.user.role)) {
//             return res.status(403).json({
//                 success: false,
//                 message: 'Only admin can access user credentials'
//             });
//         }

//         let query = { isActive: true };
        
//         // For admin, limit to their organization
//         if (req.user.role === 'admin') {
//             query.organizationIdentifier = req.user.organizationIdentifier;
//         }

//         // Get users with passwords and tempPassword (sensitive operation)
//         const users = await User.find(query)
//             .populate('hierarchy.createdBy', 'fullName email role')
//             .populate('hierarchy.parentUser', 'fullName email role')
//             .populate('roleConfig.linkedRadiologist', 'fullName email')
//             .populate('organization', 'name displayName identifier')
//             .select('+password +tempPassword') // ✅ Include both password fields
//             .sort({ role: 1, createdAt: -1 });

//         // ✅ Fetch all doctors and labs for verification status
//         const doctors = await Doctor.find({
//             organizationIdentifier: req.user.organizationIdentifier
//         }).select('userAccount requireReportVerification');

//         const labs = await Lab.find({
//             organizationIdentifier: req.user.organizationIdentifier
//         }).select('_id settings.requireReportVerification');

//         // ✅ Create lookup maps
//         const doctorMap = new Map(doctors.map(d => [d.userAccount.toString(), d.requireReportVerification]));
//         const labMap = new Map(labs.map(l => [l._id.toString(), l.settings?.requireReportVerification]));

//         // ✅ Enhance users with verification status
//         const enhancedUsers = users.map(user => {
//             const userObj = user.toObject();
            
//             // Add verification status for radiologists
//             if (user.role === 'radiologist') {
//                 userObj.requireReportVerification = doctorMap.get(user._id.toString()) || false;
//             }
            
//             // Add verification status for lab_staff
//             if (user.role === 'lab_staff' && user.linkedLabs?.[0]?.labId) {
//                 userObj.requireReportVerification = labMap.get(user.linkedLabs[0].labId.toString()) || false;
//             }
            
//             return userObj;
//         });

//         // Get organization info
//         const organization = await Organization.findOne({
//             identifier: req.user.organizationIdentifier
//         });

//         console.log(`🔐 Admin ${req.user.email} accessed credentials for ${users.length} users`);

//         res.json({
//             success: true,
//             data: {
//                 organization: organization,
//                 users: enhancedUsers
//             },
//             count: enhancedUsers.length
//         });

//     } catch (error) {
//         console.error('❌ Get organization users error:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch organization users'
//         });
//     }
// };

// ...existing code...

export const getOrganizationUsers = async (req, res) => {
    try {
        if (!['admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can access user credentials'
            });
        }

        let query = { isActive: true };

        if (req.user.role === 'admin') {
            query.organizationIdentifier = req.user.organizationIdentifier;
        }

        // ✅ FIX: Support role filter from query params
        if (req.query.role && req.query.role !== 'all') {
            query.role = req.query.role;
        }

        const users = await User.find(query)
            .populate('hierarchy.createdBy', 'fullName email role')
            .populate('hierarchy.parentUser', 'fullName email role')
            .populate('roleConfig.linkedRadiologist', 'fullName email')
            // ✅ FIX: Populate assignedLabs and assignedRadiologists in roleConfig
            .populate('roleConfig.assignedLabs', 'name identifier')
            .populate('roleConfig.assignedRadiologists', 'fullName email role')
            .populate('organization', 'name displayName identifier')
            .select('+password +tempPassword')
            .sort({ role: 1, createdAt: -1 });

        const doctors = await Doctor.find({
            organizationIdentifier: req.user.organizationIdentifier
        }).select('userAccount requireReportVerification');

        const labs = await Lab.find({
            organizationIdentifier: req.user.organizationIdentifier
        }).select('_id settings.requireReportVerification');

        const doctorMap = new Map(doctors.map(d => [d.userAccount.toString(), d.requireReportVerification]));
        const labMap = new Map(labs.map(l => [l._id.toString(), l.settings?.requireReportVerification]));

        const enhancedUsers = users.map(user => {
            const userObj = user.toObject();

            if (user.role === 'radiologist') {
                userObj.requireReportVerification = doctorMap.get(user._id.toString()) || false;
            }

            if (user.role === 'lab_staff' && user.linkedLabs?.[0]?.labId) {
                userObj.requireReportVerification = labMap.get(user.linkedLabs[0].labId.toString()) || false;
            }

            // ✅ FIX: Ensure roleConfig is always present for assignor/verifier
            if (['assignor', 'verifier'].includes(user.role)) {
                userObj.roleConfig = userObj.roleConfig || {};
                userObj.roleConfig.labAccessMode = userObj.roleConfig.labAccessMode || 'all';
                userObj.roleConfig.assignedLabs = userObj.roleConfig.assignedLabs || [];
                userObj.roleConfig.assignedRadiologists = userObj.roleConfig.assignedRadiologists || [];
            }

            return userObj;
        });

        const organization = await Organization.findOne({
            identifier: req.user.organizationIdentifier
        });

        console.log(`🔐 Admin ${req.user.email} accessed credentials for ${users.length} users`);

        res.json({
            success: true,
            data: {
                organization,
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

