import React, { useState, useEffect } from 'react';
import api from '../../services/api.jsx';
import toast from 'react-hot-toast';
import {
    DollarSign, Plus, Trash2, Check, Loader, ChevronDown,
    Activity, Tag, SkipForward, Save
} from 'lucide-react';

/**
 * LabBillingSetup
 * Shown after a lab is created (or from ManageLabs edit).
 * Lets admin pick billing modules and set lab-specific prices.
 *
 * Props:
 *   labId       - string, mongoose ObjectId of the lab
 *   labName     - string, display name
 *   onSaved     - callback after billing is saved
 *   onSkip      - callback to skip this step
 */
const LabBillingSetup = ({ labId, labName, onSaved, onSkip }) => {
    const [modules, setModules] = useState([]);
    const [existingConfig, setExistingConfig] = useState(null);
    const [billingItems, setBillingItems] = useState([]); // items being configured
    const [loadingModules, setLoadingModules] = useState(true);
    const [saving, setSaving] = useState(false);

    // Group available modules by modality for the dropdown
    const [groupedModules, setGroupedModules] = useState({});

    useEffect(() => {
        fetchData();
    }, [labId]);

    const fetchData = async () => {
        try {
            setLoadingModules(true);
            const [modsRes, configRes] = await Promise.all([
                api.get('/billing/modules'),
                api.get(`/billing/lab/${labId}`),
            ]);

            const mods = (modsRes.data.data || []).filter(m => m.isActive !== false);
            setModules(mods);

            // Group by modality
            const grouped = mods.reduce((acc, m) => {
                if (!acc[m.modality]) acc[m.modality] = [];
                acc[m.modality].push(m);
                return acc;
            }, {});
            setGroupedModules(grouped);

            const config = configRes.data.data;
            setExistingConfig(config);

            if (config && config.billingItems?.length > 0) {
                setBillingItems(config.billingItems.map(item => ({
                    _itemKey: item._id || `${Date.now()}-${Math.random()}`,
                    module: item.module?._id || item.module,
                    moduleName: item.moduleName,
                    moduleCode: item.moduleCode,
                    modality: item.modality,
                    price: item.price !== undefined ? String(item.price) : '',
                    currency: item.currency || 'INR',
                    isActive: item.isActive !== false,
                    notes: item.notes || '',
                })));
            }
        } catch (err) {
            console.error('LabBillingSetup fetchData error:', err);
            toast.error('Failed to load billing data');
        } finally {
            setLoadingModules(false);
        }
    };

    const addItem = (mod) => {
        // Prevent adding duplicates
        if (billingItems.some(i => i.module === mod._id)) {
            toast.error(`"${mod.name}" is already in the list`);
            return;
        }
        setBillingItems(prev => [
            ...prev,
            {
                _itemKey: `${Date.now()}-${Math.random()}`,
                module: mod._id,
                moduleName: mod.name,
                moduleCode: mod.code || '',
                modality: mod.modality,
                price: mod.defaultPrice !== null && mod.defaultPrice !== undefined ? String(mod.defaultPrice) : '',
                currency: mod.currency || 'INR',
                isActive: true,
                notes: '',
            },
        ]);
    };

    const removeItem = (key) => {
        setBillingItems(prev => prev.filter(i => i._itemKey !== key));
    };

    const updateItem = (key, field, value) => {
        setBillingItems(prev =>
            prev.map(i => i._itemKey === key ? { ...i, [field]: value } : i)
        );
    };

    const handleSave = async () => {
        // Validate prices
        for (const item of billingItems) {
            if (item.price === '' || item.price === null || item.price === undefined) {
                toast.error(`Please set a price for "${item.moduleName}"`);
                return;
            }
            if (isNaN(Number(item.price)) || Number(item.price) < 0) {
                toast.error(`Invalid price for "${item.moduleName}"`);
                return;
            }
        }

        try {
            setSaving(true);
            await api.post(`/billing/lab/${labId}`, {
                billingItems,
                currency: 'INR',
            });
            toast.success('Lab billing configuration saved!');
            onSaved?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save billing config');
        } finally {
            setSaving(false);
        }
    };

    // Modality color mapping
    const modalityColors = {
        CT: 'blue',
        MRI: 'purple',
        MR: 'purple',
        XR: 'orange',
        CR: 'orange',
        DX: 'orange',
        US: 'teal',
        MG: 'pink',
        NM: 'yellow',
        PT: 'red',
        OTHER: 'gray',
    };

    const getModalityBadge = (modality) => {
        const color = modalityColors[modality] || 'gray';
        const classes = {
            blue: 'bg-blue-100 text-blue-700',
            purple: 'bg-purple-100 text-purple-700',
            orange: 'bg-orange-100 text-orange-800',
            teal: 'bg-teal-100 text-teal-700',
            pink: 'bg-pink-100 text-pink-700',
            yellow: 'bg-yellow-100 text-yellow-800',
            red: 'bg-red-100 text-red-700',
            gray: 'bg-gray-100 text-gray-700',
        };
        return classes[color] || classes.gray;
    };

    if (loadingModules) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Info banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-emerald-900 text-sm">Configure Billing for {labName}</h3>
                        <p className="text-xs text-emerald-700 mt-0.5">
                            Select billing modules and set prices for this lab.
                            When a verifier verifies a study, they will pick from these options to bill the lab.
                        </p>
                    </div>
                </div>
            </div>

            {/* Add billing items — grouped by modality */}
            {modules.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                    <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No billing modules defined yet.</p>
                    <p className="text-xs mt-1">Go to Admin → Billing Modules to create them first.</p>
                </div>
            ) : (
                <>
                    {/* Module picker by modality */}
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Add Billing Items</p>
                        <div className="space-y-3">
                            {Object.entries(groupedModules).map(([modality, mods]) => (
                                <div key={modality} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity className="w-3.5 h-3.5 text-slate-500" />
                                        <span className="text-xs font-semibold text-slate-600 uppercase">{modality}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {mods.map(mod => {
                                            const isAdded = billingItems.some(i => i.module === mod._id);
                                            return (
                                                <button
                                                    key={mod._id}
                                                    type="button"
                                                    onClick={() => addItem(mod)}
                                                    disabled={isAdded}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                                        isAdded
                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
                                                            : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50'
                                                    }`}
                                                >
                                                    {isAdded ? (
                                                        <Check className="w-3 h-3" />
                                                    ) : (
                                                        <Plus className="w-3 h-3" />
                                                    )}
                                                    {mod.name}
                                                    {mod.defaultPrice !== null && mod.defaultPrice !== undefined && (
                                                        <span className="text-slate-400 font-normal">({mod.defaultPrice})</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Configured items table */}
                    {billingItems.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Configured Billing Items ({billingItems.length})
                            </p>
                            <div className="border border-slate-200 rounded-xl divide-y overflow-hidden">
                                {/* Header */}
                                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <div className="col-span-4">Service</div>
                                    <div className="col-span-2">Modality</div>
                                    <div className="col-span-3">Price (INR)</div>
                                    <div className="col-span-2">Active</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {billingItems.map(item => (
                                    <div key={item._itemKey} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white hover:bg-slate-50">
                                        <div className="col-span-4">
                                            <div className="text-sm font-medium text-slate-800">{item.moduleName}</div>
                                            {item.moduleCode && (
                                                <div className="text-xs text-slate-400 font-mono">{item.moduleCode}</div>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${getModalityBadge(item.modality)}`}>
                                                {item.modality}
                                            </span>
                                        </div>
                                        <div className="col-span-3">
                                            <div className="flex items-center gap-1">
                                                <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.price}
                                                    onChange={e => updateItem(item._itemKey, 'price', e.target.value)}
                                                    placeholder="0"
                                                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-emerald-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <input
                                                type="checkbox"
                                                checked={item.isActive}
                                                onChange={e => updateItem(item._itemKey, 'isActive', e.target.checked)}
                                                className="w-4 h-4 accent-emerald-500"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => removeItem(item._itemKey)}
                                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                    type="button"
                    onClick={onSkip}
                    className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 text-sm transition-colors"
                >
                    <SkipForward className="w-4 h-4" />
                    Skip for now
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || billingItems.length === 0}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Billing Config
                </button>
            </div>
        </div>
    );
};

export default LabBillingSetup;
