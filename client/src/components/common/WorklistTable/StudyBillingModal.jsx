import React, { useState, useEffect } from 'react';
import { DollarSign, X, Check, Loader, Tag } from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

/**
 * StudyBillingModal
 * Shown to verifiers when they want to set billing for a study.
 * Fetches the lab's billing config and lets the verifier pick a service.
 */
const StudyBillingModal = ({ study, isOpen, onClose, onBillingSet }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [labConfig, setLabConfig] = useState(null);
    const [currentBilling, setCurrentBilling] = useState(null);
    const [selectedItemId, setSelectedItemId] = useState('');

    useEffect(() => {
        if (isOpen && study?._id) {
            fetchBillingOptions();
        }
    }, [isOpen, study?._id]);

    const fetchBillingOptions = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/billing/study/${study._id}/options`);
            setLabConfig(res.data.data?.labConfig || null);
            setCurrentBilling(res.data.data?.currentBilling || null);
            if (res.data.data?.currentBilling?.isBilled && res.data.data?.labConfig) {
                const existingItem = res.data.data.labConfig.billingItems?.find(
                    i => i.module === res.data.data.currentBilling.billingModule ||
                         i.module?._id === res.data.data.currentBilling.billingModule
                );
                if (existingItem) setSelectedItemId(existingItem._id);
            }
        } catch (err) {
            console.error('StudyBillingModal fetchBillingOptions error:', err);
            toast.error('Failed to load billing options');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedItemId) return toast.error('Please select a billing item');
        if (!labConfig?._id) return toast.error('Lab billing config not found');

        try {
            setSaving(true);
            const res = await api.put(`/billing/study/${study._id}`, {
                billingItemId: selectedItemId,
                labConfigId: labConfig._id,
            });
            toast.success('Billing set successfully');
            onBillingSet?.(res.data.data);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to set billing');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const activeItems = labConfig?.billingItems?.filter(i => i.isActive !== false) || [];

    const grouped = activeItems.reduce((acc, item) => {
        const key = item.modality || 'OTHER';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    const selectedItem = activeItems.find(i => i._id === selectedItemId);

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[99999] p-3">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-sm border border-gray-200 z-10">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-900 text-white rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                        <div>
                            <h2 className="text-xs font-semibold tracking-wide uppercase">Set Billing</h2>
                            <p className="text-[9px] text-gray-400 mt-0.5">
                                {study?.bharatPacsId} · {study?.patientName || study?.patientInfo?.patientName}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Current billing badge */}
                {currentBilling?.isBilled && (
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Check className="w-3 h-3 text-gray-500" />
                            <span>Current: <strong className="text-gray-900">{currentBilling.moduleName}</strong> — {currentBilling.currency} {Number(currentBilling.amount).toLocaleString()}</span>
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className="p-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    ) : !labConfig || activeItems.length === 0 ? (
                        <div className="text-center py-6 text-gray-400">
                            <DollarSign className="w-7 h-7 mx-auto mb-2 opacity-40" />
                            <p className="text-xs">No billing configured for this lab.</p>
                            <p className="text-[10px] mt-1 text-gray-300">Contact admin to set up billing modules.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-[11px] text-gray-500 font-medium">Select a billing item:</p>
                            {Object.entries(grouped).map(([modality, items]) => (
                                <div key={modality}>
                                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{modality}</div>
                                    <div className="space-y-1">
                                        {items.map(item => (
                                            <label
                                                key={item._id}
                                                className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border cursor-pointer transition-all ${
                                                    selectedItemId === item._id
                                                        ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900/10'
                                                        : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="billingItem"
                                                        value={item._id}
                                                        checked={selectedItemId === item._id}
                                                        onChange={() => setSelectedItemId(item._id)}
                                                        className="w-3 h-3 accent-gray-900"
                                                    />
                                                    <div>
                                                        <div className="text-xs font-medium text-gray-800">{item.moduleName}</div>
                                                        {item.moduleCode && (
                                                            <div className="text-[10px] text-gray-400 font-mono">{item.moduleCode}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 text-gray-700 font-semibold text-xs shrink-0">
                                                    <Tag className="w-2.5 h-2.5" />
                                                    {item.currency || 'INR'} {Number(item.price).toLocaleString()}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Summary */}
                            {selectedItem && (
                                <div className="mt-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-gray-500 font-medium">Selected:</span>
                                        <span className="text-xs font-bold text-gray-900">{selectedItem.currency || 'INR'} {Number(selectedItem.price).toLocaleString()}</span>
                                    </div>
                                    <div className="text-[11px] text-gray-500 mt-0.5">{selectedItem.moduleName}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && labConfig && activeItems.length > 0 && (
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg flex items-center justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-2.5 py-1 text-[11px] text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!selectedItemId || saving}
                            className="flex items-center gap-1 px-3 py-1 text-[11px] font-semibold bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                            {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Set Billing
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudyBillingModal;
