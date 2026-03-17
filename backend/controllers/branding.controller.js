import mongoose from 'mongoose';
import Lab from '../models/labModel.js';
import sharp from 'sharp'; // For image processing

// ✅ GET LAB BRANDING
export const getLabBranding = async (req, res) => {
    try {
        const { labId } = req.params;

        // Validate lab ID
        if (!mongoose.Types.ObjectId.isValid(labId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid lab ID'
            });
        }

        const lab = await Lab.findOne({
            _id: labId,
            organizationIdentifier: req.user.organizationIdentifier
        }).select('reportBranding');

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'Lab not found'
            });
        }

        console.log('✅ Branding data fetched for lab:', labId);

        res.json({
            success: true,
            data: lab.reportBranding || {}
        });

    } catch (error) {
        console.error('❌ Get lab branding error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch branding data'
        });
    }
};

// ✅ GET LAB BRANDING FOR LAB STAFF (Own lab only)
export const getOwnLabBranding = async (req, res) => {
    try {
        const userId = req.user._id;
        const organizationIdentifier = req.user.organizationIdentifier;

        // Find lab where user is a staff member
        const lab = await Lab.findOne({
            organizationIdentifier,
            'staffUsers.userId': userId,
            'staffUsers.isActive': true,
            isActive: true
        }).select('reportBranding name identifier');

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'No lab assignment found. Please contact your administrator.'
            });
        }

        console.log('✅ Lab staff branding data fetched:', lab.identifier);

        res.json({
            success: true,
            data: {
                labId: lab._id,
                labName: lab.name,
                labIdentifier: lab.identifier,
                branding: lab.reportBranding || {}
            }
        });

    } catch (error) {
        console.error('❌ Get own lab branding error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch branding data'
        });
    }
};

// ✅ UPLOAD BRANDING IMAGE (Store in MongoDB as Base64) - UPDATED TO USE FRONTEND DIMENSIONS
export const uploadBrandingImage = async (req, res) => {
    try {
        const { labId } = req.params;
        const { type, width, height } = req.body; // ✅ NEW: Accept width/height from frontend
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        if (!['header', 'footer'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid image type. Must be "header" or "footer"'
            });
        }

        // Validate lab
        const lab = await Lab.findOne({
            _id: labId,
            organizationIdentifier: req.user.organizationIdentifier
        });

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'Laboratory not found'
            });
        }

        console.log('📤 Processing branding image:', {
            labId,
            type,
            fileName: file.originalname,
            originalSize: file.size,
            mimeType: file.mimetype,
            frontendWidth: width,
            frontendHeight: height
        });

        // ✅ UPDATED: Process image WITHOUT resizing to preserve exact dimensions
        // Only optimize compression, don't change dimensions
        const processedImageBuffer = await sharp(file.buffer)
            .png({ quality: 90, compressionLevel: 9 })
            .toBuffer();

        // ✅ UPDATED: Use frontend-provided dimensions if available, fallback to Sharp metadata
        const metadata = await sharp(processedImageBuffer).metadata();
        const finalWidth = width ? parseInt(width) : metadata.width;
        const finalHeight = height ? parseInt(height) : metadata.height;

        // Convert to Base64 string
        const base64Image = processedImageBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        console.log('📊 Image processed:', {
            originalSize: file.size,
            processedSize: processedImageBuffer.length,
            frontendWidth: width,
            frontendHeight: height,
            sharpWidth: metadata.width,
            sharpHeight: metadata.height,
            finalWidth,
            finalHeight,
            compression: `${((1 - processedImageBuffer.length / file.size) * 100).toFixed(1)}%`
        });

        // Validate size (4MB limit)
        const sizeInMB = processedImageBuffer.length / (1024 * 1024);
        if (sizeInMB > 4) {
            return res.status(400).json({
                success: false,
                message: `Processed image is too large (${sizeInMB.toFixed(2)}MB). Maximum size is 4MB`
            });
        }

        // ✅ UPDATED: Update lab document with frontend-provided dimensions
        const updateField = `reportBranding.${type}Image`;
        const updatedLab = await Lab.findByIdAndUpdate(
            labId,
            {
                $set: {
                    [`${updateField}.url`]: dataUrl,
                    [`${updateField}.width`]: finalWidth,
                    [`${updateField}.height`]: finalHeight,
                    [`${updateField}.size`]: processedImageBuffer.length,
                    [`${updateField}.updatedAt`]: new Date(),
                    [`${updateField}.updatedBy`]: req.user._id
                },
                $unset: {
                    // Remove old Wasabi keys if they exist
                    [`${updateField}.wasabiKey`]: '',
                    [`${updateField}.cloudflareKey`]: ''
                }
            },
            { new: true }
        ).select('reportBranding');

        console.log('✅ Branding image saved to MongoDB:', {
            labId,
            type,
            size: `${sizeInMB.toFixed(2)}MB`,
            dimensions: `${finalWidth}x${finalHeight}`
        });

        res.json({
            success: true,
            message: `${type} image uploaded successfully`,
            data: {
                [`${type}Image`]: {
                    url: dataUrl,
                    width: finalWidth,
                    height: finalHeight,
                    size: processedImageBuffer.length,
                    updatedAt: new Date(),
                    updatedBy: req.user._id
                }
            }
        });

    } catch (error) {
        console.error('❌ Upload branding image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload image'
        });
    }
};

