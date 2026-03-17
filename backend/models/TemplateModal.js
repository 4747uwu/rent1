import mongoose from 'mongoose';

const htmlTemplateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Template title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'General',
      'CT',
      'CR',
      'CT SCREENING FORMAT',
      'ECHO',
      'EEG-TMT-NCS',
      'MR',
      'MRI SCREENING FORMAT',
      'PT',
      'US',
      'Other'
    ],
    index: true
  },
  
  htmlContent: {
    type: String,
    required: [true, 'HTML content is required'],
    validate: {
      validator: function(content) {
        // Basic validation to ensure it's not empty after stripping HTML
        const textContent = content.replace(/<[^>]*>/g, '').trim();
        return textContent.length > 0;
      },
      message: 'Template must contain actual content'
    }
  },
  
  // ✅ NEW: Template ownership and access control
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // ✅ NEW: Template scope - global or doctor-specific
  templateScope: {
    type: String,
    enum: ['global', 'doctor_specific'],
    required: true,
    default: 'doctor_specific',
    index: true
  },
  
  // ✅ NEW: Organization context for multi-tenancy
  organizationIdentifier: {
    type: String,
    required: true,
    index: true
  },
  
  // ✅ NEW: Specific doctor assignment (for doctor-specific templates)
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    validate: {
      validator: function(value) {
        // If template is doctor_specific, assignedDoctor is required
        if (this.templateScope === 'doctor_specific' && !value) {
          return false;
        }
        return true;
      },
      message: 'Doctor-specific templates must have an assigned doctor'
    }
  },
  
  // ✅ NEW: Template metadata
  templateMetadata: {
    usageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUsedAt: {
      type: Date,
      default: null
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    description: {
      type: String,
      maxlength: 500,
      trim: true
    }
  },
  
  // ✅ NEW: Template versioning
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // ✅ NEW: Parent template (for versioning)
  parentTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HTMLTemplate',
    default: null
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// ✅ COMPOUND INDEXES for better query performance
htmlTemplateSchema.index({ 
  organizationIdentifier: 1, 
  templateScope: 1, 
  isActive: 1 
});

htmlTemplateSchema.index({ 
  assignedDoctor: 1, 
  category: 1, 
  isActive: 1 
});

htmlTemplateSchema.index({ 
  createdBy: 1, 
  templateScope: 1, 
  createdAt: -1 
});

// ✅ UNIQUE INDEX: Prevent duplicate template titles within same scope and organization
htmlTemplateSchema.index({ 
  title: 1, 
  organizationIdentifier: 1, 
  templateScope: 1,
  assignedDoctor: 1 
}, { 
  unique: true,
  partialFilterExpression: { isActive: true }
});

// ✅ TEXT INDEX for search functionality
htmlTemplateSchema.index({ 
  title: 'text', 
  'templateMetadata.description': 'text',
  'templateMetadata.tags': 'text'
});

// ✅ VIRTUAL: Content preview
htmlTemplateSchema.virtual('contentPreview').get(function() {
  const textContent = this.htmlContent.replace(/<[^>]*>/g, '').trim();
  return textContent.length > 150 ? textContent.substring(0, 150) + '...' : textContent;
});

// ✅ VIRTUAL: Template access level
htmlTemplateSchema.virtual('accessLevel').get(function() {
  if (this.templateScope === 'global') {
    return 'Global Template';
  } else if (this.assignedDoctor) {
    return 'Personal Template';
  }
  return 'Unknown';
});

// ✅ STATIC METHOD: Find templates accessible to a doctor
htmlTemplateSchema.statics.findAccessibleTemplates = function(doctorId, organizationIdentifier, category = null) {
  const query = {
    organizationIdentifier,
    isActive: true,
    $or: [
      { templateScope: 'global' },
      { 
        templateScope: 'doctor_specific', 
        assignedDoctor: new mongoose.Types.ObjectId(doctorId) 
      }
    ]
  };
  
  if (category && category !== 'all') {
    query.category = category;
  }
  
  return this.find(query)
    .populate('createdBy', 'fullName email role')
    .populate('assignedDoctor', 'fullName email')
    .sort({ 'templateMetadata.isDefault': -1, createdAt: -1 });
};

// ✅ STATIC METHOD: Find doctor's personal templates
htmlTemplateSchema.statics.findDoctorTemplates = function(doctorId, organizationIdentifier) {
  return this.find({
    organizationIdentifier,
    templateScope: 'doctor_specific',
    assignedDoctor: new mongoose.Types.ObjectId(doctorId),
    isActive: true
  })
  .populate('createdBy', 'fullName email role')
  .sort({ createdAt: -1 });
};

// ✅ INSTANCE METHOD: Update usage statistics
htmlTemplateSchema.methods.recordUsage = function() {
  this.templateMetadata.usageCount += 1;
  this.templateMetadata.lastUsedAt = new Date();
  return this.save();
};

// ✅ INSTANCE METHOD: Check if doctor can access this template
htmlTemplateSchema.methods.canDoctorAccess = function(doctorId, organizationIdentifier) {
  if (this.organizationIdentifier !== organizationIdentifier) {
    return false;
  }
  
  if (this.templateScope === 'global') {
    return true;
  }
  
  if (this.templateScope === 'doctor_specific' && 
      this.assignedDoctor && 
      this.assignedDoctor.toString() === doctorId.toString()) {
    return true;
  }
  
  return false;
};

// ✅ PRE-SAVE MIDDLEWARE: Set template scope based on creator role
htmlTemplateSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const User = mongoose.model('User');
      const creator = await User.findById(this.createdBy);
      
      if (creator && creator.role === 'admin') {
        this.templateScope = 'global';
        this.assignedDoctor = null; // Global templates don't have assigned doctors
      } else if (creator && ['doctor_account', 'radiologist'].includes(creator.role)) {
        this.templateScope = 'doctor_specific';
        this.assignedDoctor = this.createdBy; // Assign to the creating doctor
      }
    } catch (error) {
      console.error('Error in template pre-save middleware:', error);
    }
  }
  next();
});

// ✅ PRE-SAVE MIDDLEWARE: Validate template scope consistency
htmlTemplateSchema.pre('save', function(next) {
  if (this.templateScope === 'global' && this.assignedDoctor) {
    this.assignedDoctor = null; // Global templates shouldn't have assigned doctors
  }
  
  if (this.templateScope === 'doctor_specific' && !this.assignedDoctor) {
    return next(new Error('Doctor-specific templates must have an assigned doctor'));
  }
  
  next();
});

// Ensure virtual fields are serialized
htmlTemplateSchema.set('toJSON', { virtuals: true });
htmlTemplateSchema.set('toObject', { virtuals: true });

export default mongoose.model('HTMLTemplate', htmlTemplateSchema);