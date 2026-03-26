import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, Download, Trash2, Eye, File, Image, X, Loader, Lock } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import sessionManager from '../../services/sessionManager';

export const StudyDocumentsManager = ({ studyId, isOpen, onClose, studyMeta = null }) => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const currentUser = sessionManager.getCurrentUser();
    
    const userAccountRoles = (() => {
        const roles = [];
        if (currentUser?.role) roles.push(currentUser.role);
        if (currentUser?.primaryRole) roles.push(currentUser.primaryRole);
        if (currentUser?.accountRoles && Array.isArray(currentUser.accountRoles)) {
            roles.push(...currentUser.accountRoles);
        }
        return [...new Set(roles.map(r => String(r).toLowerCase().trim()))];
    })();

    const canManageDocs = userAccountRoles.some(role => 
        ['admin', 'assignor', 'super_admin', 'lab_staff'].includes(role)
    );

    const fetchDocuments = useCallback(async () => {
        if (!studyId) return;
        setLoading(true);
        try {
            const response = await api.get(`/documents/study/${studyId}`);
            if (response.data.success) setDocuments(response.data.data);
        } catch (error) {
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    }, [studyId]);

    useEffect(() => {
        if (isOpen && studyId) fetchDocuments();
    }, [isOpen, studyId, fetchDocuments]);

    const handleFileUpload = async (files) => {
        if (!canManageDocs || !files?.[0]) return;
        const file = files[0];
        if (file.size > 5 * 1024 * 1024 * 1024) return toast.error('Max 5GB');

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', 'clinical');

        try {
            const response = await api.post(`/documents/study/${studyId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.success) {
                toast.success('Uploaded');
                fetchDocuments();
            }
        } catch (error) {
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (documentId) => {
        if (!canManageDocs || !window.confirm('Delete?')) return;
        try {
            const response = await api.delete(`/documents/${documentId}`);
            if (response.data.success) {
                toast.success('Deleted');
                fetchDocuments();
            }
        } catch (error) { toast.error('Failed'); }
    };

    const getFileIcon = (contentType) => {
        if (contentType?.startsWith('image/')) return <Image className="w-3.5 h-3.5" />;
        if (contentType === 'application/pdf') return <FileText className="w-3.5 h-3.5" />;
        return <File className="w-3.5 h-3.5" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 flex items-center justify-center p-2 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 999999 }}
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-300"
                style={{ width: '880px', maxHeight: '80vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Super Compact */}
                <div className="bg-gray-900 text-white px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-[11px] font-black uppercase tracking-widest">Documents</h2>
                        <div className="h-3 w-px bg-gray-700" />
                        <p className="text-[10px] text-gray-400 truncate font-medium uppercase">
                            {studyMeta?.patientName || 'N/A'} | ID: {studyMeta?.patientId || 'N/A'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-red-500 transition-colors rounded">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 bg-gray-50/50">
                    {/* Compact Upload Bar */}
                    {canManageDocs ? (
                        <div
                            className={`border border-dashed rounded-md p-3 text-center transition-all bg-white mb-3 ${
                                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                            }`}
                            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e.dataTransfer.files); }}
                        >
                            <div className="flex items-center justify-center gap-3">
                                <Upload className="w-4 h-4 text-gray-400" />
                                <label className="text-[10px] font-bold text-blue-600 cursor-pointer hover:underline uppercase">
                                    {uploading ? 'Uploading...' : 'Drop file or Click to Add'}
                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e.target.files)} disabled={uploading} />
                                </label>
                                <span className="text-[9px] text-gray-400 font-bold">(MAX 5GB)</span>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-100 rounded-md p-2 mb-3 flex items-center gap-2">
                            <Lock className="w-3 h-3 text-amber-500" />
                            <p className="text-[9px] font-bold text-amber-700 uppercase">Read-Only: Upload restricted</p>
                        </div>
                    )}

                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-1 mb-1">
                            <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Files ({documents.length})</h3>
                        </div>
                        
                        {loading ? (
                            <div className="py-10 flex justify-center"><Loader className="w-5 h-5 animate-spin text-blue-500" /></div>
                        ) : documents.length === 0 ? (
                            <div className="text-center py-6 text-gray-300 text-[10px] font-bold uppercase border border-dashed rounded bg-white">No attachments</div>
                        ) : (
                            <div className="grid grid-cols-1 gap-1">
                                {documents.map((doc) => (
                                    <div key={doc._id} className="flex items-center justify-between px-3 py-1.5 bg-white border border-gray-100 rounded hover:border-blue-300 transition-all group shadow-sm">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="text-gray-400">{getFileIcon(doc.contentType)}</div>
                                            <p className="text-[10px] font-bold text-gray-700 truncate uppercase" title={doc.fileName}>{doc.fileName}</p>
                                            <div className="flex items-center gap-2 text-[9px] text-gray-400 font-bold border-l pl-2 border-gray-100">
                                                <span>{formatFileSize(doc.fileSize)}</span>
                                                <span className="w-0.5 h-0.5 bg-gray-300 rounded-full" />
                                                <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => api.get(`/documents/${doc._id}/url?action=view`).then(res => setPreviewDocument({ ...doc, url: res.data.data.url }))} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => api.get(`/documents/${doc._id}/url?action=download`).then(res => window.open(res.data.data.url))} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Download"><Download className="w-3.5 h-3.5" /></button>
                                            {canManageDocs && (
                                                <button onClick={() => handleDelete(doc._id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-2 border-t bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-1 text-[10px] font-black bg-white border border-gray-200 text-gray-600 rounded hover:bg-gray-100 uppercase transition-all shadow-sm">
                        Close
                    </button>
                </div>
            </div>

            {/* Preview Layer */}
            {previewDocument && (
                <div className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[1000000]">
                    <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="px-4 py-2 bg-gray-900 text-white flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase truncate">{previewDocument.fileName}</span>
                            <button onClick={() => setPreviewDocument(null)} className="p-1 hover:bg-red-500 rounded"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 bg-black flex items-center justify-center p-4 overflow-hidden">
                           {previewDocument.contentType?.startsWith('image/') ? (
                               <img src={previewDocument.url} className="max-w-full max-h-full object-contain" alt="Preview" />
                           ) : (
                               <iframe src={previewDocument.url} className="w-full h-full border-0 bg-white" title="PDF Viewer" />
                           )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudyDocumentsManager;