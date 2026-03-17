import React, { useState, useEffect } from 'react';
import { X, AlertCircle, RotateCcw, Users, User } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const RevertModal = ({ isOpen, onClose, study, onSuccess }) => {
    // ✅ Changed state variable to revertReason
    const [revertReason, setRevertReason] = useState('');
    const [verificationNotes, setVerificationNotes] = useState('');
    const [corrections, setCorrections] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [assignedRadiologists, setAssignedRadiologists] = useState([]);

    useEffect(() => {
        if (study) {
            const radiologists = [];
            
            if (study._assignmentInfo?.assignedDoctors && Array.isArray(study._assignmentInfo.assignedDoctors)) {
                study._assignmentInfo.assignedDoctors.forEach(doctor => {
                    radiologists.push({
                        id: doctor.id,
                        name: doctor.name,
                        email: doctor.email,
                        role: doctor.role,
                        assignedAt: doctor.assignedAt,
                        status: doctor.status,
                        isCurrent: true
                    });
                });
            } else if (study.radiologist) {
                radiologists.push({
                    id: study.assignedToIds?.[0] || 'unknown',
                    name: study.radiologist,
                    email: study.radiologistEmail,
                    role: study.radiologistRole || 'radiologist',
                    isCurrent: true
                });
            }
            
            setAssignedRadiologists(radiologists);
        }
    }, [study]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!revertReason.trim()) {
            toast.error('Please provide a reason for reverting the report');
            return;
        }

        try {
            setSubmitting(true);

           const response = await api.post(
                `/revert/studies/${study._id}`,
                {
                    revertReason:      revertReason.trim(),
                    verificationNotes: verificationNotes.trim(),
                }
            );
            
            if (response.data.success) {
                toast.success('Report reverted and sent back to radiologist(s)');
                onSuccess?.();
                onClose();
            }
        } catch (error) {
            console.error('Error reverting report:', error);
            toast.error(error.response?.data?.message || 'Failed to revert report');
        } finally {
            setSubmitting(false);
        }
    };

    const addCorrection = (section, comment, severity = 'major') => {
        setCorrections(prev => [...prev, { section, comment, severity }]);
    };

    if (!isOpen) return null;

    return (
        // ✅ COMPACT: Reduced outer padding, dark backdrop
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-2">
            {/* ✅ COMPACT: max-w-lg, sharp borders, flex-col */}
            <div className="bg-white rounded w-full max-w-lg max-h-[95vh] overflow-hidden flex flex-col border border-gray-900 shadow-2xl">
                
                {/* ✅ COMPACT HEADER: Dark theme, tiny text */}
                <div className="px-3 py-2 bg-gray-900 text-white flex items-center justify-between">
                    <div className="min-w-0 pr-2 flex-1">
                        <h2 className="text-xs font-bold uppercase truncate flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" /> Revert Report
                        </h2>
                        <p className="text-[9px] text-gray-300 mt-0 uppercase truncate leading-tight">
                            PT: {study?.patientName} | ID: {study?.bharatPacsId || study?.patientId}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                        disabled={submitting}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-3 bg-gray-50">
                    <form id="revert-form" onSubmit={handleSubmit} className="space-y-3">
                        
                        {/* ✅ COMPACT RADIOLOGIST INFO */}
                        {assignedRadiologists.length > 0 && (
                            <div className="p-2 bg-white border border-gray-200 rounded">
                                <div className="flex items-center gap-1.5 mb-1.5 border-b border-gray-100 pb-1.5">
                                    <Users className="w-3.5 h-3.5 text-gray-600" />
                                    <div className="text-[10px] font-bold text-gray-800 uppercase">
                                        {assignedRadiologists.length === 1 ? 'Assigned Radiologist' : `${assignedRadiologists.length} Assigned Radiologists`}
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    {assignedRadiologists.map((radiologist, index) => (
                                        <div key={radiologist.id || index} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded border border-gray-100">
                                            <div className="p-1 bg-gray-200 rounded">
                                                <User className="w-3 h-3 text-gray-600" />
                                            </div>
                                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                                <div className="truncate pr-2">
                                                    <div className="text-[10px] font-bold text-gray-900 uppercase truncate">
                                                        {radiologist.name}
                                                    </div>
                                                    <div className="text-[8px] text-gray-500 truncate">
                                                        {radiologist.email}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    <span className="text-[7px] font-bold px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded uppercase">
                                                        {radiologist.role || 'RAD'}
                                                    </span>
                                                    {radiologist.status && (
                                                        <span className="text-[7px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded uppercase">
                                                            {radiologist.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ✅ COMPACT WARNING MESSAGE */}
                        <div className="flex items-start gap-1.5 p-2 bg-rose-50 border border-rose-200 rounded">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                            <div className="text-[9px] text-rose-800 leading-tight">
                                <span className="font-bold uppercase text-[10px]">Status: Reverted</span><br/>
                                Study will be marked as <span className="font-bold">report_reverted</span> and returned for corrections.
                            </div>
                        </div>

                        {/* ✅ COMPACT TEXTAREAS */}
                        <div>
                            <label className="block text-[10px] font-bold text-gray-800 mb-1 uppercase">
                                Reason for Reverting <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={revertReason}
                                onChange={(e) => setRevertReason(e.target.value)}
                                rows={3}
                                maxLength={1000}
                                className="w-full px-2 py-1.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 resize-none uppercase font-medium"
                                placeholder="Explain what needs to be corrected..."
                                required
                                disabled={submitting}
                            />
                            <p className="text-[8px] text-gray-500 mt-0.5 text-right font-medium">
                                {revertReason.length}/1000
                            </p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-800 mb-1 uppercase">
                                Verification Notes (Optional)
                            </label>
                            <textarea
                                value={verificationNotes}
                                onChange={(e) => setVerificationNotes(e.target.value)}
                                rows={2}
                                maxLength={2000}
                                className="w-full px-2 py-1.5 text-[10px] border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 resize-none uppercase font-medium"
                                placeholder="Additional feedback..."
                                disabled={submitting}
                            />
                        </div>
                    </form>
                </div>

                {/* ✅ COMPACT FOOTER */}
                <div className="px-3 py-2 bg-white border-t border-gray-200 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 transition-colors uppercase"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="revert-form"
                        className="px-4 py-1.5 text-[10px] font-bold text-white bg-gray-900 border border-gray-900 rounded hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-1.5 uppercase"
                        disabled={submitting || !revertReason.trim()}
                    >
                        {submitting ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>REVERTING...</span>
                            </>
                        ) : (
                            <>
                                <RotateCcw className="w-3 h-3" />
                                <span>REVERT REPORT</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RevertModal;