import mongoose from 'mongoose';
import User from '../models/userModel.js';
import Doctor from '../models/doctorModel.js';

class DoctorCRUDController {
    
    /**
     * Get doctor profile information
     * GET /api/doctors/profile
     */
    static async getDoctorProfile(req, res) {
        try {
            const currentUser = req.user;
            
            console.log('👤 [Doctor Profile] Fetching profile for user:', currentUser._id);
            
            // Find doctor profile
            const doctor = await Doctor.findOne({ userAccount: currentUser._id })
                .populate('userAccount', 'fullName email username role')
                .populate('organization', 'name identifier displayName');
            
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor profile not found'
                });
            }
            
            console.log('✅ [Doctor Profile] Profile found:', doctor._id);
            
            res.status(200).json({
                success: true,
                data: {
                    doctorId: doctor._id,
                    userAccount: doctor.userAccount,
                    organization: doctor.organization,
                    organizationIdentifier: doctor.organizationIdentifier,
                    specialization: doctor.specialization,
                    licenseNumber: doctor.licenseNumber,
                    department: doctor.department,
                    qualifications: doctor.qualifications,
                    yearsOfExperience: doctor.yearsOfExperience,
                    contactPhoneOffice: doctor.contactPhoneOffice,
                    signature: doctor.signature,
                    signatureMetadata: doctor.signatureMetadata,
                    assignedStudiesCount: doctor.assignedStudies?.length || 0,
                    completedStudiesCount: doctor.completedStudies?.length || 0,
                    isActiveProfile: doctor.isActiveProfile,
                    createdAt: doctor.createdAt,
                    updatedAt: doctor.updatedAt
                }
            });
            
        } catch (error) {
            console.error('❌ [Doctor Profile] Error fetching profile:', error);
            res.status(500).json({
                success: false,
                message: 'Server error while fetching profile',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    
    /**
     * Update doctor profile information
     * PUT /api/doctors/profile
     */
    static async updateDoctorProfile(req, res) {
        try {
            const currentUser = req.user;
            const {
                specialization,
                licenseNumber,
                department,
                qualifications,
                yearsOfExperience,
                contactPhoneOffice,
                signature,
                signatureMetadata
            } = req.body;
            
            console.log('📝 [Doctor Profile] Updating profile for user:', currentUser._id);
            console.log('📝 [Doctor Profile] Update data:', {
                specialization,
                department,
                licenseNumber,
                hasSignature: !!signature
            });
            
            // Find doctor profile
            const doctor = await Doctor.findOne({ userAccount: currentUser._id });
            
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor profile not found'
                });
            }
            
            // ✅ FIX: Only update fields if they have valid values (not empty strings for required fields)
            if (specialization !== undefined && specialization !== null && specialization.trim() !== '') {
                doctor.specialization = specialization;
            }
            
            if (licenseNumber !== undefined && licenseNumber !== null) {
                doctor.licenseNumber = licenseNumber;
            }
            
            if (department !== undefined && department !== null) {
                doctor.department = department;
            }
            
            if (qualifications !== undefined && qualifications !== null) {
                doctor.qualifications = qualifications;
            }
            
            if (yearsOfExperience !== undefined && yearsOfExperience !== null) {
                doctor.yearsOfExperience = yearsOfExperience;
            }
            
            if (contactPhoneOffice !== undefined && contactPhoneOffice !== null) {
                doctor.contactPhoneOffice = contactPhoneOffice;
            }
            
            // Handle signature update
            if (signature !== undefined && signature !== null) {
                if (signature.trim() === '') {
                    // If empty signature, clear it
                    doctor.signature = '';
                    doctor.signatureMetadata = {
                        uploadedAt: new Date(),
                        originalSize: 0,
                        optimizedSize: 0,
                        originalName: '',
                        mimeType: 'image/png',
                        lastUpdated: new Date(),
                        format: 'base64',
                        width: 400,
                        height: 200
                    };
                } else {
                    doctor.signature = signature;
                    
                    // Update signature metadata
                    if (signatureMetadata) {
                        doctor.signatureMetadata = {
                            ...doctor.signatureMetadata,
                            ...signatureMetadata,
                            lastUpdated: new Date()
                        };
                    } else {
                        // Calculate metadata from base64
                        const base64Length = signature.length;
                        const sizeInBytes = Math.ceil((base64Length * 3) / 4);
                        
                        doctor.signatureMetadata = {
                            uploadedAt: new Date(),
                            lastUpdated: new Date(),
                            originalSize: sizeInBytes,
                            optimizedSize: sizeInBytes,
                            format: 'base64',
                            mimeType: signature.includes('image/png') ? 'image/png' : 'image/jpeg'
                        };
                    }
                }
            }
            
            await doctor.save();
            
            console.log('✅ [Doctor Profile] Profile updated successfully');
            
            // Return updated profile
            const updatedDoctor = await Doctor.findById(doctor._id)
                .populate('userAccount', 'fullName email username role')
                .populate('organization', 'name identifier displayName');
            
            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    doctorId: updatedDoctor._id,
                    userAccount: updatedDoctor.userAccount,
                    organization: updatedDoctor.organization,
                    organizationIdentifier: updatedDoctor.organizationIdentifier,
                    specialization: updatedDoctor.specialization,
                    licenseNumber: updatedDoctor.licenseNumber,
                    department: updatedDoctor.department,
                    qualifications: updatedDoctor.qualifications,
                    yearsOfExperience: updatedDoctor.yearsOfExperience,
                    contactPhoneOffice: updatedDoctor.contactPhoneOffice,
                    signature: updatedDoctor.signature,
                    signatureMetadata: updatedDoctor.signatureMetadata,
                    updatedAt: updatedDoctor.updatedAt
                }
            });
            
        } catch (error) {
            console.error('❌ [Doctor Profile] Error updating profile:', error);
            res.status(500).json({
                success: false,
                message: 'Server error while updating profile',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    
    /**
     * Upload/Update signature only
     * POST /api/doctors/signature
     */
    static async updateSignature(req, res) {
        try {
            const currentUser = req.user;
            const { signature, signatureMetadata } = req.body;
            
            if (!signature) {
                return res.status(400).json({
                    success: false,
                    message: 'Signature data is required'
                });
            }
            
            console.log('🖊️ [Doctor Signature] Updating signature for user:', currentUser._id);
            
            const doctor = await Doctor.findOne({ userAccount: currentUser._id });
            
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor profile not found'
                });
            }
            
            // Update signature
            doctor.signature = signature;
            
            // Calculate and update metadata
            const base64Length = signature.length;
            const sizeInBytes = Math.ceil((base64Length * 3) / 4);
            
            doctor.signatureMetadata = {
                ...doctor.signatureMetadata,
                ...signatureMetadata,
                uploadedAt: doctor.signatureMetadata?.uploadedAt || new Date(),
                lastUpdated: new Date(),
                originalSize: signatureMetadata?.originalSize || sizeInBytes,
                optimizedSize: signatureMetadata?.optimizedSize || sizeInBytes,
                format: 'base64',
                mimeType: signature.includes('image/png') ? 'image/png' : 'image/jpeg'
            };
            
            await doctor.save();
            
            console.log('✅ [Doctor Signature] Signature updated successfully');
            
            res.status(200).json({
                success: true,
                message: 'Signature updated successfully',
                data: {
                    signature: doctor.signature,
                    signatureMetadata: doctor.signatureMetadata
                }
            });
            
        } catch (error) {
            console.error('❌ [Doctor Signature] Error updating signature:', error);
            res.status(500).json({
                success: false,
                message: 'Server error while updating signature',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    
    /**
     * Delete signature
     * DELETE /api/doctors/signature
     */
    static async deleteSignature(req, res) {
        try {
            const currentUser = req.user;
            
            console.log('🗑️ [Doctor Signature] Deleting signature for user:', currentUser._id);
            
            const doctor = await Doctor.findOne({ userAccount: currentUser._id });
            
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor profile not found'
                });
            }
            
            doctor.signature = '';
            doctor.signatureMetadata = {
                uploadedAt: new Date(),
                originalSize: 0,
                optimizedSize: 0,
                originalName: '',
                mimeType: 'image/png',
                lastUpdated: new Date(),
                format: 'base64',
                width: 400,
                height: 200
            };
            
            await doctor.save();
            
            console.log('✅ [Doctor Signature] Signature deleted successfully');
            
            res.status(200).json({
                success: true,
                message: 'Signature deleted successfully'
            });
            
        } catch (error) {
            console.error('❌ [Doctor Signature] Error deleting signature:', error);
            res.status(500).json({
                success: false,
                message: 'Server error while deleting signature',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

export default DoctorCRUDController;