import HTMLTemplate from '../models/TemplateModal.js';
import User from '../models/userModel.js';
import mongoose from 'mongoose';

// ✅ 1. CREATE TEMPLATE - Doctor creates their own template
export const createTemplate = async (req, res) => {
    try {
        const doctor = req.user;
        
        // Validate doctor role
        if (!['radiologist', 'doctor_account'].includes(doctor.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only doctors can create templates'
            });
        }

        const { 
            title, 
            category, 
            htmlContent, 
            description, 
            tags = [],
            isDefault = false 
        } = req.body;

        // Validate required fields
        if (!title || !category || !htmlContent) {
            return res.status(400).json({
                success: false,
                message: 'Title, category, and content are required'
            });
        }

        // Check for duplicate template title for this doctor
        const existingTemplate = await HTMLTemplate.findOne({
            title: title.trim(),
            organizationIdentifier: doctor.organizationIdentifier,
            templateScope: 'doctor_specific',
            assignedDoctor: doctor._id,
            isActive: true
        });

        if (existingTemplate) {
            return res.status(409).json({
                success: false,
                message: 'A template with this title already exists in your templates'
            });
        }

        // Create new doctor-specific template
        const newTemplate = new HTMLTemplate({
            title: title.trim(),
            category,
            htmlContent,
            organizationIdentifier: doctor.organizationIdentifier,
            createdBy: doctor._id,
            assignedDoctor: doctor._id, // Assign to creating doctor
            templateScope: 'doctor_specific',
            templateMetadata: {
                description: description?.trim() || '',
                tags: tags.map(tag => tag.trim().toLowerCase()),
                isDefault: isDefault
            }
        });

        await newTemplate.save();

        // Populate the response
        const populatedTemplate = await HTMLTemplate.findById(newTemplate._id)
            .populate('createdBy', 'fullName email role')
            .populate('assignedDoctor', 'fullName email');

        console.log(`✅ TEMPLATE CREATED: ${newTemplate.title} by doctor ${doctor.fullName}`);

        return res.status(201).json({
            success: true,
            message: 'Template created successfully',
            template: populatedTemplate
        });

    } catch (error) {
        console.error('❌ Error creating template:', error);
        
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'A template with this title already exists'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to create template',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 2. GET ALL ACCESSIBLE TEMPLATES - Doctor's templates + global templates
export const getAllTemplates = async (req, res) => {
    try {
        const doctor = req.user;
        const { category, search, page = 1, limit = 20 } = req.query;

        if (!['radiologist', 'doctor_account'].includes(doctor.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only doctors can access templates'
            });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query for accessible templates
        let query = {
            organizationIdentifier: doctor.organizationIdentifier,
            isActive: true,
            $or: [
                { templateScope: 'global' },
                { 
                    templateScope: 'doctor_specific', 
                    assignedDoctor: doctor._id 
                }
            ]
        };

        // Add category filter
        if (category && category !== 'all') {
            query.category = category;
        }

        // Add search filter
        if (search) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { 'templateMetadata.description': { $regex: search, $options: 'i' } },
                    { 'templateMetadata.tags': { $regex: search, $options: 'i' } }
                ]
            });
        }

        const [templates, totalCount] = await Promise.all([
            HTMLTemplate.find(query)
                .populate('createdBy', 'fullName email role')
                .populate('assignedDoctor', 'fullName email')
                .sort({ 
                    'templateMetadata.isDefault': -1, 
                    templateScope: 1, // Global first
                    createdAt: -1 
                })
                .skip(skip)
                .limit(parseInt(limit)),
            
            HTMLTemplate.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            templates,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalTemplates: totalCount,
                limit: parseInt(limit),
                hasNextPage: skip + templates.length < totalCount,
                hasPrevPage: parseInt(page) > 1
            },
            metadata: {
                category: category || 'all',
                search: search || '',
                userRole: doctor.role,
                organizationIdentifier: doctor.organizationIdentifier
            }
        });

    } catch (error) {
        console.error('❌ Error fetching templates:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch templates',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 3. GET DOCTOR'S PERSONAL TEMPLATES ONLY
export const getMyTemplates = async (req, res) => {
    try {
        const doctor = req.user;
        const { category, search, page = 1, limit = 20 } = req.query;

        if (!['radiologist', 'doctor_account'].includes(doctor.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only doctors can access templates'
            });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query for doctor's personal templates only
        let query = {
            organizationIdentifier: doctor.organizationIdentifier,
            templateScope: 'doctor_specific',
            assignedDoctor: doctor._id,
            isActive: true
        };

        // Add category filter
        if (category && category !== 'all') {
            query.category = category;
        }

        // Add search filter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { 'templateMetadata.description': { $regex: search, $options: 'i' } },
                { 'templateMetadata.tags': { $regex: search, $options: 'i' } }
            ];
        }

        const [templates, totalCount] = await Promise.all([
            HTMLTemplate.find(query)
                .populate('createdBy', 'fullName email role')
                .sort({ 'templateMetadata.isDefault': -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            
            HTMLTemplate.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            templates,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalTemplates: totalCount,
                limit: parseInt(limit),
                hasNextPage: skip + templates.length < totalCount,
                hasPrevPage: parseInt(page) > 1
            },
            metadata: {
                category: category || 'all',
                search: search || '',
                templateScope: 'doctor_specific',
                userRole: doctor.role,
                organizationIdentifier: doctor.organizationIdentifier
            }
        });

    } catch (error) {
        console.error('❌ Error fetching doctor templates:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch your templates',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 4. GET TEMPLATE BY ID
export const getTemplateById = async (req, res) => {
    try {
        const doctor = req.user;
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid template ID'
            });
        }

        const template = await HTMLTemplate.findById(templateId)
            .populate('createdBy', 'fullName email role')
            .populate('assignedDoctor', 'fullName email');

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        // Check if doctor can access this template
        if (!template.canDoctorAccess(doctor._id, doctor.organizationIdentifier)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied to this template'
            });
        }

        // Record template usage
        await template.recordUsage();

        return res.status(200).json({
            success: true,
            template
        });

    } catch (error) {
        console.error('❌ Error fetching template:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch template',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 5. UPDATE TEMPLATE (only doctor's own templates)
export const updateTemplate = async (req, res) => {
    try {
        const doctor = req.user;
        const { templateId } = req.params;
        const { title, category, htmlContent, description, tags, isDefault } = req.body;

        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid template ID'
            });
        }

        const template = await HTMLTemplate.findById(templateId);

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        // Check if doctor owns this template
        if (template.templateScope !== 'doctor_specific' || 
            template.assignedDoctor.toString() !== doctor._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own templates'
            });
        }

        // Check for duplicate title (excluding current template)
        if (title && title !== template.title) {
            const duplicateTemplate = await HTMLTemplate.findOne({
                title: title.trim(),
                organizationIdentifier: doctor.organizationIdentifier,
                templateScope: 'doctor_specific',
                assignedDoctor: doctor._id,
                isActive: true,
                _id: { $ne: templateId }
            });

            if (duplicateTemplate) {
                return res.status(409).json({
                    success: false,
                    message: 'A template with this title already exists in your templates'
                });
            }
        }

        // Update template fields
        if (title) template.title = title.trim();
        if (category) template.category = category;
        if (htmlContent) template.htmlContent = htmlContent;
        if (description !== undefined) template.templateMetadata.description = description.trim();
        if (tags) template.templateMetadata.tags = tags.map(tag => tag.trim().toLowerCase());
        if (isDefault !== undefined) template.templateMetadata.isDefault = isDefault;

        // Increment version
        template.version += 1;

        await template.save();

        const updatedTemplate = await HTMLTemplate.findById(templateId)
            .populate('createdBy', 'fullName email role')
            .populate('assignedDoctor', 'fullName email');

        return res.status(200).json({
            success: true,
            message: 'Template updated successfully',
            template: updatedTemplate
        });

    } catch (error) {
        console.error('❌ Error updating template:', error);
        
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'A template with this title already exists'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to update template',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 6. DELETE TEMPLATE (soft delete - only doctor's own templates)
export const deleteTemplate = async (req, res) => {
    try {
        const doctor = req.user;
        const { templateId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid template ID'
            });
        }

        const template = await HTMLTemplate.findById(templateId);

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        // Check if doctor owns this template
        if (template.templateScope !== 'doctor_specific' || 
            template.assignedDoctor.toString() !== doctor._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own templates'
            });
        }

        // Soft delete
        template.isActive = false;
        await template.save();

        return res.status(200).json({
            success: true,
            message: 'Template deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error deleting template:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete template',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ 7. GET TEMPLATE CATEGORIES WITH COUNTS
export const getTemplateCategories = async (req, res) => {
    try {
        const doctor = req.user;

        const pipeline = [
            {
                $match: {
                    organizationIdentifier: doctor.organizationIdentifier,
                    isActive: true,
                    $or: [
                        { templateScope: 'global' },
                        { 
                            templateScope: 'doctor_specific', 
                            assignedDoctor: new mongoose.Types.ObjectId(doctor._id) 
                        }
                    ]
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    globalCount: {
                        $sum: { $cond: [{ $eq: ['$templateScope', 'global'] }, 1, 0] }
                    },
                    personalCount: {
                        $sum: { $cond: [{ $eq: ['$templateScope', 'doctor_specific'] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ];

        const categories = await HTMLTemplate.aggregate(pipeline);

        const totalTemplates = categories.reduce((sum, cat) => sum + cat.count, 0);

        return res.status(200).json({
            success: true,
            categories: categories.map(cat => ({
                category: cat._id,
                totalCount: cat.count,
                globalCount: cat.globalCount,
                personalCount: cat.personalCount
            })),
            totalTemplates,
            metadata: {
                userRole: doctor.role,
                organizationIdentifier: doctor.organizationIdentifier
            }
        });

    } catch (error) {
        console.error('❌ Error fetching template categories:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch template categories',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    createTemplate,
    getAllTemplates,
    getMyTemplates,
    getTemplateById,
    updateTemplate,
    deleteTemplate,
    getTemplateCategories
};