// ✅ UPLOAD BRANDING IMAGE FOR OWN LAB (Lab staff only) - UPDATED TO USE FRONTEND DIMENSIONS
export const uploadOwnLabBrandingImage = async (req, res) => {
    try {
        const userId = req.user._id;
        const organizationIdentifier = req.user.organizationIdentifier;
        const { type, width, height } = req.body; // ✅ NEW: Accept width/height from frontend
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided'
            });
        }

        if (!['header', 'footer'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid image type. Must be "header" or "footer"'
            });
        }

        // Find lab where user is a staff member
        const lab = await Lab.findOne({
            organizationIdentifier,
            'staffUsers.userId': userId,
            'staffUsers.isActive': true,
            isActive: true
        });

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'No lab found for this user'
            });
        }

        console.log('📤 Lab staff processing branding image:', {
            labId: lab._id,
            labIdentifier: lab.identifier,
            type,
            fileName: file.originalname,
            originalSize: file.size,
            frontendWidth: width,
            frontendHeight: height
        });

        // ✅ UPDATED: Process image WITHOUT resizing to preserve exact dimensions
        const processedImageBuffer = await sharp(file.buffer)
            .png({ quality: 90, compressionLevel: 9 })
            .toBuffer();

        // ✅ UPDATED: Use frontend-provided dimensions if available
        const metadata = await sharp(processedImageBuffer).metadata();
        const finalWidth = width ? parseInt(width) : metadata.width;
        const finalHeight = height ? parseInt(height) : metadata.height;

        const base64Image = processedImageBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64Image}`;

        // Validate size (4MB limit)
        const sizeInMB = processedImageBuffer.length / (1024 * 1024);
        if (sizeInMB > 4) {
            return res.status(400).json({
                success: false,
                message: `Processed image is too large (${sizeInMB.toFixed(2)}MB). Maximum size is 4MB`
            });
        }

        // ✅ UPDATED: Update lab document with frontend-provided dimensions
        const updateField = `reportBranding.${type}Image`;
        await Lab.findByIdAndUpdate(lab._id, {
            $set: {
                [`${updateField}.url`]: dataUrl,
                [`${updateField}.width`]: finalWidth,
                [`${updateField}.height`]: finalHeight,
                [`${updateField}.size`]: processedImageBuffer.length,
                [`${updateField}.updatedAt`]: new Date(),
                [`${updateField}.updatedBy`]: userId
            }
        });

        console.log('✅ Lab staff branding image saved:', {
            labIdentifier: lab.identifier,
            type,
            size: `${sizeInMB.toFixed(2)}MB`,
            dimensions: `${finalWidth}x${finalHeight}`
        });

        res.json({
            success: true,
            message: `${type} image uploaded successfully`,
            data: {
                [`${type}Image`]: {
                    url: dataUrl,
                    width: finalWidth,
                    height: finalHeight,
                    size: processedImageBuffer.length,
                    updatedAt: new Date()
                }
            }
        });

    } catch (error) {
        console.error('❌ Upload own lab branding image error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to upload image'
        });
    }
};

// ✅ TOGGLE BRANDING VISIBILITY
export const toggleBrandingVisibility = async (req, res) => {
    try {
        const { labId } = req.params;
        const { field, value } = req.body; // field: 'showHeader' or 'showFooter', value: true/false

        if (!['showHeader', 'showFooter'].includes(field)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid field. Must be "showHeader" or "showFooter"'
            });
        }

        const lab = await Lab.findOneAndUpdate(
            {
                _id: labId,
                organizationIdentifier: req.user.organizationIdentifier
            },
            {
                $set: { [`reportBranding.${field}`]: value }
            },
            { new: true }
        ).select('reportBranding');

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'Laboratory not found'
            });
        }

        console.log('✅ Branding visibility toggled:', { labId, field, value });

        res.json({
            success: true,
            message: 'Visibility updated successfully',
            data: lab.reportBranding
        });

    } catch (error) {
        console.error('❌ Toggle branding visibility error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update visibility'
        });
    }
};

// ✅ TOGGLE BRANDING VISIBILITY FOR OWN LAB
export const toggleOwnLabBrandingVisibility = async (req, res) => {
    try {
        const userId = req.user._id;
        const organizationIdentifier = req.user.organizationIdentifier;
        const { field, value } = req.body;

        if (!['showHeader', 'showFooter'].includes(field)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid field. Must be "showHeader" or "showFooter"'
            });
        }

        const lab = await Lab.findOneAndUpdate(
            {
                organizationIdentifier,
                'staffUsers.userId': userId,
                'staffUsers.isActive': true,
                isActive: true
            },
            {
                $set: { [`reportBranding.${field}`]: value }
            },
            { new: true }
        ).select('reportBranding');

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'No lab found for this user'
            });
        }

        console.log('✅ Lab staff branding visibility toggled:', {
            labIdentifier: lab.identifier,
            field,
            value
        });

        res.json({
            success: true,
            message: 'Visibility updated successfully',
            data: lab.reportBranding
        });

    } catch (error) {
        console.error('❌ Toggle own lab branding visibility error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update visibility'
        });
    }
};

// ✅ DELETE BRANDING IMAGE
export const deleteBrandingImage = async (req, res) => {
    try {
        const { labId, type } = req.params;

        if (!['header', 'footer'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid image type'
            });
        }

        const updateField = `reportBranding.${type}Image`;
        const lab = await Lab.findOneAndUpdate(
            {
                _id: labId,
                organizationIdentifier: req.user.organizationIdentifier
            },
            {
                $set: {
                    [`${updateField}.url`]: '',
                    [`${updateField}.width`]: 0,
                    [`${updateField}.height`]: 0,
                    [`${updateField}.size`]: 0,
                    [`${updateField}.updatedAt`]: new Date(),
                    [`${updateField}.updatedBy`]: req.user._id
                }
            },
            { new: true }
        ).select('reportBranding');

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'Laboratory not found'
            });
        }

        console.log('✅ Branding image deleted:', { labId, type });

        res.json({
            success: true,
            message: `${type} image deleted successfully`,
            data: lab.reportBranding
        });

    } catch (error) {
        console.error('❌ Delete branding image error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete image'
        });
    }
};

// ✅ DELETE BRANDING IMAGE FOR OWN LAB
export const deleteOwnLabBrandingImage = async (req, res) => {
    try {
        const userId = req.user._id;
        const organizationIdentifier = req.user.organizationIdentifier;
        const { type } = req.params;

        if (!['header', 'footer'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid image type'
            });
        }

        const updateField = `reportBranding.${type}Image`;
        const lab = await Lab.findOneAndUpdate(
            {
                organizationIdentifier,
                'staffUsers.userId': userId,
                'staffUsers.isActive': true,
                isActive: true
            },
            {
                $set: {
                    [`${updateField}.url`]: '',
                    [`${updateField}.width`]: 0,
                    [`${updateField}.height`]: 0,
                    [`${updateField}.size`]: 0,
                    [`${updateField}.updatedAt`]: new Date(),
                    [`${updateField}.updatedBy`]: userId
                }
            },
            { new: true }
        ).select('reportBranding');

        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'No lab found for this user'
            });
        }

        console.log('✅ Lab staff branding image deleted:', {
            labIdentifier: lab.identifier,
            type
        });

        res.json({
            success: true,
            message: `${type} image deleted successfully`,
            data: lab.reportBranding
        });

    } catch (error) {
        console.error('❌ Delete own lab branding image error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete image'
        });
    }
};

export default {
    getLabBranding,
    getOwnLabBranding,
    uploadBrandingImage,
    uploadOwnLabBrandingImage,
    toggleBrandingVisibility,
    toggleOwnLabBrandingVisibility,
    deleteBrandingImage,
    deleteOwnLabBrandingImage
};