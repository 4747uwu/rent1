import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, Download, Trash2, Eye, File, Image, X, Loader, Lock } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import sessionManager from '../../services/sessionManager';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// PDF.js worker — use the bundled worker from node_modules (CDN doesn't have v5.6.205)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ── Thumbnail cache: avoid re-fetching presigned URLs / rendered pages
const thumbnailCache = new Map();

export const StudyDocumentsManager = ({ studyId, isOpen, onClose, studyMeta = null }) => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
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
        if (file.size > 10 * 1024 * 1024) return toast.error('Max 10MB');

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

    // ── Thumbnail component — large preview for images AND PDFs ─────────────
    const THUMB_W = 'w-full max-w-[280px]';
    const THUMB_H = 'h-72';   // ~288px tall

    const DocThumbnail = ({ doc }) => {
        const [thumbUrl, setThumbUrl] = useState(null);
        const [thumbError, setThumbError] = useState(false);
        const canvasRef = useRef(null);

        useEffect(() => {
            const isImage = doc?.contentType?.startsWith('image/');
            const isPdf = doc?.contentType === 'application/pdf';
            if (!isImage && !isPdf) return;

            // Check cache first
            const cached = thumbnailCache.get(doc._id);
            if (cached) { setThumbUrl(cached); return; }

            let cancelled = false;

            api.get(`/documents/${doc._id}/url?action=view`)
                .then(async (res) => {
                    if (cancelled) return;
                    const url = res.data.data.url;

                    if (isImage) {
                        thumbnailCache.set(doc._id, url);
                        setThumbUrl(url);
                    } else if (isPdf) {
                        // Render first page of the PDF onto a canvas, then convert to dataURL
                        try {
                            const pdf = await pdfjsLib.getDocument(url).promise;
                            const page = await pdf.getPage(1);
                            const viewport = page.getViewport({ scale: 1.0 });

                            const canvas = document.createElement('canvas');
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            const ctx = canvas.getContext('2d');

                            await page.render({ canvasContext: ctx, viewport }).promise;

                            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            thumbnailCache.set(doc._id, dataUrl);
                            if (!cancelled) setThumbUrl(dataUrl);
                        } catch (e) {
                            console.warn('[PDF Thumbnail] Failed:', e.message);
                            if (!cancelled) setThumbError(true);
                        }
                    }
                })
                .catch(() => { if (!cancelled) setThumbError(true); });

            return () => { cancelled = true; };
        }, [doc._id, doc.contentType]);

        const placeholder = (icon, bgClass = 'bg-gray-100') => (
            <div className={`${THUMB_W} ${THUMB_H} ${bgClass} rounded-lg flex items-center justify-center`}>
                {icon}
            </div>
        );

        // Image thumbnail
        if (doc.contentType?.startsWith('image/')) {
            if (thumbError) return placeholder(<Image className="w-8 h-8 text-gray-300" />);
            if (!thumbUrl) return placeholder(<Loader className="w-5 h-5 text-gray-300 animate-spin" />, 'bg-gray-50 animate-pulse');
            return (
                <img src={thumbUrl} alt=""
                    className={`${THUMB_W} ${THUMB_H} rounded-lg object-contain bg-gray-50 border border-gray-200 cursor-pointer hover:opacity-90 hover:shadow-lg transition-all`}
                    onClick={() => handlePreview(doc)} />
            );
        }

        // PDF thumbnail (rendered first page)
        if (doc.contentType === 'application/pdf') {
            if (thumbError) return placeholder(<FileText className="w-10 h-10 text-red-300" />, 'bg-red-50 border border-red-100');
            if (!thumbUrl) return placeholder(<Loader className="w-5 h-5 text-red-300 animate-spin" />, 'bg-red-50 animate-pulse border border-red-100');
            return (
                <img src={thumbUrl} alt="PDF page 1"
                    className={`${THUMB_W} ${THUMB_H} rounded-lg object-contain bg-white border border-gray-200 cursor-pointer hover:opacity-90 hover:shadow-lg transition-all`}
                    onClick={() => handlePreview(doc)} />
            );
        }

        // Other files
        return placeholder(<File className="w-10 h-10 text-gray-300" />, 'bg-gray-50 border border-gray-100');
    };

    const handlePreview = async (doc) => {
        try {
            setPreviewLoading(true);
            setPreviewDocument(doc);
            const res = await api.get(`/documents/${doc._id}/url?action=view`);
            const presignedUrl = res.data.data.url;

            if (doc.contentType?.startsWith('image/')) {
                setPreviewBlobUrl(presignedUrl);
            } else {
                const response = await fetch(presignedUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                setPreviewBlobUrl(blobUrl);
            }
        } catch (error) {
            toast.error('Failed to load preview');
            setPreviewDocument(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        if (previewBlobUrl && !previewDocument?.contentType?.startsWith('image/')) {
            URL.revokeObjectURL(previewBlobUrl);
        }
        setPreviewDocument(null);
        setPreviewBlobUrl(null);
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
                style={{ width: '95vw', maxWidth: '1200px', height: '90vh' }}
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
                                <span className="text-[9px] text-gray-400 font-bold">(MAX 10MB)</span>
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
                            <div className="grid grid-cols-2 gap-3">
                                {documents.map((doc) => (
                                    <div key={doc._id} className="bg-white border border-gray-100 rounded-lg hover:border-blue-300 hover:shadow-md transition-all group shadow-sm overflow-hidden">
                                        {/* Thumbnail */}
                                        <div className="flex justify-center bg-gray-50 p-2">
                                            <DocThumbnail doc={doc} />
                                        </div>
                                        {/* Info + actions */}
                                        <div className="px-3 py-2 border-t border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-700 truncate uppercase" title={doc.fileName}>{doc.fileName}</p>
                                            <div className="flex items-center gap-2 text-[9px] text-gray-400 font-bold mt-0.5">
                                                <span>{formatFileSize(doc.fileSize)}</span>
                                                <span className="w-0.5 h-0.5 bg-gray-300 rounded-full" />
                                                <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                                <span className="w-0.5 h-0.5 bg-gray-300 rounded-full" />
                                                <span className="text-gray-300">{doc.contentType?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <button onClick={() => handlePreview(doc)} className="flex-1 flex items-center justify-center gap-1 py-1 text-[9px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors">
                                                    <Eye className="w-3 h-3" /> View
                                                </button>
                                                <button onClick={() => api.get(`/documents/${doc._id}/url?action=download`).then(res => window.open(res.data.data.url))} className="flex-1 flex items-center justify-center gap-1 py-1 text-[9px] font-bold text-green-600 bg-green-50 hover:bg-green-100 rounded transition-colors">
                                                    <Download className="w-3 h-3" /> Download
                                                </button>
                                                {canManageDocs && (
                                                    <button onClick={() => handleDelete(doc._id)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
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
                            <button onClick={closePreview} className="p-1 hover:bg-red-500 rounded"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 bg-black flex items-center justify-center p-4 overflow-hidden">
                           {previewLoading ? (
                               <Loader className="w-6 h-6 animate-spin text-white" />
                           ) : previewBlobUrl ? (
                               previewDocument.contentType?.startsWith('image/') ? (
                                   <img src={previewBlobUrl} className="max-w-full max-h-full object-contain" alt="Preview" />
                               ) : (
                                   <iframe src={previewBlobUrl} className="w-full h-full border-0 bg-white" title="PDF Viewer" />
                               )
                           ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudyDocumentsManager;