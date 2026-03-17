import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Search, CheckCircle, AlertCircle, SkipForward, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const MultiAssignModal = ({
    isOpen,
    onClose,
    selectedStudies = [],       // array of study objects
    availableAssignees = { radiologists: [], verifiers: [] },
    onSuccess                   // callback after successful assignment
}) => {
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [assigneeRole, setAssigneeRole] = useState('radiologist');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // show results after assign
    const searchRef = useRef(null);

    // Auto-focus search on open
    useEffect(() => {
        if (isOpen) {
            setSelectedDoctorId('');
            setSearchTerm('');
            setResult(null);
            setTimeout(() => searchRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const assigneeList = useMemo(() => {
        const list = assigneeRole === 'radiologist'
            ? availableAssignees.radiologists || []
            : availableAssignees.verifiers || [];

        if (!searchTerm.trim()) return list;
        const term = searchTerm.toLowerCase();
        return list.filter(a =>
            (a.fullName || '').toLowerCase().includes(term) ||
            (a.email || '').toLowerCase().includes(term)
        );
    }, [assigneeRole, availableAssignees, searchTerm]);

    const selectedDoctor = useMemo(() =>
        assigneeList.find(a => a._id === selectedDoctorId) ||
        (availableAssignees.radiologists || []).find(a => a._id === selectedDoctorId) ||
        (availableAssignees.verifiers || []).find(a => a._id === selectedDoctorId),
        [selectedDoctorId, assigneeList, availableAssignees]
    );

    const handleAssign = async () => {
        if (!selectedDoctorId) {
            toast.error('Please select a doctor');
            return;
        }
        if (selectedStudies.length === 0) {
            toast.error('No studies selected');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/assigner/bulk-multi-assign', {
                studyIds: selectedStudies.map(s => s._id),
                assignedToId: selectedDoctorId,
                assigneeRole,
                notes: `Bulk assigned via multi-select`
            });

            if (response.data.success) {
                setResult(response.data.data);
                toast.success(response.data.message);
                onSuccess?.(response.data.data);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign studies');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={!loading ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 overflow-hidden">

                {/* ── HEADER ── */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-700 to-blue-800 text-white">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <div>
                            <p className="text-sm font-bold leading-none">Multi-Study Assign</p>
                            <p className="text-[11px] text-blue-200 mt-0.5">
                                {selectedStudies.length} studies selected
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-1 hover:bg-blue-600 rounded transition-colors disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── RESULT VIEW ── */}
                {result ? (
                    <div className="p-4">
                        <div className="text-center mb-4">
                            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                            <p className="text-sm font-bold text-gray-800">Assignment Complete</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Assigned to <span className="font-semibold text-blue-700">{result.assigneeName}</span>
                            </p>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="text-center p-2 bg-green-50 rounded-lg border border-green-200">
                                <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
                                <p className="text-lg font-bold text-green-700">{result.successCount}</p>
                                <p className="text-[10px] text-green-600">Success</p>
                            </div>
                            <div className="text-center p-2 bg-red-50 rounded-lg border border-red-200">
                                <AlertCircle className="w-4 h-4 text-red-500 mx-auto mb-1" />
                                <p className="text-lg font-bold text-red-600">{result.failedCount}</p>
                                <p className="text-[10px] text-red-500">Failed</p>
                            </div>
                            <div className="text-center p-2 bg-amber-50 rounded-lg border border-amber-200">
                                <SkipForward className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                                <p className="text-lg font-bold text-amber-600">{result.skippedCount}</p>
                                <p className="text-[10px] text-amber-500">Skipped</p>
                            </div>
                        </div>

                        {/* Skipped details */}
                        {result.results?.skipped?.length > 0 && (
                            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-[10px] font-bold text-amber-700 mb-1">🔒 Skipped (Locked):</p>
                                {result.results.skipped.map(s => (
                                    <p key={s.studyId} className="text-[10px] text-amber-600">
                                        {s.bharatPacsId || s.studyId} — {s.reason}
                                    </p>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ── SELECTED STUDIES SUMMARY ── */}
                        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                {selectedStudies.slice(0, 8).map(s => (
                                    <span
                                        key={s._id}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-blue-200 rounded text-[10px] text-blue-700 font-mono"
                                    >
                                        {s.bharatPacsId || s._id?.slice(-6)}
                                    </span>
                                ))}
                                {selectedStudies.length > 8 && (
                                    <span className="px-1.5 py-0.5 bg-blue-200 rounded text-[10px] text-blue-800 font-bold">
                                        +{selectedStudies.length - 8} more
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── ROLE TOGGLE ── */}
                        <div className="px-4 pt-3 pb-2">
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                {['radiologist', 'verifier'].map(role => (
                                    <button
                                        key={role}
                                        onClick={() => { setAssigneeRole(role); setSelectedDoctorId(''); setSearchTerm(''); }}
                                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                                            assigneeRole === role
                                                ? 'bg-white text-blue-700 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── SEARCH ── */}
                        <div className="px-4 pb-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    placeholder={`Search ${assigneeRole}...`}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* ── DOCTOR LIST ── */}
                        <div className="mx-4 border border-gray-200 rounded-lg overflow-hidden mb-3" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                            {assigneeList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                    <User className="w-6 h-6 mb-2" />
                                    <p className="text-xs">
                                        {searchTerm ? `No match for "${searchTerm}"` : `No ${assigneeRole}s available`}
                                    </p>
                                </div>
                            ) : (
                                assigneeList.map(doctor => {
                                    const isSelected = selectedDoctorId === doctor._id;
                                    const workload = doctor.workload?.currentWorkload || 0;
                                    return (
                                        <button
                                            key={doctor._id}
                                            onClick={() => setSelectedDoctorId(isSelected ? '' : doctor._id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-gray-100 last:border-0 transition-colors ${
                                                isSelected
                                                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                                    : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                                            }`}
                                        >
                                            {/* Avatar */}
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                                isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                                            }`}>
                                                {(doctor.fullName || doctor.email || '?')[0].toUpperCase()}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                                                    {doctor.fullName || doctor.email}
                                                </p>
                                                {doctor.fullName && (
                                                    <p className="text-[10px] text-gray-400 truncate">{doctor.email}</p>
                                                )}
                                            </div>

                                            {/* Workload badge */}
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {workload > 0 && (
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                        workload > 20 ? 'bg-red-100 text-red-700' :
                                                        workload > 10 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        {workload}
                                                    </span>
                                                )}
                                                {isSelected && (
                                                    <CheckCircle className="w-4 h-4 text-blue-600" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* ── FOOTER ── */}
                        <div className="px-4 pb-4">
                            {selectedDoctor && (
                                <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                                    <CheckCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                    <p className="text-xs text-blue-700">
                                        Assign <span className="font-bold">{selectedStudies.length} studies</span> to{' '}
                                        <span className="font-bold">{selectedDoctor.fullName || selectedDoctor.email}</span>
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-200 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={loading || !selectedDoctorId}
                                    className="flex-1 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Assigning...
                                        </>
                                    ) : (
                                        <>
                                            <Users className="w-3.5 h-3.5" />
                                            Assign {selectedStudies.length} Studies
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};

export default MultiAssignModal;