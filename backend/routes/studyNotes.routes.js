import express from 'express';
// import { authenticateToken } from '../middleware/auth.middleware.js';
import {
    getStudyNotes,
    createStudyNote,
    addReplyToNote,
    updateNoteStatus,
    deleteNote,
    editNote
} from '../controllers/studyNotes.controller.js';
import { protect } from '../middleware/authMiddleware.js';


const router = express.Router();

// ✅ APPLY AUTHENTICATION TO ALL ROUTES
router.use(protect);

// ✅ STUDY NOTES ROUTES
router.get('/study/:studyId', getStudyNotes);              // GET /api/study-notes/study/:studyId
router.post('/study/:studyId', createStudyNote);           // POST /api/study-notes/study/:studyId
router.post('/note/:noteId/reply', addReplyToNote);        // POST /api/study-notes/note/:noteId/reply
router.put('/note/:noteId/status', updateNoteStatus);      // PUT /api/study-notes/note/:noteId/status
router.put('/note/:noteId/edit', editNote);                // PUT /api/study-notes/note/:noteId/edit
router.delete('/note/:noteId', deleteNote);                // DELETE /api/study-notes/note/:noteId

export default router;