import HTMLTemplate from '../models/TemplateModal.js';

class HTMLTemplateController {
  
  // Get all HTML templates
  static async getTemplates(req, res) {
    try {
      const { 
        category, 
        search, 
        page = 1, 
        limit = 20,
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter
      const filter = { isActive: true };
      
      if (category && category !== 'all') {
        filter.category = category;
      }
      
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { htmlContent: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortObj = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [templates, totalCount] = await Promise.all([
        HTMLTemplate.find(filter)
          .select('title category htmlContent createdBy updatedAt')
          .populate('createdBy', 'fullName email')
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        HTMLTemplate.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          templates,
          pagination: {
            current: parseInt(page),
            pages: Math.ceil(totalCount / parseInt(limit)),
            total: totalCount,
            limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('Error fetching HTML templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch templates',
        error: error.message
      });
    }
  }

  // Get single template by ID
  static async getTemplate(req, res) {
    try {
      const { templateId } = req.params;

      const template = await HTMLTemplate.findById(templateId)
        .populate('createdBy', 'fullName email')
        .lean();

      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      res.json({
        success: true,
        data: template
      });

    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch template',
        error: error.message
      });
    }
  }

  // Create new HTML template
  static async createTemplate(req, res) {
    try {
      const userId = req.user.id;
      // ensure organization context is set (required by TemplateModal)
      const organizationIdentifier = req.user.organizationIdentifier || 'default';
      const { title, category, htmlContent } = req.body;

      // Validate required fields
      if (!title || !category || !htmlContent) {
        return res.status(400).json({
          success: false,
          message: 'Title, category, and HTML content are required'
        });
      }

      // Check for duplicate title (within same organization)
      const existingTemplate = await HTMLTemplate.findOne({ 
        title: title.trim(),
        organizationIdentifier,
        isActive: true 
      });

      if (existingTemplate) {
        return res.status(400).json({
          success: false,
          message: 'Template with this title already exists'
        });
      }

      // Create template
      const template = new HTMLTemplate({
        title: title.trim(),
        category,
        htmlContent,
        createdBy: userId,
        organizationIdentifier
      });

      await template.save();
      await template.populate('createdBy', 'fullName email');

      console.log(`✅ HTML Template created: ${template.title} by ${req.user.fullName}`);

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
      });

    } catch (error) {
      console.error('Error creating HTML template:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Template with this title already exists'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create template',
        error: error.message
      });
    }
  }

  // Update HTML template
  static async updateTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const { title, category, htmlContent } = req.body;

      const template = await HTMLTemplate.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      // Check if title is being changed and if it conflicts
      if (title && title.trim() !== template.title) {
        const existingTemplate = await HTMLTemplate.findOne({ 
          title: title.trim(),
          _id: { $ne: templateId },
          isActive: true 
        });

        if (existingTemplate) {
          return res.status(400).json({
            success: false,
            message: 'Template with this title already exists'
          });
        }
      }

      // Update template
      if (title) template.title = title.trim();
      if (category) template.category = category;
      if (htmlContent) template.htmlContent = htmlContent;
      
      template.updatedAt = new Date();
      
      await template.save();
      await template.populate('createdBy', 'fullName email');

      console.log(`✅ HTML Template updated: ${template.title} by ${req.user.fullName}`);

      res.json({
        success: true,
        message: 'Template updated successfully',
        data: template
      });

    } catch (error) {
      console.error('Error updating HTML template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update template',
        error: error.message
      });
    }
  }

  // Delete template (soft delete)
  static async deleteTemplate(req, res) {
    try {
      const { templateId } = req.params;

      const template = await HTMLTemplate.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      // Soft delete
      template.isActive = false;
      template.updatedAt = new Date();
      await template.save();

      console.log(`🗑️ HTML Template deleted: ${template.title} by ${req.user.fullName}`);

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting HTML template:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete template',
        error: error.message
      });
    }
  }

  // Get categories for filter dropdown
  static async getCategories(req, res) {
    try {
      const categories = await HTMLTemplate.distinct('category', { isActive: true });
      
      res.json({
        success: true,
        data: {
          categories: categories.sort()
        }
      });

    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        error: error.message
      });
    }
  }

  // Get templates for reporting (grouped by category)
  static async getTemplatesForReporting(req, res) {
    try {
      const templates = await HTMLTemplate.find({ isActive: true })
        .select('title category htmlContent')
        .sort({ category: 1, title: 1 })
        .lean();

      // Group by category
      const groupedTemplates = templates.reduce((acc, template) => {
        const category = template.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        
        acc[category].push({
          id: template._id,
          title: template.title,
          htmlContent: template.htmlContent
        });
        
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          templates: groupedTemplates,
          totalCount: templates.length
        }
      });

    } catch (error) {
      console.error('Error fetching templates for reporting:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch templates for reporting',
        error: error.message
      });
    }
  }

  // ✅ Get super_global templates (created by super_admin, available to all orgs)
  static async getCrossOrgGlobalTemplates(req, res) {
    try {
      const { category, search, limit = 100 } = req.query;

      const query = { templateScope: 'super_global', isActive: true };
      if (category && category !== 'all') query.category = category;
      if (search && search.trim()) {
        query.$or = [
          { title: { $regex: search.trim(), $options: 'i' } },
          { 'templateMetadata.description': { $regex: search.trim(), $options: 'i' } }
        ];
      }

      const templates = await HTMLTemplate.find(query)
        .populate('createdBy', 'fullName email')
        .sort({ 'templateMetadata.isDefault': -1, createdAt: -1 })
        .limit(parseInt(limit))
        .lean();

      const grouped = templates.reduce((acc, t) => {
        const cat = t.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(t);
        return acc;
      }, {});

      res.json({ success: true, data: { templates: grouped, count: templates.length } });
    } catch (error) {
      console.error('Error fetching cross-org global templates:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch templates', error: error.message });
    }
  }

  // ✅ Get organization-level global templates
  static async getOrgGlobalTemplates(req, res) {
    try {
      const organizationIdentifier = req.user.organizationIdentifier || 'default';
      const { category, search, page = 1, limit = 100 } = req.query;

      let query = {
        organizationIdentifier,
        templateScope: 'global',
        isActive: true
      };

      if (category && category !== 'all') query.category = category;
      if (search && search.trim()) {
        query.$or = [
          { title: { $regex: search.trim(), $options: 'i' } },
          { 'templateMetadata.description': { $regex: search.trim(), $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [templates, totalCount] = await Promise.all([
        HTMLTemplate.find(query)
          .populate('createdBy', 'fullName email role')
          .sort({ 'templateMetadata.isDefault': -1, createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        HTMLTemplate.countDocuments(query)
      ]);

      const groupedTemplates = templates.reduce((acc, t) => {
        const cat = t.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(t);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          templates: groupedTemplates,
          count: templates.length,
          pagination: { current: parseInt(page), total: Math.ceil(totalCount / parseInt(limit)), totalCount }
        }
      });
    } catch (error) {
      console.error('Error fetching org global templates:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch templates', error: error.message });
    }
  }

  // ✅ NEW: Get doctor-specific templates
  static async getDoctorTemplates(req, res) {
    try {
      const userId = req.user.id;
      const organizationIdentifier = req.user.organizationIdentifier || 'default';
      const { category, search, page = 1, limit = 50 } = req.query;

      console.log(`🩺 [Doctor Templates] Fetching templates for doctor: ${req.user.fullName}`);

      let query = {
        organizationIdentifier,
        templateScope: 'doctor_specific',
        assignedDoctor: userId,
        isActive: true
      };

      // Add category filter
      if (category && category !== 'all') {
        query.category = category;
      }

      // Add search filter
      if (search && search.trim()) {
        query.$or = [
          { title: { $regex: search.trim(), $options: 'i' } },
          { 'templateMetadata.description': { $regex: search.trim(), $options: 'i' } },
          { 'templateMetadata.tags': { $in: [new RegExp(search.trim(), 'i')] } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [templates, totalCount] = await Promise.all([
        HTMLTemplate.find(query)
          .populate('createdBy', 'fullName email role')
          .sort({ 'templateMetadata.isDefault': -1, createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        HTMLTemplate.countDocuments(query)
      ]);

      // Group templates by category
      const groupedTemplates = templates.reduce((acc, template) => {
        const category = template.category || 'Other';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(template);
        return acc;
      }, {});

      console.log(`✅ [Doctor Templates] Found ${templates.length} personal templates`);

      res.json({
        success: true,
        data: {
          templates: groupedTemplates,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(totalCount / parseInt(limit)),
            count: templates.length,
            totalCount
          },
          filters: {
            category: category || 'all',
            search: search || ''
          }
        }
      });

    } catch (error) {
      console.error('Error fetching doctor templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch doctor templates',
        error: error.message
      });
    }
  }

  // ✅ NEW: Get all templates (accessible to doctor)
  static async getAllAccessibleTemplates(req, res) {
    try {
      const userId = req.user.id;
      const organizationIdentifier = req.user.organizationIdentifier || 'default';
      const { category, search, page = 1, limit = 50 } = req.query;

      console.log(`🌐 [All Templates] Fetching accessible templates for: ${req.user.fullName}`);

      let query = {
        isActive: true,
        $or: [
          { templateScope: 'super_global' },
          { templateScope: 'global', organizationIdentifier },
          {
            templateScope: 'doctor_specific',
            organizationIdentifier,
            assignedDoctor: userId
          }
        ]
      };

      // Add category filter
      if (category && category !== 'all') {
        query.category = category;
      }

      // Add search filter
      if (search && search.trim()) {
        const searchConditions = [
          { title: { $regex: search.trim(), $options: 'i' } },
          { 'templateMetadata.description': { $regex: search.trim(), $options: 'i' } },
          { 'templateMetadata.tags': { $in: [new RegExp(search.trim(), 'i')] } }
        ];

        if (query.$or) {
          // Combine existing $or with search conditions
          query = {
            $and: [
              { $or: query.$or },
              { $or: searchConditions }
            ],
            organizationIdentifier,
            isActive: true
          };
          if (category && category !== 'all') {
            query.category = category;
          }
        } else {
          query.$or = searchConditions;
        }
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [templates, totalCount] = await Promise.all([
        HTMLTemplate.find(query)
          .populate('createdBy', 'fullName email role')
          .populate('assignedDoctor', 'fullName email')
          .sort({ 
            templateScope: 1, // Global first
            'templateMetadata.isDefault': -1, 
            createdAt: -1 
          })
          .skip(skip)
          .limit(parseInt(limit)),
        HTMLTemplate.countDocuments(query)
      ]);

      // Group templates by category and scope
      const groupedTemplates = templates.reduce((acc, template) => {
        const category = template.category || 'Other';
        if (!acc[category]) {
          acc[category] = {
            super_global: [],
            global: [],
            personal: []
          };
        }

        if (template.templateScope === 'super_global') {
          acc[category].super_global.push(template);
        } else if (template.templateScope === 'global') {
          acc[category].global.push(template);
        } else {
          acc[category].personal.push(template);
        }

        return acc;
      }, {});

      console.log(`✅ [All Templates] Found ${templates.length} accessible templates`);

      res.json({
        success: true,
        data: {
          templates: groupedTemplates,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(totalCount / parseInt(limit)),
            count: templates.length,
            totalCount
          },
          filters: {
            category: category || 'all',
            search: search || ''
          },
          stats: {
            superGlobalCount: templates.filter(t => t.templateScope === 'super_global').length,
            globalCount: templates.filter(t => t.templateScope === 'global').length,
            personalCount: templates.filter(t => t.templateScope === 'doctor_specific').length
          }
        }
      });

    } catch (error) {
      console.error('Error fetching all accessible templates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch accessible templates',
        error: error.message
      });
    }
  }

  // ✅ Get all super_global templates (for super_admin management)
  static async getSuperGlobalTemplates(req, res) {
    try {
      const { category, search, page = 1, limit = 50 } = req.query;

      const filter = { templateScope: 'super_global', isActive: true };
      if (category && category !== 'all') filter.category = category;
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { 'templateMetadata.description': { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [templates, totalCount] = await Promise.all([
        HTMLTemplate.find(filter)
          .populate('createdBy', 'fullName email role')
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        HTMLTemplate.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          templates,
          pagination: { current: parseInt(page), pages: Math.ceil(totalCount / parseInt(limit)), total: totalCount }
        }
      });
    } catch (error) {
      console.error('Error fetching super global templates:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch templates', error: error.message });
    }
  }

  // ✅ Create a super_global template (super_admin only)
  static async createSuperGlobalTemplate(req, res) {
    try {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Only super admins can create global templates' });
      }

      const { title, category, htmlContent, templateMetadata } = req.body;
      if (!title || !category || !htmlContent) {
        return res.status(400).json({ success: false, message: 'Title, category, and HTML content are required' });
      }

      const existing = await HTMLTemplate.findOne({ title: title.trim(), templateScope: 'super_global', isActive: true });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A super global template with this title already exists' });
      }

      const template = new HTMLTemplate({
        title: title.trim(),
        category,
        htmlContent,
        createdBy: req.user.id,
        templateScope: 'super_global',
        organizationIdentifier: 'super_global',
        assignedDoctor: null,
        templateMetadata: templateMetadata || {}
      });

      await template.save();
      await template.populate('createdBy', 'fullName email');

      res.status(201).json({ success: true, message: 'Super global template created', data: template });
    } catch (error) {
      console.error('Error creating super global template:', error);
      res.status(500).json({ success: false, message: 'Failed to create template', error: error.message });
    }
  }

  // ✅ Update a super_global template (super_admin only)
  static async updateSuperGlobalTemplate(req, res) {
    try {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Only super admins can update global templates' });
      }

      const { templateId } = req.params;
      const { title, category, htmlContent, templateMetadata } = req.body;

      const template = await HTMLTemplate.findOne({ _id: templateId, templateScope: 'super_global' });
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      if (title) template.title = title.trim();
      if (category) template.category = category;
      if (htmlContent) template.htmlContent = htmlContent;
      if (templateMetadata) {
        template.templateMetadata = { ...template.templateMetadata, ...templateMetadata };
      }

      await template.save();
      res.json({ success: true, message: 'Template updated', data: template });
    } catch (error) {
      console.error('Error updating super global template:', error);
      res.status(500).json({ success: false, message: 'Failed to update template', error: error.message });
    }
  }

  // ✅ Delete a super_global template (super_admin only)
  static async deleteSuperGlobalTemplate(req, res) {
    try {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Only super admins can delete global templates' });
      }

      const { templateId } = req.params;
      const template = await HTMLTemplate.findOne({ _id: templateId, templateScope: 'super_global' });
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      template.isActive = false;
      await template.save();
      res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
      console.error('Error deleting super global template:', error);
      res.status(500).json({ success: false, message: 'Failed to delete template', error: error.message });
    }
  }
}

export default HTMLTemplateController;