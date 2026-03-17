import StudyNotes from '../models/studyNotesModel.js';
import DicomStudy from '../models/dicomStudyModel.js';
import mongoose from 'mongoose';

// ✅ GET NOTES FOR A STUDY
export const getStudyNotes = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { limit = 50, noteType, status, priority } = req.query;
        const user = req.user;

        if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid study ID is required'
            });
        }

        // Build filter query
        const filter = { studyId };
        
        if (noteType) filter.noteType = noteType;
        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        // Apply visibility rules
        if (user.role !== 'admin') {
            const medicalRoles = ['doctor', 'radiologist', 'verifier'];
            filter.$or = [
                { visibility: 'public' },
                { visibility: 'medical', $expr: { $in: [user.role, medicalRoles] } },
                { createdBy: user._id } // User can always see their own notes
            ];
        }

        const notes = await StudyNotes.find(filter)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('createdBy', 'fullName role')
            .populate('replies.repliedBy', 'fullName role')
            .lean();

        console.log(`✅ [Study Notes] Retrieved ${notes.length} notes for study: ${studyId}`);

        res.status(200).json({
            success: true,
            data: notes,
            count: notes.length
        });

    } catch (error) {
        console.error('❌ [Study Notes] Error getting notes:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving notes',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ CREATE NEW NOTE - FIXED
export const createStudyNote = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { 
            noteText, 
            noteType = 'general', 
            priority = 'normal', 
            visibility = 'public',
            tags = [] 
        } = req.body;
        const user = req.user;

        console.log('📝 [Study Notes] Creating note request:', {
            studyId,
            noteText: noteText?.substring(0, 50) + '...',
            noteType,
            priority,
            visibility,
            userRole: user.role,
            userId: user._id
        });

        if (!studyId || !mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid study ID is required'
            });
        }

        if (!noteText || !noteText.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }

        // ✅ UPDATED: Try multiple field names for studyInstanceUID
        const study = await DicomStudy.findById(studyId).select('studyInstanceUID studyInstanceUid StudyInstanceUID workflowStatus').lean();
        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        console.log('📝 [Study Notes] Found study:', {
            _id: study._id,
            studyInstanceUID: study.studyInstanceUID,
            studyInstanceUid: study.studyInstanceUid,
            StudyInstanceUID: study.StudyInstanceUID,
            workflowStatus: study.workflowStatus
        });

        // ✅ FIXED: Get studyInstanceUID from any available field
        const studyInstanceUID = study.studyInstanceUID || 
                                 study.studyInstanceUid || 
                                 study.StudyInstanceUID || 
                                 `STUDY_${studyId}`; // Fallback if none found

        const noteData = {
            studyId,
            studyInstanceUID, // ✅ ENSURED THIS IS NOT UNDEFINED
            noteText: noteText.trim(),
            noteType,
            priority,
            visibility,
            tags,
            createdBy: user._id,
            createdByName: user.fullName || user.name || 'Unknown User',
            createdByRole: user.role,
            relatedToWorkflowStatus: study.workflowStatus || 'unknown'
        };

        console.log('📝 [Study Notes] Creating note with data:', noteData);

        const note = await StudyNotes.create(noteData);
        
        // Populate the created note
        const populatedNote = await StudyNotes.findById(note._id)
            .populate('createdBy', 'fullName name role')
            .lean();

        console.log(`✅ [Study Notes] Created note for study: ${studyId} by ${user.fullName || user.name}`);

        // ✅ Ensure DicomStudy.hasStudyNotes is true so frontend can show indicator immediately
        try {
            await DicomStudy.findByIdAndUpdate(
                studyId,
                {
                    $inc: { notesCount: 1 },
                    $set: { hasStudyNotes: true }
                },
                { new: false }
            );
            console.log(`✅ [Study Notes] Marked DicomStudy ${studyId} hasStudyNotes=true, incremented notesCount`);
        } catch (updateErr) {
            console.warn(`⚠️ [Study Notes] Failed to update notesCount for ${studyId}:`, updateErr.message);
        }

        res.status(201).json({
            success: true,
            message: 'Note created successfully',
            data: populatedNote,
            meta: { studyId, hasStudyNotes: true } // short-circuit info for frontend
        });

    } catch (error) {
        console.error('❌ [Study Notes] Error creating note:', error);
        
        // ✅ IMPROVED ERROR HANDLING
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while creating note',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ ADD REPLY TO NOTE
export const addReplyToNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const { replyText } = req.body;
        const user = req.user;

        if (!noteId || !mongoose.Types.ObjectId.isValid(noteId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid note ID is required'
            });
        }

        if (!replyText || !replyText.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Reply text is required'
            });
        }

        const note = await StudyNotes.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        const replyData = {
            replyText: replyText.trim(),
            repliedBy: user._id,
            repliedByName: user.fullName,
            repliedByRole: user.role,
            repliedAt: new Date()
        };

        await note.addReply(replyData);

        const updatedNote = await StudyNotes.findById(noteId)
            .populate('createdBy', 'fullName role')
            .populate('replies.repliedBy', 'fullName role')
            .lean();

        console.log(`✅ [Study Notes] Added reply to note: ${noteId} by ${user.fullName}`);

        res.status(200).json({
            success: true,
            message: 'Reply added successfully',
            data: updatedNote
        });

    } catch (error) {
        console.error('❌ [Study Notes] Error adding reply:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while adding reply',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ UPDATE NOTE STATUS
export const updateNoteStatus = async (req, res) => {
    try {
        const { noteId } = req.params;
        const { status, resolutionNote } = req.body;
        const user = req.user;

        if (!noteId || !mongoose.Types.ObjectId.isValid(noteId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid note ID is required'
            });
        }

        const note = await StudyNotes.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Check permissions
        const canUpdate = user.role === 'admin' || note.createdBy.toString() === user._id.toString();
        if (!canUpdate) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied to update this note'
            });
        }

        if (status === 'resolved') {
            await note.markResolved(user._id, user.fullName, resolutionNote);
        } else {
            note.status = status;
            await note.save();
        }

        const updatedNote = await StudyNotes.findById(noteId)
            .populate('createdBy', 'fullName role')
            .lean();

        console.log(`✅ [Study Notes] Updated note status: ${noteId} to ${status}`);

        res.status(200).json({
            success: true,
            message: 'Note status updated successfully',
            data: updatedNote
        });

    } catch (error) {
        console.error('❌ [Study Notes] Error updating note status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating note',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ DELETE NOTE
export const deleteNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const user = req.user;

        if (!noteId || !mongoose.Types.ObjectId.isValid(noteId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid note ID is required'
            });
        }

        const note = await StudyNotes.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Check permissions - only creator or admin can delete
        const canDelete = user.role === 'admin' || note.createdBy.toString() === user._id.toString();
        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied to delete this note'
            });
        }

        await StudyNotes.findByIdAndDelete(noteId);

        // ✅ Decrement notesCount; if it hits 0, set hasStudyNotes=false
        try {
            const remainingCount = await StudyNotes.countDocuments({ studyId: note.studyId });
            await DicomStudy.findByIdAndUpdate(
                note.studyId,
                {
                    $set: {
                        notesCount: remainingCount,
                        hasStudyNotes: remainingCount > 0
                    }
                }
            );
            console.log(`✅ [Study Notes] Updated DicomStudy ${note.studyId}: notesCount=${remainingCount}, hasStudyNotes=${remainingCount > 0}`);
        } catch (updateErr) {
            console.warn(`⚠️ [Study Notes] Failed to update notesCount on delete for ${note.studyId}:`, updateErr.message);
        }

        console.log(`✅ [Study Notes] Deleted note: ${noteId} by ${user.fullName}`);

        res.status(200).json({
            success: true,
            message: 'Note deleted successfully'
        });

    } catch (error) {
        console.error('❌ [Study Notes] Error deleting note:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting note',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ EDIT NOTE
export const editNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const { noteText, reason } = req.body;
        const user = req.user;

        if (!noteId || !mongoose.Types.ObjectId.isValid(noteId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid note ID is required'
            });
        }

        if (!noteText || !noteText.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }

        const note = await StudyNotes.findById(noteId);
        if (!note) {
            return res.status(404).json({
                success: false,
                message: 'Note not found'
            });
        }

        // Check permissions
        const canEdit = user.role === 'admin' || note.createdBy.toString() === user._id.toString();
        if (!canEdit) {
            return res.status(403).json({
                success: false,
                message: 'Permission denied to edit this note'
            });
        }

        await note.editNote(noteText.trim(), user._id, user.fullName, reason);

        const updatedNote = await StudyNotes.findById(noteId)
            .populate('createdBy', 'fullName role')
            .lean();

        console.log(`✅ [Study Notes] Edited note: ${noteId} by ${user.fullName}`);

        res.status(200).json({
            success: true,
            message: 'Note edited successfully',
            data: updatedNote
        });

    } catch (error) {
        console.error('❌ [Study Notes] Error editing note:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while editing note',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};