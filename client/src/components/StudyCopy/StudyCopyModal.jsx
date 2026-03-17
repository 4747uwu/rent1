// client/src/components/StudyCopy/StudyCopyModal.jsx

import React, { useState, useEffect } from 'react';
import { Copy, AlertTriangle, X, Search, ArrowRight, FileText, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

export const StudyCopyModal = ({
    isOpen,
    onClose,
    currentOrgName,
    onSuccess
}) => {
    const [copyAttachments, setCopyAttachments] = useState(true);
    const [copyReports, setCopyReports] = useState(true);
    const [copyNotes, setCopyNotes] = useState(true);
    const [reason, setReason] = useState('');
    const [copying, setCopying] = useState(false);
    const [bharatPacsId, setBharatPacsId] = useState('');
    const [studyInfo, setStudyInfo] = useState(null);
    const [verifyingStudy, setVerifyingStudy] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setBharatPacsId('');
            setStudyInfo(null);
            setReason('');
            setCopyAttachments(true);
            setCopyReports(true);
            setCopyNotes(true);
        }
    }, [isOpen]);

    const verifyStudy = async (bpId) => {
        if (!bpId || !bpId.trim()) {
            toast.error('Please enter a BharatPacs ID');
            return;
        }
        try {
            setVerifyingStudy(true);
            const response = await api.get(`/study-copy/verify/${bpId.trim()}`);
            if (response.data.success) {
                setStudyInfo(response.data.data);
                toast.success('Study found and verified!');
            }
        } catch (error) {
            console.error('Error verifying study:', error);
            toast.error(error.response?.data?.message || 'Study not found');
            setStudyInfo(null);
        } finally {
            setVerifyingStudy(false);
        }
    };

    const handleBharatPacsIdChange = (e) => {
        setBharatPacsId(e.target.value);
        setStudyInfo(null);
    };

    const handleVerifyStudy = () => verifyStudy(bharatPacsId);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && bharatPacsId.trim()) handleVerifyStudy();
    };

    const handleCopy = async () => {
        if (!bharatPacsId.trim()) { toast.error('Please enter a BharatPacs ID'); return; }
        if (!studyInfo) { toast.error('Please verify the study first'); return; }
        if (!reason.trim()) { toast.error('Please provide a reason for copying'); return; }

        try {
            setCopying(true);
            const response = await api.post(`/study-copy/copy/${bharatPacsId.trim()}`, {
                copyAttachments, copyReports, copyNotes, reason: reason.trim()
            });

            const { copiedItems } = response.data.data;
            toast.success(
                `✅ Study copied!\nNew BP ID: ${response.data.data.copiedStudy.bharatPacsId}\nCopied: ${copiedItems.notes} notes, ${copiedItems.reports + copiedItems.uploadedReports + copiedItems.doctorReports} reports, ${copiedItems.attachments} attachments`,
                { duration: 6000 }
            );
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error copying study:', error);
            toast.error(error.response?.data?.message || 'Failed to copy study');
        } finally {
            setCopying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[10000] p-2">
            <div className="bg-white rounded w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-300 shadow-2xl">

                {/* Header */}
                <div className="px-3 py-2 bg-gray-900 text-white flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Copy className="w-4 h-4" />
                        <div>
                            <h2 className="text-xs font-bold uppercase">Copy Study</h2>
                            <p className="text-[9px] text-gray-400 uppercase leading-tight">
                                To: {currentOrgName}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">

                    {/* Instructions */}
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[9px] text-blue-700 leading-relaxed">
                        <span className="font-bold text-blue-800">How to use:</span> Copy the BP ID from the source org → Switch to the target org → Paste below → Verify → Copy.
                    </div>

                    {/* BharatPacs ID Input */}
                    <div>
                        <label className="block text-[8px] font-bold text-gray-800 mb-1 uppercase">
                            BharatPacs ID <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                value={bharatPacsId}
                                onChange={handleBharatPacsIdChange}
                                onKeyPress={handleKeyPress}
                                placeholder="Paste BP ID here (e.g., BP-UJJ-LAB-MIEUYV1V-S3IS)"
                                className="flex-1 px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 font-mono text-[10px]"
                                disabled={verifyingStudy}
                                autoFocus
                            />
                            <button
                                onClick={handleVerifyStudy}
                                disabled={!bharatPacsId.trim() || verifyingStudy}
                                className="px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase whitespace-nowrap"
                            >
                                {verifyingStudy ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Verifying</span>
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-3 h-3" />
                                        <span>Verify</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Study Information Card */}
                    {studyInfo && (
                        <div className="p-2.5 bg-green-50 border border-green-200 rounded space-y-2">
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Copy className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-[10px] font-bold text-green-800 uppercase">Study Verified</span>
                            </div>

                            {/* Copy Direction */}
                            <div className="flex items-center justify-between p-2 bg-white rounded border border-green-200 text-[10px]">
                                <div>
                                    <p className="text-[8px] text-gray-500 uppercase font-bold">From</p>
                                    <p className="font-bold text-gray-900">{studyInfo.organizationName}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-teal-600 mx-2 flex-shrink-0" />
                                <div className="text-right">
                                    <p className="text-[8px] text-gray-500 uppercase font-bold">To</p>
                                    <p className="font-bold text-teal-700">{currentOrgName}</p>
                                </div>
                            </div>

                            {/* Study Details */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                                <div><span className="text-gray-500">BP ID:</span> <span className="font-mono font-bold text-gray-900">{studyInfo.bharatPacsId}</span></div>
                                <div><span className="text-gray-500">Patient:</span> <span className="font-bold text-gray-900">{studyInfo.patientName}</span></div>
                                <div><span className="text-gray-500">Modality:</span> <span className="font-bold text-gray-900">{studyInfo.modality}</span></div>
                                <div><span className="text-gray-500">Date:</span> <span className="font-bold text-gray-900">{new Date(studyInfo.studyDate).toLocaleDateString()}</span></div>
                                <div><span className="text-gray-500">Series/Imgs:</span> <span className="font-bold text-gray-900">{studyInfo.seriesCount}/{studyInfo.instanceCount}</span></div>
                            </div>

                            {/* Notes and Reports Count */}
                            <div className="flex items-center gap-4 pt-1.5 border-t border-green-200 text-[9px]">
                                <div className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3 text-blue-600" />
                                    <span className="text-gray-500">Notes:</span>
                                    <span className={`font-bold ${studyInfo.notesCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{studyInfo.notesCount || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <FileText className="w-3 h-3 text-purple-600" />
                                    <span className="text-gray-500">Reports:</span>
                                    <span className={`font-bold ${(studyInfo.reportsCount + studyInfo.uploadedReportsCount + studyInfo.doctorReportsCount) > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                        {(studyInfo.reportsCount || 0) + (studyInfo.uploadedReportsCount || 0) + (studyInfo.doctorReportsCount || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Warning */}
                    <div className="flex gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-[9px] text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                            <span className="font-bold">Note:</span> New BP ID generated • Independent copy • Status reset to "New" • No assignments copied.
                        </div>
                    </div>

                    {/* Copy Options */}
                    <div className="space-y-1.5">
                        <p className="text-[8px] font-bold text-gray-800 uppercase">Copy Options</p>

                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input type="checkbox" checked={copyNotes} onChange={(e) => setCopyNotes(e.target.checked)} className="w-3.5 h-3.5 text-gray-900 focus:ring-gray-900 rounded" disabled={!studyInfo} />
                            <MessageSquare className="w-3 h-3 text-blue-600" />
                            <span className={`text-[10px] font-medium ${studyInfo ? 'text-gray-700' : 'text-gray-400'}`}>
                                Copy notes {studyInfo?.notesCount > 0 && <span className="text-blue-600 text-[9px]">({studyInfo.notesCount})</span>}
                            </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input type="checkbox" checked={copyReports} onChange={(e) => setCopyReports(e.target.checked)} className="w-3.5 h-3.5 text-gray-900 focus:ring-gray-900 rounded" disabled={!studyInfo} />
                            <FileText className="w-3 h-3 text-purple-600" />
                            <span className={`text-[10px] font-medium ${studyInfo ? 'text-gray-700' : 'text-gray-400'}`}>
                                Copy reports (as draft)
                                {studyInfo && (studyInfo.reportsCount + studyInfo.uploadedReportsCount + studyInfo.doctorReportsCount) > 0 && (
                                    <span className="text-purple-600 text-[9px] ml-1">
                                        ({(studyInfo.reportsCount || 0) + (studyInfo.uploadedReportsCount || 0) + (studyInfo.doctorReportsCount || 0)})
                                    </span>
                                )}
                            </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer py-0.5">
                            <input type="checkbox" checked={copyAttachments} onChange={(e) => setCopyAttachments(e.target.checked)} className="w-3.5 h-3.5 text-gray-900 focus:ring-gray-900 rounded" disabled={!studyInfo} />
                            <span className={`text-[10px] font-medium ${studyInfo ? 'text-gray-700' : 'text-gray-400'}`}>
                                Copy attachments (S3 duplication)
                            </span>
                        </label>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-[8px] font-bold text-gray-800 mb-1 uppercase">
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            placeholder="e.g., Patient transferred, second opinion..."
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 resize-none text-[10px]"
                            maxLength={500}
                            disabled={!studyInfo}
                        />
                        <div className="text-[8px] text-gray-400 text-right">{reason.length}/500</div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-[9px] font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors uppercase"
                        disabled={copying}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCopy}
                        disabled={!studyInfo || !reason.trim() || copying}
                        className="px-4 py-1.5 text-[10px] font-bold text-white bg-gray-900 rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 uppercase"
                    >
                        {copying ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Copying...
                            </>
                        ) : (
                            <>
                                <Copy className="w-3 h-3" />
                                Copy Study
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudyCopyModal;