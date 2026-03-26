import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
    ArrowLeft, Building, Mail, Phone, MapPin, User, UserPlus,
    Save, Shield, IndianRupee, Clock, Upload, FileText, X, CheckCircle, Search
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ColumnSelector from '../../components/common/ColumnSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';
import LabBillingSetup from '../../components/admin/LabBillingSetup';

const CreateLab = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const mouInputRef = useRef(null);
    const docsInputRef = useRef(null);
    
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [createStaffAccount, setCreateStaffAccount] = useState(true);
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [availableVerifiers, setAvailableVerifiers] = useState([]);
    const [selectedVerifiers, setSelectedVerifiers] = useState([]);

    const [createdLab, setCreatedLab] = useState(null); 
    const [showBillingStep, setShowBillingStep] = useState(false);

    // Billing modules
    const [billingModules, setBillingModules] = useState([]);
    const [selectedBillingModules, setSelectedBillingModules] = useState([]);
    const [billingSearch, setBillingSearch] = useState('');

    // Document uploads
    const [mouFile, setMouFile] = useState(null);
    const [supportingDocs, setSupportingDocs] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        billingName: '',
        contactPerson: '',
        contactEmail: '',
        contactPhone: '',
        address: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'India'
        },
        nightReportingTime: '',
        minimumCharges: '',
        standardCharges: '',
        emailCC: {
            clientEmail: '',
            salesPersonEmail: ''
        },
        settings: {
            autoAssignStudies: false,
            requireReportVerification: true
        },
        staffUserDetails: {
            fullName: '',
            username: '',
            password: '',
            role: 'lab_staff',
            visibleColumns: []
        }
    });

    // Fetch verifiers + billing modules on mount
    useEffect(() => {
        const fetchVerifiers = async () => {
            try {
                const response = await api.get('/admin/manage-users?role=verifier');
                if (response.data.success) {
                    setAvailableVerifiers(response.data.data || []);
                }
            } catch (error) {
                console.error("Failed to fetch verifiers", error);
            }
        };
        const fetchBillingModules = async () => {
            try {
                const res = await api.get('/billing/modules');
                setBillingModules(res.data.data || []);
            } catch (err) {
                console.error('Failed to fetch billing modules:', err);
            }
        };
        fetchVerifiers();
        fetchBillingModules();
    }, []);

    useEffect(() => {
        const defaultCols = getDefaultColumnsForRole(['lab_staff']);
        setFormData(prev => ({
            ...prev,
            staffUserDetails: {
                ...prev.staffUserDetails,
                visibleColumns: defaultCols
            }
        }));
    }, []);

    const handleUsernameChange = (e) => {
        const value = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '')
            .replace(/\s+/g, '');
        setFormData(prev => ({
            ...prev,
            staffUserDetails: {
                ...prev.staffUserDetails,
                username: value
            }
        }));
    };

    const handleColumnToggle = (columnId) => {
        setFormData(prev => {
            const current = prev.staffUserDetails.visibleColumns;
            const updated = current.includes(columnId)
                ? current.filter(c => c !== columnId)
                : [...current, columnId];
            return {
                ...prev,
                staffUserDetails: {
                    ...prev.staffUserDetails,
                    visibleColumns: updated
                }
            };
        });
    };

    const handleSelectAllColumns = (columns) => {
        setFormData(prev => ({
            ...prev,
            staffUserDetails: {
                ...prev.staffUserDetails,
                visibleColumns: columns.map(c => c.id || c)
            }
        }));
    };

    const handleClearAllColumns = () => {
        setFormData(prev => ({
            ...prev,
            staffUserDetails: {
                ...prev.staffUserDetails,
                visibleColumns: []
            }
        }));
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (name.includes('.')) {
            const parts = name.split('.');
            if (parts.length === 2) {
                const [parent, child] = parts;
                setFormData(prev => ({
                    ...prev,
                    [parent]: {
                        ...prev[parent],
                        [child]: type === 'checkbox' ? checked : value
                    }
                }));
            }
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleMouUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) {
            toast.error('MOU file must be less than 50MB');
            return;
        }
        setMouFile(file);
    };

    const handleDocsUpload = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(f => f.size <= 50 * 1024 * 1024);
        if (validFiles.length !== files.length) {
            toast.error('Some files exceed 50MB limit');
        }
        setSupportingDocs(prev => [...prev, ...validFiles]);
    };

    const removeSupportingDoc = (index) => {
        setSupportingDocs(prev => prev.filter((_, i) => i !== index));
    };

    const toggleBillingModule = (moduleId) => {
        setSelectedBillingModules(prev =>
            prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
        );
    };

    const handleCreateLab = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.contactPerson) {
            toast.error('Please fill in required fields');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/admin/admin-crud/labs', {
                ...formData,
                billingModules: selectedBillingModules
            });

            if (response.data.success) {
                const { lab } = response.data.data;
                
                // Bind verifiers if selected
                if (selectedVerifiers.length > 0) {
                    await Promise.allSettled(
                        selectedVerifiers.map(vId =>
                            api.put(`/admin/manage-users/${vId}/role-config`, {
                                roleConfig: { labAccessMode: 'selected', assignedLabs: [lab._id] }
                            })
                        )
                    );
                }

                setCreatedLab({ _id: lab._id, name: lab.name });
                setShowBillingStep(true);
                toast.success('Lab created successfully!');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create lab');
        } finally {
            setLoading(false);
        }
    };

    const isAllowed = ['admin', 'super_admin', 'group_id'].some(role => 
        currentUser?.role === role || currentUser?.accountRoles?.includes(role)
    );

    if (!isAllowed) return <div className="p-10 text-center text-red-500">Access Denied</div>;

    const filteredBillingModules = billingModules.filter(m => {
        if (m.isActive === false) return false;
        if (!billingSearch) return true;
        const s = billingSearch.toLowerCase();
        return m.name?.toLowerCase().includes(s) || m.code?.toLowerCase().includes(s) || m.modality?.toLowerCase().includes(s);
    });

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
            {/* ─── SLIM STICKY HEADER ─── */}
            <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-gray-200 flex-shrink-0 z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="font-medium">Back</span>
                </button>
                <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-teal-600" />
                    <h1 className="text-base font-bold text-gray-900">Create New Center / Hospital</h1>
                </div>
                <button
                    type="submit"
                    form="create-lab-form"
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                    <Save className="w-3.5 h-3.5" />
                    {loading ? 'Creating...' : 'Create Center'}
                </button>
            </div>

            {/* Billing Step Modal */}
            {showBillingStep && createdLab && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
                        <LabBillingSetup 
                            labId={createdLab._id} 
                            labName={createdLab.name}
                            onSaved={() => navigate('/admin/dashboard')}
                            onSkip={() => navigate('/admin/dashboard')}
                        />
                    </div>
                </div>
            )}

            {/* ─── SCROLLABLE FORM AREA ─── */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <form id="create-lab-form" onSubmit={handleCreateLab} className="max-w-5xl mx-auto">
                    {/* ═══ 3-COLUMN LAYOUT ═══ */}
                    <div className="grid grid-cols-3 gap-4">

                        {/* ═══ COLUMN 1: Basic Info + Address ═══ */}
                        <div className="space-y-4">
                            {/* Basic Info */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center gap-1.5 mb-2.5">
                                    <Building className="w-3.5 h-3.5 text-teal-600" />
                                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Basic Information</h3>
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Center Name <span className="text-red-500">*</span></label>
                                        <input name="name" placeholder="Enter center name" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" required />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Billing Name</label>
                                        <input name="billingName" placeholder="Name for invoices" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Contact Person <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <User className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                            <input name="contactPerson" placeholder="Contact person" onChange={handleInputChange} className="w-full pl-7 border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-0.5">Email</label>
                                            <input name="contactEmail" type="email" placeholder="email@center.com" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-0.5">Phone</label>
                                            <input name="contactPhone" placeholder="+91" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Night Reporting Time</label>
                                        <input name="nightReportingTime" type="time" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center gap-1.5 mb-2.5">
                                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Address</h3>
                                </div>
                                <div className="space-y-2">
                                    <input name="address.street" placeholder="Street address" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input name="address.city" placeholder="City" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                        <input name="address.state" placeholder="State" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input name="address.zipCode" placeholder="PIN Code" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                        <input name="address.country" value={formData.address.country} onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ COLUMN 2: Charges + Billing Modules + Billing Communication ═══ */}
                        <div className="space-y-4">
                            {/* Charges */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center gap-1.5 mb-2.5">
                                    <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Charges Configuration</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Minimum (₹)</label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                            <input name="minimumCharges" type="number" min="0" placeholder="0" onChange={handleInputChange} className="w-full pl-6 border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Standard (₹)</label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                            <input name="standardCharges" type="number" min="0" placeholder="0" onChange={handleInputChange} className="w-full pl-6 border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Billing Modules */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                                        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Billing Modules</h3>
                                    </div>
                                    <span className="text-[9px] text-gray-400">{selectedBillingModules.length} selected</span>
                                </div>

                                {billingModules.length === 0 ? (
                                    <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center">
                                        <p className="text-[10px] text-gray-400">No billing modules configured yet.</p>
                                        <button type="button" onClick={() => navigate('/admin/billing-modules')} className="text-[10px] text-teal-600 hover:text-teal-800 font-medium mt-1">Create Billing Modules →</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative mb-2">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search modules..."
                                                value={billingSearch}
                                                onChange={(e) => setBillingSearch(e.target.value)}
                                                className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500"
                                            />
                                        </div>
                                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                                            {filteredBillingModules.map(mod => {
                                                const isChecked = selectedBillingModules.includes(mod._id);
                                                return (
                                                    <label key={mod._id} className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${isChecked ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                                                        <input type="checkbox" checked={isChecked} onChange={() => toggleBillingModule(mod._id)} className="w-3 h-3 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-medium text-gray-800 truncate">{mod.name}</span>
                                                                {mod.code && <span className="text-[8px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded font-mono">{mod.code}</span>}
                                                                <span className="text-[8px] bg-blue-50 text-blue-600 px-1 py-0.5 rounded">{mod.modality}</span>
                                                            </div>
                                                        </div>
                                                        {mod.defaultPrice != null && (
                                                            <span className="text-[10px] text-emerald-600 font-medium flex-shrink-0">₹{Number(mod.defaultPrice).toLocaleString()}</span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Email CC */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center gap-1.5 mb-2.5">
                                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Billing & Communication</h3>
                                </div>
                                <p className="text-[10px] text-gray-400 mb-2">Email CC for invoice emails</p>
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Client Email (CC)</label>
                                        <input name="emailCC.clientEmail" type="email" placeholder="client@example.com" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-0.5">Sales Email (CC)</label>
                                        <input name="emailCC.salesPersonEmail" type="email" placeholder="sales@example.com" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ COLUMN 3: Documents + Staff Account ═══ */}
                        <div className="space-y-4">
                            {/* Documents */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center gap-1.5 mb-2.5">
                                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Documents</h3>
                                </div>
                                <div className="space-y-2">
                                    {/* MOU */}
                                    {!mouFile ? (
                                        <div className="border border-dashed border-gray-300 rounded-lg p-2.5 text-center hover:border-teal-400 transition-colors cursor-pointer" onClick={() => mouInputRef.current?.click()}>
                                            <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                            <p className="text-xs text-gray-500">Upload MOU</p>
                                            <p className="text-[9px] text-gray-400">PDF, DOC (Max 50MB)</p>
                                            <input ref={mouInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleMouUpload} />
                                        </div>
                                    ) : (
                                        <div className="border border-teal-200 bg-teal-50 rounded-lg p-2 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                                                <span className="text-xs text-teal-900 truncate max-w-[140px]">{mouFile.name}</span>
                                            </div>
                                            <button type="button" onClick={() => { setMouFile(null); if(mouInputRef.current) mouInputRef.current.value = ''; }} className="text-teal-600 hover:text-teal-800">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Supporting Docs */}
                                    <div className="border border-dashed border-gray-300 rounded-lg p-2.5 text-center hover:border-teal-400 transition-colors cursor-pointer" onClick={() => docsInputRef.current?.click()}>
                                        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                        <p className="text-xs text-gray-500">Other Documents</p>
                                        <p className="text-[9px] text-gray-400">Multiple files (Max 50MB each)</p>
                                        <input ref={docsInputRef} type="file" multiple className="hidden" onChange={handleDocsUpload} />
                                    </div>
                                    {supportingDocs.length > 0 && (
                                        <div className="space-y-1">
                                            {supportingDocs.map((doc, i) => (
                                                <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-2 py-1">
                                                    <span className="text-[10px] text-gray-700 truncate max-w-[160px]">{doc.name}</span>
                                                    <button type="button" onClick={() => removeSupportingDoc(i)} className="text-red-400 hover:text-red-600">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Staff Account */}
                            {createStaffAccount && (
                                <div className="bg-purple-50 rounded-lg border border-purple-200 p-3">
                                    <div className="flex items-center gap-1.5 mb-2.5">
                                        <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                                        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Staff Account</h3>
                                    </div>
                                    <div className="space-y-2">
                                        <input name="staffUserDetails.fullName" placeholder="Full Name" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
                                        <div className="flex border border-gray-300 rounded-md bg-white overflow-hidden focus-within:ring-1 focus-within:ring-purple-500">
                                            <input value={formData.staffUserDetails.username} onChange={handleUsernameChange} className="flex-1 px-2 py-1.5 outline-none border-none text-sm" placeholder="username" />
                                            <span className="px-2 py-1.5 bg-purple-100 text-[10px] flex items-center font-medium text-purple-600">@radivue.com</span>
                                        </div>
                                        <input name="staffUserDetails.password" type="password" placeholder="Password" onChange={handleInputChange} className="w-full border border-gray-300 px-2 py-1.5 rounded-md text-sm bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
                                    </div>
                                </div>
                            )}

                            {/* Settings */}
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center gap-1.5 mb-2.5">
                                    <Shield className="w-3.5 h-3.5 text-teal-600" />
                                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Settings</h3>
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" name="settings.requireReportVerification" checked={formData.settings.requireReportVerification} onChange={handleInputChange} className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                        <span className="text-xs text-gray-700">Require Report Verification</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" name="settings.autoAssignStudies" checked={formData.settings.autoAssignStudies} onChange={handleInputChange} className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                        <span className="text-xs text-gray-700">Auto-assign Studies</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateLab;