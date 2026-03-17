import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import api from '../../services/api.jsx';
import toast from 'react-hot-toast';
import {
    Plus, Edit2, Trash2, X, Check, Search,
    DollarSign, Activity, ArrowLeft, Loader, Tag
} from 'lucide-react';

const MODALITIES = ['CT', 'MRI', 'MR', 'XR', 'CR', 'DX', 'US', 'MG', 'NM', 'PT', 'RF', 'OT', 'OTHER'];

const emptyForm = {
    name: '',
    code: '',
    description: '',
    modality: 'CT',
    defaultPrice: '',
    currency: 'INR',
};

const BillingModules = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalityFilter, setModalityFilter] = useState('ALL');

    const [showModal, setShowModal] = useState(false);
    const [editingModule, setEditingModule] = useState(null); // null = create mode
    const [formData, setFormData] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        fetchModules();
    }, []);

    const fetchModules = async () => {
        try {
            setLoading(true);
            const res = await api.get('/billing/modules');
            setModules(res.data.data || []);
        } catch {
            toast.error('Failed to fetch billing modules');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditingModule(null);
        setFormData(emptyForm);
        setShowModal(true);
    };

    const openEdit = (mod) => {
        setEditingModule(mod);
        setFormData({
            name: mod.name || '',
            code: mod.code || '',
            description: mod.description || '',
            modality: mod.modality || 'CT',
            defaultPrice: mod.defaultPrice !== null && mod.defaultPrice !== undefined ? String(mod.defaultPrice) : '',
            currency: mod.currency || 'INR',
            isActive: mod.isActive !== false,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return toast.error('Module name is required');
        if (!formData.modality) return toast.error('Modality is required');

        try {
            setSaving(true);
            const payload = {
                ...formData,
                defaultPrice: formData.defaultPrice !== '' ? Number(formData.defaultPrice) : null,
            };

            if (editingModule) {
                await api.put(`/billing/modules/${editingModule._id}`, payload);
                toast.success('Billing module updated');
            } else {
                await api.post('/billing/modules', payload);
                toast.success('Billing module created');
            }

            setShowModal(false);
            fetchModules();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save billing module');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (mod) => {
        try {
            await api.delete(`/billing/modules/${mod._id}`);
            toast.success('Billing module deleted');
            setDeleteConfirm(null);
            fetchModules();
        } catch {
            toast.error('Failed to delete billing module');
        }
    };

    const filtered = modules.filter(m => {
        const matchesSearch =
            !searchTerm ||
            m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesModality = modalityFilter === 'ALL' || m.modality === modalityFilter;
        return matchesSearch && matchesModality;
    });

    // Group by modality for display
    const grouped = filtered.reduce((acc, m) => {
        if (!acc[m.modality]) acc[m.modality] = [];
        acc[m.modality].push(m);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <DollarSign className="w-6 h-6 text-emerald-600" />
                                Billing Modules
                            </h1>
                            <p className="text-gray-500 text-sm mt-0.5">
                                Define billing service items (e.g. CT Head, MRI Brain). Labs use these to set their prices.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Module
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search modules..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 shadow-sm"
                        />
                    </div>
                    <select
                        value={modalityFilter}
                        onChange={e => setModalityFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 shadow-sm"
                    >
                        <option value="ALL">All Modalities</option>
                        {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader className="w-8 h-8 animate-spin text-emerald-500" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-lg text-gray-500">No billing modules found</p>
                        <p className="text-sm mt-1 text-gray-400">Create your first billing module to get started</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(grouped).map(([modality, items]) => (
                            <div key={modality}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Activity className="w-4 h-4 text-blue-500" />
                                    <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider">{modality}</h2>
                                    <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">{items.length}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {items.map(mod => (
                                        <div
                                            key={mod._id}
                                            className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${
                                                mod.isActive ? 'border-gray-200 hover:border-gray-300 hover:shadow-md' : 'border-gray-100 opacity-60'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-semibold text-gray-900 truncate">{mod.name}</h3>
                                                        {mod.code && (
                                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                                                                {mod.code}
                                                            </span>
                                                        )}
                                                        {!mod.isActive && (
                                                            <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded">Inactive</span>
                                                        )}
                                                    </div>
                                                    {mod.description && (
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{mod.description}</p>
                                                    )}
                                                    <div className="mt-2 flex items-center gap-1 text-emerald-600 font-medium">
                                                        <Tag className="w-3.5 h-3.5" />
                                                        {mod.defaultPrice !== null && mod.defaultPrice !== undefined
                                                            ? `${mod.currency || 'INR'} ${Number(mod.defaultPrice).toLocaleString()}`
                                                            : <span className="text-gray-400 text-xs font-normal">No default price</span>
                                                        }
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 ml-2 shrink-0">
                                                    <button
                                                        onClick={() => openEdit(mod)}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteConfirm(mod)}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">
                                {editingModule ? 'Edit Billing Module' : 'New Billing Module'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Module Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. CT Head, MRI Brain"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Code (optional)</label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. CT_HEAD"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Modality <span className="text-red-500">*</span></label>
                                    <select
                                        value={formData.modality}
                                        onChange={e => setFormData(p => ({ ...p, modality: e.target.value }))}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                                    >
                                        {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Brief description of this service"
                                    rows={2}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Default Price (optional)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.defaultPrice}
                                        onChange={e => setFormData(p => ({ ...p, defaultPrice: e.target.value }))}
                                        placeholder="Leave blank = no default"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                                    <input
                                        type="text"
                                        value={formData.currency}
                                        onChange={e => setFormData(p => ({ ...p, currency: e.target.value.toUpperCase() }))}
                                        placeholder="INR"
                                        maxLength={5}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                            {editingModule && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={formData.isActive !== false}
                                        onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                                        className="w-4 h-4 rounded accent-emerald-500"
                                    />
                                    <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {editingModule ? 'Save Changes' : 'Create Module'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-red-200 rounded-2xl w-full max-w-sm shadow-2xl p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Billing Module</h2>
                        <p className="text-gray-500 text-sm mb-6">
                            Are you sure you want to delete <span className="text-gray-900 font-medium">"{deleteConfirm.name}"</span>?
                            This cannot be undone. Lab billing configs referencing this module will retain the data.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingModules;
