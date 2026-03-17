import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Send, Edit, Trash2, CheckCircle, Clock, AlertTriangle, User, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../services/api'; // ✅ IMPORT API SERVICE

const StudyNotesComponent = ({ studyId, isOpen, onClose }) => {
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newNote, setNewNote] = useState({
        noteText: '',
        noteType: 'general',
        priority: 'normal',
        visibility: 'public',
        tags: ''
    });
    const [replyText, setReplyText] = useState({});
    const [showReplyBox, setShowReplyBox] = useState({});
    const [filter, setFilter] = useState({
        noteType: '',
        status: '',
        priority: ''
    });

    const { user } = useAuth();

    // ✅ FETCH NOTES - USING API SERVICE
    const fetchNotes = useCallback(async () => {
        if (!studyId) return;
        
        setLoading(true);
        try {
            const params = {};
            if (filter.noteType) params.noteType = filter.noteType;
            if (filter.status) params.status = filter.status;
            if (filter.priority) params.priority = filter.priority;

            console.log('📝 [Study Notes] Fetching notes for study:', studyId, 'with filters:', params);

            const response = await api.get(`/study-notes/study/${studyId}`, { params });

            if (response.data.success) {
                setNotes(response.data.data);
                console.log(`✅ [Study Notes] Loaded ${response.data.data.length} notes`);
            } else {
                throw new Error(response.data.message || 'Failed to fetch notes');
            }
        } catch (error) {
            console.error('❌ [Study Notes] Error fetching notes:', error);
            toast.error(error.response?.data?.message || 'Failed to load notes');
        } finally {
            setLoading(false);
        }
    }, [studyId, filter]);

    useEffect(() => {
        if (isOpen && studyId) {
            fetchNotes();
        }
    }, [isOpen, studyId, fetchNotes]);

    // ✅ CREATE NOTE - USING API SERVICE
    const handleCreateNote = async (e) => {
        e.preventDefault();
        
        if (!newNote.noteText.trim()) {
            toast.error('Please enter note text');
            return;
        }

        try {
            const tags = newNote.tags ? newNote.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            
            console.log('📝 [Study Notes] Creating note for study:', studyId);

            const response = await api.post(`/study-notes/study/${studyId}`, {
                ...newNote,
                tags
            });

            if (response.data.success) {
                setNotes(prev => [response.data.data, ...prev]);
                setNewNote({
                    noteText: '',
                    noteType: 'general',
                    priority: 'normal',
                    visibility: 'public',
                    tags: ''
                });
                toast.success('Note created successfully');
                console.log('✅ [Study Notes] Note created successfully');
            } else {
                throw new Error(response.data.message || 'Failed to create note');
            }
        } catch (error) {
            console.error('❌ [Study Notes] Error creating note:', error);
            toast.error(error.response?.data?.message || 'Failed to create note');
        }
    };

    // ✅ ADD REPLY - USING API SERVICE
    const handleAddReply = async (noteId) => {
        const reply = replyText[noteId];
        if (!reply?.trim()) {
            toast.error('Please enter reply text');
            return;
        }

        try {
            console.log('📝 [Study Notes] Adding reply to note:', noteId);

            const response = await api.post(`/study-notes/note/${noteId}/reply`, {
                replyText: reply
            });

            if (response.data.success) {
                setNotes(prev => prev.map(note => 
                    note._id === noteId ? response.data.data : note
                ));
                setReplyText(prev => ({ ...prev, [noteId]: '' }));
                setShowReplyBox(prev => ({ ...prev, [noteId]: false }));
                toast.success('Reply added successfully');
                console.log('✅ [Study Notes] Reply added successfully');
            } else {
                throw new Error(response.data.message || 'Failed to add reply');
            }
        } catch (error) {
            console.error('❌ [Study Notes] Error adding reply:', error);
            toast.error(error.response?.data?.message || 'Failed to add reply');
        }
    };

    // ✅ UPDATE STATUS - USING API SERVICE
    const handleUpdateStatus = async (noteId, status, resolutionNote = '') => {
        try {
            console.log('📝 [Study Notes] Updating note status:', noteId, 'to', status);

            const response = await api.put(`/study-notes/note/${noteId}/status`, {
                status,
                resolutionNote
            });

            if (response.data.success) {
                setNotes(prev => prev.map(note => 
                    note._id === noteId ? response.data.data : note
                ));
                toast.success('Note status updated');
                console.log('✅ [Study Notes] Status updated successfully');
            } else {
                throw new Error(response.data.message || 'Failed to update status');
            }
        } catch (error) {
            console.error('❌ [Study Notes] Error updating status:', error);
            toast.error(error.response?.data?.message || 'Failed to update status');
        }
    };

    // ✅ DELETE NOTE - USING API SERVICE
    const handleDeleteNote = async (noteId) => {
        if (!confirm('Are you sure you want to delete this note?')) return;

        try {
            console.log('📝 [Study Notes] Deleting note:', noteId);

            const response = await api.delete(`/study-notes/note/${noteId}`);

            if (response.data.success) {
                setNotes(prev => prev.filter(note => note._id !== noteId));
                toast.success('Note deleted successfully');
                console.log('✅ [Study Notes] Note deleted successfully');
            } else {
                throw new Error(response.data.message || 'Failed to delete note');
            }
        } catch (error) {
            console.error('❌ [Study Notes] Error deleting note:', error);
            toast.error(error.response?.data?.message || 'Failed to delete note');
        }
    };

    // ✅ EDIT NOTE - USING API SERVICE
    const handleEditNote = async (noteId, newText, reason = '') => {
        try {
            console.log('📝 [Study Notes] Editing note:', noteId);

            const response = await api.put(`/study-notes/note/${noteId}/edit`, {
                noteText: newText,
                reason
            });

            if (response.data.success) {
                setNotes(prev => prev.map(note => 
                    note._id === noteId ? response.data.data : note
                ));
                toast.success('Note edited successfully');
                console.log('✅ [Study Notes] Note edited successfully');
            } else {
                throw new Error(response.data.message || 'Failed to edit note');
            }
        } catch (error) {
            console.error('❌ [Study Notes] Error editing note:', error);
            toast.error(error.response?.data?.message || 'Failed to edit note');
        }
    };

    // ✅ UTILITY FUNCTIONS
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
            case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'normal': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const getTypeIcon = (noteType) => {
        switch (noteType) {
            case 'clinical': return '🩺';
            case 'technical': return '⚙️';
            case 'administrative': return '📋';
            case 'quality': return '✅';
            case 'followup': return '📅';
            case 'priority': return '⚡';
            case 'discussion': return '💬';
            case 'correction': return '✏️';
            case 'verification': return '🔍';
            default: return '📝';
        }
    };

    const canEditNote = (note) => {
        return user?.role === 'admin' || note.createdBy?._id === user?._id;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
                
                {/* ✅ HEADER */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-2">
                        <MessageSquare className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Study Notes</h2>
                        <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                            {notes.length} notes
                        </span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                

                {/* ✅ NEW NOTE FORM */}
                <div className="p-4 border-b border-gray-200">
                    <form onSubmit={handleCreateNote} className="space-y-3">
                        

                        <textarea
                            value={newNote.noteText}
                            onChange={(e) => setNewNote(prev => ({ ...prev, noteText: e.target.value }))}
                            placeholder="Enter your note here..."
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
                            rows={3}
                        />

                        <div className="flex justify-between items-center">
                            <input
                                type="text"
                                value={newNote.tags}
                                onChange={(e) => setNewNote(prev => ({ ...prev, tags: e.target.value }))}
                                placeholder="Tags (comma separated)"
                                className="text-sm border border-gray-300 rounded-md px-3 py-2 flex-1 mr-3"
                            />
                            <button 
                                type="submit"
                                className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center space-x-2"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Add Note</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* ✅ NOTES LIST */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p>No notes found for this study</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {notes.map((note) => (
                                <div key={note._id} className="bg-white border border-gray-200 rounded-lg p-4">
                                    
                                    {/* ✅ NOTE HEADER */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center space-x-3">
                                            <span className="text-lg">{getTypeIcon(note.noteType)}</span>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-medium text-gray-900">{note.createdByName}</span>
                                                    <span className="text-xs text-gray-500">({note.createdByRole})</span>
                                                    <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(note.priority)}`}>
                                                        {note.priority}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(note.createdAt).toLocaleString()}
                                                    {note.isEdited && ' (edited)'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            {/* ✅ STATUS INDICATOR */}
                                            {note.status === 'resolved' ? (
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                            ) : note.status === 'active' ? (
                                                <Clock className="h-4 w-4 text-blue-500" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 text-gray-400" />
                                            )}

                                            {/* ✅ VISIBILITY INDICATOR */}
                                            {note.visibility === 'private' ? (
                                                <EyeOff className="h-4 w-4 text-gray-400" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-gray-400" />
                                            )}

                                            {/* ✅ ACTIONS */}
                                            {canEditNote(note) && (
                                                <div className="flex space-x-1">
                                                    {note.status === 'active' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(note._id, 'resolved')}
                                                            className="text-green-600 hover:text-green-700 p-1"
                                                            title="Mark as resolved"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteNote(note._id)}
                                                        className="text-red-600 hover:text-red-700 p-1"
                                                        title="Delete note"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ✅ NOTE CONTENT */}
                                    <div className="mb-3">
                                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.noteText}</p>
                                        
                                        {/* ✅ TAGS */}
                                        {note.tags && note.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {note.tags.map((tag, index) => (
                                                    <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* ✅ REPLIES */}
                                    {note.replies && note.replies.length > 0 && (
                                        <div className="pl-4 border-l-2 border-gray-200 space-y-2 mb-3">
                                            {note.replies.map((reply, index) => (
                                                <div key={index} className="bg-gray-50 p-3 rounded-md">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-sm font-medium text-gray-700">{reply.repliedByName}</span>
                                                            <span className="text-xs text-gray-500">({reply.repliedByRole})</span>
                                                        </div>
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(reply.repliedAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-600">{reply.replyText}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ✅ REPLY BOX */}
                                    <div className="flex items-center space-x-2">
                                        {!showReplyBox[note._id] ? (
                                            <button
                                                onClick={() => setShowReplyBox(prev => ({ ...prev, [note._id]: true }))}
                                                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center space-x-1"
                                            >
                                                <MessageSquare className="h-4 w-4" />
                                                <span>Reply</span>
                                            </button>
                                        ) : (
                                            <div className="flex-1 flex space-x-2">
                                                <input
                                                    type="text"
                                                    value={replyText[note._id] || ''}
                                                    onChange={(e) => setReplyText(prev => ({ ...prev, [note._id]: e.target.value }))}
                                                    placeholder="Enter your reply..."
                                                    className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2"
                                                    onKeyPress={(e) => e.key === 'Enter' && handleAddReply(note._id)}
                                                />
                                                <button
                                                    onClick={() => handleAddReply(note._id)}
                                                    className="text-emerald-600 hover:text-emerald-700 p-2"
                                                >
                                                    <Send className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setShowReplyBox(prev => ({ ...prev, [note._id]: false }))}
                                                    className="text-gray-400 hover:text-gray-600 p-2"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudyNotesComponent;