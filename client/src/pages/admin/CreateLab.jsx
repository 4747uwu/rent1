import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
    ArrowLeft, 
    Building, 
    Mail, 
    Phone, 
    MapPin, 
    User,
    UserPlus,
    Eye,
    EyeOff,
    Save,
    Shield,
    Sparkles,
    Columns,
    DollarSign
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ColumnSelector from '../../components/common/ColumnSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';
import LabBillingSetup from '../../components/admin/LabBillingSetup';

const CreateLab = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [createStaffAccount, setCreateStaffAccount] = useState(true);
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [availableVerifiers, setAvailableVerifiers] = useState([]);
    const [selectedVerifiers, setSelectedVerifiers] = useState([]);

    const [createdLab, setCreatedLab] = useState(null); 
    const [showBillingStep, setShowBillingStep] = useState(false);

    // ✅ FIXED: Added missing useState declaration and object keys
    const [formData, setFormData] = useState({
        name: '',
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

    // ✅ Fetch verifiers on mount
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
        fetchVerifiers();
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
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: type === 'checkbox' ? checked : value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleCreateLab = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.contactPerson) {
            toast.error('Please fill in required fields');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/admin/admin-crud/labs', formData);

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-100 py-8 px-4">
            <div className="max-w-4xl mx-auto">
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

                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-500 rounded-xl mb-3">
                        <Building className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">Create New Lab</h1>
                </div>

                <div className="bg-white rounded-xl shadow-lg border p-6">
                    <form onSubmit={handleCreateLab} className="space-y-6">
                        {/* Lab Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input name="name" placeholder="Lab Name" onChange={handleInputChange} className="border p-2 rounded" required />
                            <input name="contactPerson" placeholder="Contact Person" onChange={handleInputChange} className="border p-2 rounded" required />
                            <input name="contactEmail" type="email" placeholder="Email" onChange={handleInputChange} className="border p-2 rounded" />
                            <input name="contactPhone" placeholder="Phone" onChange={handleInputChange} className="border p-2 rounded" />
                        </div>

                        {/* Staff Account */}
                        {createStaffAccount && (
                            <div className="bg-purple-50 p-4 rounded-lg space-y-4">
                                <h3 className="font-bold flex items-center gap-2"><UserPlus className="w-4 h-4"/> Staff Account</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input name="staffUserDetails.fullName" placeholder="Full Name" onChange={handleInputChange} className="border p-2 rounded bg-white" />
                                    <div className="flex border rounded bg-white overflow-hidden">
                                        <input value={formData.staffUserDetails.username} onChange={handleUsernameChange} className="flex-1 p-2 outline-none" placeholder="username" />
                                        <span className="p-2 bg-purple-100 text-xs flex items-center">@radivue.com</span>
                                    </div>
                                    <input name="staffUserDetails.password" type="password" placeholder="Password" onChange={handleInputChange} className="border p-2 rounded bg-white col-span-2" />
                                </div>
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold">
                            {loading ? "Processing..." : "Create Lab & Continue to Billing"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateLab;