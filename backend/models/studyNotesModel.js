import mongoose from 'mongoose';

const StudyNotesSchema = new mongoose.Schema({
    // ✅ STUDY REFERENCE
    studyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DicomStudy',
        required: true,
        index: { background: true } // For fast study-based queries
    },
    
    studyInstanceUID: {
        type: String,
        required: true,
        index: { background: true } // Alternative lookup
    },

    // ✅ NOTE CONTENT
    noteText: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000 // Prevent extremely long notes
    },

    // ✅ NOTE METADATA
    noteType: {
        type: String,
        enum: [
            'general',           // General observations
            'clinical',          // Clinical findings
            'technical',         // Technical issues
            'administrative',    // Admin notes
            'quality',          // Quality control
            'followup',         // Follow-up required
            'priority',         // Priority/urgent notes
            'discussion',       // Discussion points
            'correction',       // Correction notes
            'verification'      // Verification notes
        ],
        default: 'general',
        index: { background: true }
    },

    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
        index: { background: true }
    },

    // ✅ USER INFORMATION
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: { background: true }
    },

    createdByName: {
        type: String,
        required: true,
        trim: true
    },

    createdByRole: {
        type: String,
        required: true,
        enum: ['admin', 'doctor', 'radiologist', 'technician', 'verifier', 'typist', 'assigner', 'assignor', 'lab_staff'], // ✅ ADDED 'assignor'
        index: { background: true }
    },

    // ✅ VISIBILITY & ACCESS
    visibility: {
        type: String,
        enum: [
            'public',       // Visible to all roles
            'medical',      // Only medical staff (doctors, radiologists, verifiers)
            'admin',        // Only admin roles
            'private'       // Only creator and admins
        ],
        default: 'public',
        index: { background: true }
    },

    // ✅ STATUS TRACKING
    status: {
        type: String,
        enum: ['active', 'resolved', 'archived'],
        default: 'active',
        index: { background: true }
    },

    // ✅ EDITING TRACKING
    isEdited: {
        type: Boolean,
        default: false
    },

    editHistory: [{
        editedAt: {
            type: Date,
            default: Date.now
        },
        editedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        editedByName: String,
        originalText: String,
        reason: String
    }],

    // ✅ REPLIES/RESPONSES
    replies: [{
        replyText: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },
        repliedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        repliedByName: {
            type: String,
            required: true
        },
        repliedByRole: {
            type: String,
            required: true
        },
        repliedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // ✅ ATTACHMENTS (if needed)
    attachments: [{
        fileName: String,
        fileType: String,
        fileSize: Number,
        fileUrl: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // ✅ TAGS FOR ORGANIZATION
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],

    // ✅ WORKFLOW INTEGRATION
    relatedToWorkflowStatus: String, // The workflow status when note was created

    // ✅ RESOLUTION TRACKING
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    resolvedByName: String,
    resolutionNote: String

}, {
    timestamps: true,
    collection: 'studynotes'
});

// ✅ INDEXES FOR PERFORMANCE
StudyNotesSchema.index({ studyId: 1, createdAt: -1 }, { 
    name: 'study_notes_timeline',
    background: true 
});

StudyNotesSchema.index({ noteType: 1, priority: 1, status: 1 }, { 
    name: 'notes_filtering',
    background: true 
});

StudyNotesSchema.index({ createdBy: 1, createdAt: -1 }, { 
    name: 'user_notes_history',
    background: true 
});

StudyNotesSchema.index({ visibility: 1, createdByRole: 1 }, { 
    name: 'notes_access_control',
    background: true 
});

// ✅ STATIC METHODS
StudyNotesSchema.statics.getStudyNotes = function(studyId, userRole = 'public', limit = 50) {
    const visibilityQuery = userRole === 'admin' 
        ? {} // Admins see everything
        : { 
            $or: [
                { visibility: 'public' },
                { visibility: userRole === 'doctor' || userRole === 'radiologist' || userRole === 'verifier' ? 'medical' : 'none' }
            ]
        };

    return this.find({ 
        studyId,
        ...visibilityQuery 
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'fullName role')
    .lean();
};

StudyNotesSchema.statics.createNote = function(noteData) {
    const note = new this(noteData);
    return note.save();
};

// ✅ INSTANCE METHODS
StudyNotesSchema.methods.addReply = function(replyData) {
    this.replies.push(replyData);
    return this.save();
};

StudyNotesSchema.methods.markResolved = function(userId, userName, resolutionNote) {
    this.status = 'resolved';
    this.resolvedAt = new Date();
    this.resolvedBy = userId;
    this.resolvedByName = userName;
    this.resolutionNote = resolutionNote;
    return this.save();
};

StudyNotesSchema.methods.editNote = function(newText, editedBy, editedByName, reason) {
    // Store original text in edit history
    this.editHistory.push({
        editedAt: new Date(),
        editedBy,
        editedByName,
        originalText: this.noteText,
        reason
    });
    
    this.noteText = newText;
    this.isEdited = true;
    return this.save();
};

const StudyNotes = mongoose.model('StudyNotes', StudyNotesSchema);
export default StudyNotes;