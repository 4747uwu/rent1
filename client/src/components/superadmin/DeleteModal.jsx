import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const DeleteStudyModal = ({ 
    isOpen, 
    onClose, 
    studies = [], 
    onSuccess
}) => {
    const [loading, setLoading] = useState(false);
    const [reason, setReason] = useState('');

    const isBulkDelete = Array.isArray(studies) && studies.length > 1;
    const studyCount = Array.isArray(studies) ? studies.length : 1;
    const firstStudy = Array.isArray(studies) ? studies[0] : studies;

    const handleDelete = async () => {
        if (!reason.trim()) {
            toast.error('Please provide a reason for deletion');
            return;
        }

        setLoading(true);
        try {
            if (isBulkDelete) {
                const studyIds = studies.map(s => s._id);
                const response = await api.post('/admin/studies/bulk-delete', {
                    studyIds,
                    reason
                });

                if (response.data.success) {
                    toast.success(`✅ ${response.data.data.successful.length} study(ies) deleted successfully`, {
                        duration: 4000
                    });

                    if (response.data.data.failed.length > 0) {
                        toast.error(`⚠️ Failed to delete ${response.data.data.failed.length} study(ies)`, { duration: 3000 });
                    }

                    onSuccess?.(); // ✅ onSuccess handles clearing selection + refresh
                    onClose();
                }
            } else {
                const response = await api.delete(`/admin/studies/${firstStudy._id}`, {
                    data: { reason }
                });

                if (response.data.success) {
                    toast.success(`✅ Study "${firstStudy.bharatPacsId}" deleted successfully`, { duration: 3000 });
                    onSuccess?.(); // ✅ onSuccess handles clearing selection + refresh
                    onClose();
                }
            }
        } catch (error) {
            console.error('❌ Delete error:', error);
            toast.error(
                error.response?.data?.message || 'Failed to delete study(ies)',
                { duration: 3000 }
            );
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border-2 border-red-200">
                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-500 p-2 rounded-lg">
                            <Trash2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Delete Study</h2>
                            <p className="text-xs text-red-100 mt-0.5">
                                This action cannot be undone
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-1 hover:bg-red-600 rounded transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* BODY */}
                <div className="p-6 space-y-4">
                    {/* WARNING ICON */}
                    <div className="flex items-center justify-center">
                        <div className="bg-red-50 p-4 rounded-full">
                            <AlertTriangle className="w-10 h-10 text-red-600" />
                        </div>
                    </div>

                    {/* WARNING MESSAGE */}
                    <div className="text-center">
                        <h3 className="font-bold text-gray-900 mb-2">
                            {isBulkDelete
                                ? `Delete ${studyCount} Studies?`
                                : 'Delete This Study?'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                            You are about to permanently delete:
                        </p>

                        {/* STUDY LIST */}
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                            {isBulkDelete ? (
                                <div className="space-y-2 text-left">
                                    {studies.slice(0, 3).map((study, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-red-600 rounded-full flex-shrink-0" />
                                            <div className="text-xs text-gray-700">
                                                <span className="font-semibold">{study.bharatPacsId}</span>
                                                <span className="text-gray-600"> • {study.patientName}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {studies.length > 3 && (
                                        <div className="text-xs text-red-600 font-semibold pl-4">
                                            +{studies.length - 3} more...
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-gray-900">
                                        {firstStudy.bharatPacsId}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                        Patient: {firstStudy.patientName}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        Modality: {firstStudy.modality}
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-red-700 font-semibold bg-red-50 p-2 rounded">
                            ⚠️ All associated data (reports, attachments, notes) will also be deleted.
                        </p>
                    </div>

                    {/* REASON TEXTAREA */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Reason for Deletion <span className="text-red-600">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain why you are deleting this study..."
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                            rows={3}
                            disabled={loading}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This reason will be logged for audit purposes.
                        </p>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2 text-sm font-bold bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={loading || !reason.trim()}
                        className="flex-1 px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader className="w-4 h-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Delete {isBulkDelete ? `${studyCount} Studies` : 'Study'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteStudyModal;