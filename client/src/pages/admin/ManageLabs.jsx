import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import api from '../../services/api';
import toast from 'react-hot-toast';
import LabBillingSetup from '../../components/admin/LabBillingSetup';
import {
    Building2, Edit, X, Check, Search, ChevronDown,
    ChevronUp, Users, Settings, MapPin, Phone, Mail,
    Shield, Package, ArrowLeft, Loader, Eye, EyeOff, Copy, IndianRupee
} from 'lucide-react';

const ManageLabs = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [labs, setLabs] = useState([]);
    const [filteredLabs, setFilteredLabs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedLab, setExpandedLab] = useState(null);

    const [editModal, setEditModal] = useState({ show: false, lab: null, loading: false });
    const [editForm, setEditForm] = useState({
        name: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        notes: '',
        address: { street: '', city: '', state: '', zipCode: '', country: '' },
        settings: {
            requireReportVerification: false,
            enableCompression: false,
            autoAssignStudies: false,
            defaultPriority: 'NORMAL',
            maxConcurrentStudies: 100
        }
    });

    const [showPasswords, setShowPasswords] = useState({}); // ✅ track per-staff visibility

    // ✅ BILLING
    const [billingModal, setBillingModal] = useState({ show: false, lab: null });

    useEffect(() => {
        fetchLabs();
    }, []);

    useEffect(() => {
        if (!searchTerm) return setFilteredLabs(labs);
        setFilteredLabs(labs.filter(lab =>
            lab.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lab.identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lab.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
        ));
    }, [labs, searchTerm]);

    const fetchLabs = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/labss');
            setLabs(res.data.data || []);
        } catch (error) {
            toast.error('Failed to fetch labs');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEdit = (lab) => {
        setEditForm({
            name: lab.name || '',
            contactPerson: lab.contactPerson || '',
            contactEmail: lab.contactEmail || '',
            contactPhone: lab.contactPhone || '',
            notes: lab.notes || '',
            address: {
                street: lab.address?.street || '',
                city: lab.address?.city || '',
                state: lab.address?.state || '',
                zipCode: lab.address?.zipCode || '',
                country: lab.address?.country || '',
            },
            settings: {
                requireReportVerification: lab.settings?.requireReportVerification ?? false,
                enableCompression: lab.settings?.enableCompression ?? false,
                autoAssignStudies: lab.settings?.autoAssignStudies ?? false,
                defaultPriority: lab.settings?.defaultPriority || 'NORMAL',
                maxConcurrentStudies: lab.settings?.maxConcurrentStudies || 100
            }
        });
        setEditModal({ show: true, lab, loading: false });
    };

    const handleSave = async () => {
        try {
            setEditModal(prev => ({ ...prev, loading: true }));
            await api.put(`/admin/labs/${editModal.lab._id}`, editForm);
            toast.success('Lab updated successfully!');
            setEditModal({ show: false, lab: null, loading: false });
            fetchLabs();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update lab');
            setEditModal(prev => ({ ...prev, loading: false }));
        }
    };

    const Toggle = ({ checked, onChange, color = 'teal' }) => (
        <div className="relative cursor-pointer" onClick={() => onChange(!checked)}>
            <div className={`block w-12 h-6 rounded-full transition ${checked ? `bg-${color}-500` : 'bg-gray-300'}`} />
            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-6' : ''}`} />
        </div>
    );

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <Loader className="w-8 h-8 animate-spin text-teal-500" />
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar title="Manage Labs" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Manage Labs</h1>
                                <p className="text-gray-500 text-sm mt-1">{labs.length} labs found</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, identifier, contact..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                </div>

                {/* Labs List */}
                <div className="space-y-4">
                    {filteredLabs.map(lab => (
                        <div key={lab._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">

                            {/* Lab Header Row */}
                            <div className="flex items-center justify-between p-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                        <Building2 className="w-6 h-6 text-teal-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900">{lab.name}</h3>
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                                                {lab.identifier}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                lab.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {lab.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                            {lab.contactPerson && (
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3.5 h-3.5" /> {lab.contactPerson}
                                                </span>
                                            )}
                                            {lab.contactEmail && (
                                                <span className="flex items-center gap-1">
                                                    <Mail className="w-3.5 h-3.5" /> {lab.contactEmail}
                                                </span>
                                            )}
                                            {lab.contactPhone && (
                                                <span className="flex items-center gap-1">
                                                    <Phone className="w-3.5 h-3.5" /> {lab.contactPhone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Quick Settings Badges */}
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        lab.settings?.requireReportVerification
                                            ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        <Shield className="w-3 h-3 inline mr-1" />
                                        Verification {lab.settings?.requireReportVerification ? 'ON' : 'OFF'}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        lab.settings?.enableCompression
                                            ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        <Package className="w-3 h-3 inline mr-1" />
                                        Compression {lab.settings?.enableCompression ? 'ON' : 'OFF'}
                                    </span>

                                    <button
                                        onClick={() => handleOpenEdit(lab)}
                                        className="ml-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                        title="Edit Lab"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={() => setBillingModal({ show: true, lab })}
                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                        title="Configure Billing"
                                    >
                                        <IndianRupee className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={() => setExpandedLab(expandedLab === lab._id ? null : lab._id)}
                                        className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"
                                    >
                                        {expandedLab === lab._id
                                            ? <ChevronUp className="w-4 h-4" />
                                            : <ChevronDown className="w-4 h-4" />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedLab === lab._id && (
                                <div className="border-t border-gray-100 bg-gray-50 p-5 grid grid-cols-1 md:grid-cols-3 gap-6">

                                    {/* Address */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5" /> Address
                                        </h4>
                                        {lab.address?.street || lab.address?.city ? (
                                            <div className="text-sm text-gray-700 space-y-0.5">
                                                {lab.address.street && <p>{lab.address.street}</p>}
                                                {lab.address.city && <p>{lab.address.city}{lab.address.state ? `, ${lab.address.state}` : ''}</p>}
                                                {lab.address.zipCode && <p>{lab.address.zipCode}</p>}
                                                {lab.address.country && <p>{lab.address.country}</p>}
                                            </div>
                                        ) : <p className="text-sm text-gray-400">No address provided</p>}
                                    </div>

                                    {/* Settings */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                            <Settings className="w-3.5 h-3.5" /> Settings
                                        </h4>
                                        <div className="text-sm text-gray-700 space-y-1">
                                            <p>Priority: <span className="font-medium">{lab.settings?.defaultPriority || 'NORMAL'}</span></p>
                                            <p>Max Concurrent: <span className="font-medium">{lab.settings?.maxConcurrentStudies || 100}</span></p>
                                            <p>Auto Assign: <span className="font-medium">{lab.settings?.autoAssignStudies ? 'Yes' : 'No'}</span></p>
                                        </div>
                                    </div>

                                    {/* Staff */}
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                            <Users className="w-3.5 h-3.5" /> Staff ({lab.staffUsers?.length || 0})
                                        </h4>
                                        {lab.staffUsers?.length > 0 ? (
                                            <div className="space-y-3 max-h-48 overflow-y-auto">
                                                {lab.staffUsers.map((s, i) => (
                                                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                                                        {/* Name + Role + Status */}
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
                                                            <span className="text-sm font-medium text-gray-900">{s.userId?.fullName || 'Unknown'}</span>
                                                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{s.role}</span>
                                                        </div>

                                                        {/* Email */}
                                                        {s.userId?.email && (
                                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                                <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                <span className="font-mono">{s.userId.email}</span>
                                                                <button
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(s.userId.email);
                                                                        toast.success('Email copied!');
                                                                    }}
                                                                    className="text-gray-400 hover:text-teal-600"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Password */}
                                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                                            <Shield className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                            <span className="font-mono tracking-wider">
                                                                {showPasswords[`${lab._id}-${i}`]
                                                                    ? (s.userId?.tempPassword || 'N/A')
                                                                    : '••••••••'
                                                            }
                                                            </span>
                                                            <button
                                                                onClick={() => setShowPasswords(prev => ({
                                                                    ...prev,
                                                                    [`${lab._id}-${i}`]: !prev[`${lab._id}-${i}`]
                                                                }))}
                                                                className="text-gray-400 hover:text-teal-600"
                                                            >
                                                                {showPasswords[`${lab._id}-${i}`]
                                                                    ? <EyeOff className="w-3 h-3" />
                                                                    : <Eye className="w-3 h-3" />
                                                                }
                                                            </button>
                                                            {showPasswords[`${lab._id}-${i}`] && s.userId?.tempPassword && (
                                                                <button
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(s.userId.tempPassword);
                                                                        toast.success('Password copied!');
                                                                    }}
                                                                    className="text-gray-400 hover:text-teal-600"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <p className="text-sm text-gray-400">No staff assigned</p>}
                                    </div>

                                    {/* Notes */}
                                    {lab.notes && (
                                        <div className="md:col-span-3">
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</h4>
                                            <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded p-2">{lab.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {filteredLabs.length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p>No labs found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editModal.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">

                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">Edit Lab</h3>
                                <p className="text-sm text-gray-500">{editModal.lab?.identifier}</p>
                            </div>
                            <button onClick={() => setEditModal({ show: false, lab: null, loading: false })}
                                disabled={editModal.loading} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Basic Info */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[
                                        { label: 'Lab Name', key: 'name' },
                                        { label: 'Contact Person', key: 'contactPerson' },
                                        { label: 'Contact Email', key: 'contactEmail', type: 'email' },
                                        { label: 'Contact Phone', key: 'contactPhone' },
                                    ].map(({ label, key, type = 'text' }) => (
                                        <div key={key}>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                                            <input
                                                type={type}
                                                value={editForm[key]}
                                                onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Address</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {['street', 'city', 'state', 'zipCode', 'country'].map(field => (
                                        <div key={field}>
                                            <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{field}</label>
                                            <input
                                                type="text"
                                                value={editForm.address[field]}
                                                onChange={e => setEditForm(prev => ({
                                                    ...prev,
                                                    address: { ...prev.address, [field]: e.target.value }
                                                }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Settings */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Settings</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Require Report Verification', key: 'requireReportVerification', color: 'blue' },
                                        { label: 'Enable Compression', key: 'enableCompression', color: 'purple' },
                                        { label: 'Auto Assign Studies', key: 'autoAssignStudies', color: 'teal' },
                                    ].map(({ label, key, color }) => (
                                        <div key={key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                            <span className="text-sm text-gray-700">{label}</span>
                                            <div
                                                className="relative cursor-pointer"
                                                onClick={() => setEditForm(prev => ({
                                                    ...prev,
                                                    settings: { ...prev.settings, [key]: !prev.settings[key] }
                                                }))}
                                            >
                                                <div className={`block w-12 h-6 rounded-full transition ${
                                                    editForm.settings[key] ? `bg-${color}-500` : 'bg-gray-300'
                                                }`} />
                                                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                                                    editForm.settings[key] ? 'translate-x-6' : ''
                                                }`} />
                                            </div>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Default Priority</label>
                                            <select
                                                value={editForm.settings.defaultPriority}
                                                onChange={e => setEditForm(prev => ({
                                                    ...prev,
                                                    settings: { ...prev.settings, defaultPriority: e.target.value }
                                                }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                                            >
                                                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Max Concurrent Studies</label>
                                            <input
                                                type="number"
                                                value={editForm.settings.maxConcurrentStudies}
                                                onChange={e => setEditForm(prev => ({
                                                    ...prev,
                                                    settings: { ...prev.settings, maxConcurrentStudies: parseInt(e.target.value) }
                                                }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                                <textarea
                                    rows={3}
                                    value={editForm.notes}
                                    onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 p-6 border-t sticky bottom-0 bg-white">
                            <button
                                onClick={() => setEditModal({ show: false, lab: null, loading: false })}
                                disabled={editModal.loading}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={editModal.loading}
                                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 flex items-center gap-2"
                            >
                                {editModal.loading ? (
                                    <><Loader className="w-4 h-4 animate-spin" /> Saving...</>
                                ) : (
                                    <><Check className="w-4 h-4" /> Save Changes</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ BILLING CONFIG MODAL */}
            {billingModal.show && billingModal.lab && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <IndianRupee className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Billing Configuration</h2>
                                    <p className="text-xs text-gray-500">{billingModal.lab.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setBillingModal({ show: false, lab: null })}
                                className="p-1.5 rounded-lg hover:bg-gray-100"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-5">
                            <LabBillingSetup
                                labId={billingModal.lab._id}
                                labName={billingModal.lab.name}
                                onSaved={() => {
                                    setBillingModal({ show: false, lab: null });
                                    toast.success('Billing configuration saved!');
                                }}
                                onSkip={() => setBillingModal({ show: false, lab: null })}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageLabs;