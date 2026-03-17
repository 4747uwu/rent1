import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
    ArrowLeft, 
    UserPlus, 
    Mail, 
    Lock, 
    User, 
    Users,
    Shield,
    Settings,
    CheckCircle,
    ChevronRight,
    ChevronLeft,
    Save,
    Eye,
    EyeOff,
    Sparkles,
    Crown,
    Zap,
    Star,
    CrownIcon,
    Columns,
    Building2,
    Stethoscope,  // ✅ ADD THIS
    Phone,        // ✅ ADD THIS
    Award,        // ✅ ADD THIS
    Upload,       // ✅ ADD THIS
    Image,        // ✅ ADD THIS
    X,            // ✅ ADD THIS
    AlertCircle   // ✅ ADD THIS (if not already there)
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ✅ IMPORT NEW COMPONENTS
import ColumnSelector from '../../components/common/ColumnSelector';
import MultiAccountRoleSelector from '../../components/admin/MultiAccountRoleSelector';
import LabSelector from '../../components/common/LabSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';
// import api from '../../services/api';
import sessionManager from '../../services/sessionManager'; // ✅ ADD THIS
// import toast from 'react-hot-toast';

const CreateUser = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // State management
    const [loading, setLoading] = useState(false);
    const [availableRoles, setAvailableRoles] = useState({});
    const [users, setUsers] = useState([]);
    const [showPassword, setShowPassword] = useState(false);

    // ✅ NEW: Signature image state for radiologist
const fileInputRef = useRef(null);
const [signatureImage, setSignatureImage] = useState(null);
const [signaturePreview, setSignaturePreview] = useState(null);
    
    // Form data
    const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    username: '',
    role: '',
    organizationType: 'teleradiology_company',
    // ✅ NEW: Three feature fields
    visibleColumns: [],
    accountRoles: [],
    primaryRole: '',
    linkedLabs: [],
    requireReportVerification: true,
    // ✅ NEW: Radiologist-specific fields
    specialization: '',
    licenseNumber: '',
    department: '',
    qualifications: [],
    yearsOfExperience: '',
    contactPhoneOffice: ''
});
    
    // Role-specific configuration
    const [roleConfig, setRoleConfig] = useState({
        linkedRadiologist: '',
        assignedRadiologists: [],   // ✅ for verifier - doctor binding
        assignedLabs: [],            // ✅ for verifier/assignor - lab binding
        labAccessMode: 'all',        // ✅ for verifier/assignor - 'all' | 'selected' | 'none'
        assignableUsers: [],
        allowedPatients: [],
        dashboardAccess: {
            viewWorkload: false,
            viewTAT: false,
            viewRevenue: false,
            viewReports: false
        }
    });

    // ✅ NEW: State for multi-role setup
    const [useMultiRole, setUseMultiRole] = useState(false);

    // Fetch available roles on component mount
    useEffect(() => {
        fetchAvailableRoles();
        fetchUsers();
    }, []);

    // ✅ REMOVED: Auto-updating columns useEffect that was causing issues
    // Columns will be set by ColumnSelector component itself

    // ✅ FIXED: Only sync when toggle changes, not when roles change
    useEffect(() => {
        if (!useMultiRole && formData.role) {
            // When switching from multi to single, sync accountRoles
            setFormData(prev => ({
                ...prev,
                accountRoles: [formData.role],
                primaryRole: formData.role
            }));
        }
    }, [useMultiRole]); // ✅ Only depend on useMultiRole toggle

    const fetchAvailableRoles = async () => {
        try {
            setLoading(true);
            
            // ✅ Fetch roles
            const endpoint = currentUser?.role === 'admin' 
                ? '/admin/user-management/available-roles'
                : '/group/user-management/available-roles';
                
            const response = await api.get(endpoint);
            console.log('Roles response:', response);
            
            if (response.data.success) {
                let rolesData = response.data.data;
                
                // ✅ NEW: Fetch labs for the organization using api service
                try {
                    const labsResponse = await api.get('/admin/labs');
                    console.log('Labs response:', labsResponse);
                    
                    if (labsResponse.data.success) {
                        // ✅ FIXED: Ensure rolesData is an object before adding labs
                        if (typeof rolesData !== 'object' || Array.isArray(rolesData)) {
                            rolesData = { roles: rolesData };
                        }
                        
                        // ✅ Add labs to the rolesData object
                        rolesData.labs = labsResponse.data.data || [];
                        
                        console.log('✅ Labs added to rolesData:', {
                            labsCount: rolesData.labs?.length || 0,
                            labs: rolesData.labs
                        });
                    }
                } catch (labError) {
                    console.error('❌ Error fetching labs:', labError);
                    // ✅ Ensure rolesData has labs property even if fetch fails
                    if (typeof rolesData !== 'object' || Array.isArray(rolesData)) {
                        rolesData = { roles: rolesData, labs: [] };
                    } else {
                        rolesData.labs = [];
                    }
                }
                
                setAvailableRoles(rolesData);
                
                console.log('✅ Available roles and labs set:', {
                    rolesDataStructure: Object.keys(rolesData),
                    hasLabs: 'labs' in rolesData,
                    labsCount: rolesData.labs?.length || 0,
                    fullData: rolesData
                });
            }
        } catch (error) {
            console.error('❌ Error fetching available roles:', error);
            
            // ✅ FALLBACK: If API fails, provide default roles based on user type
            const defaultRoles = currentUser?.role === 'admin' 
                ? {
                    labs: [], // ✅ Include empty labs array in fallback
                    group_id: {
                        name: 'Group ID',
                        description: 'Create and manage other user roles including Assignor, Radiologist, Verifier, etc.'
                    },
                    assignor: {
                        name: 'Assignor',
                        description: 'Assign cases to radiologists and verifiers, manage workload distribution'
                    },
                    radiologist: {
                        name: 'Radiologist',
                        description: 'View cases in DICOM viewer, create reports, forward to verifier'
                    },
                    verifier: {
                        name: 'Verifier',
                        description: 'Review radiologist reports, correct errors, finalize and approve reports'
                    },
                    physician: {
                        name: 'Physician / Referral Doctor',
                        description: 'View reports of referred patients, limited download/share access'
                    },
                    receptionist: {
                        name: 'Receptionist',
                        description: 'Register patients, print reports, update patient demographic details'
                    },
                    billing: {
                        name: 'Billing Section',
                        description: 'Generate patient bills, maintain billing information linked with reports'
                    },
                    typist: {
                        name: 'Typist',
                        description: 'Support radiologist by typing dictated reports'
                    },
                    dashboard_viewer: {
                        name: 'Dashboard Viewer',
                        description: 'View workload, TAT, revenue, pending/completed cases - read-only access'
                    }
                }
                : {
                    labs: [], // ✅ Include empty labs array in fallback
                    assignor: {
                        name: 'Assignor',
                        description: 'Assign cases to radiologists and verifiers, manage workload distribution'
                    },
                    radiologist: {
                        name: 'Radiologist',
                        description: 'View cases in DICOM viewer, create reports, forward to verifier'
                    },
                    verifier: {
                        name: 'Verifier',
                        description: 'Review radiologist reports, correct errors, finalize and approve reports'
                    },
                    physician: {
                        name: 'Physician / Referral Doctor',
                        description: 'View reports of referred patients, limited download/share access'
                    },
                    receptionist: {
                        name: 'Receptionist',
                        description: 'Register patients, print reports, update patient demographic details'
                    },
                    billing: {
                        name: 'Billing Section',
                        description: 'Generate patient bills, maintain billing information linked with reports'
                    },
                    typist: {
                        name: 'Typist',
                        description: 'Support radiologist by typing dictated reports'
                    },
                    dashboard_viewer: {
                        name: 'Dashboard Viewer',
                        description: 'View workload, TAT, revenue, pending/completed cases - read-only access'
                    }
                };
                
            setAvailableRoles(defaultRoles);
            toast.error('Failed to fetch available roles - using defaults');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const endpoint = currentUser?.role === 'admin' 
                ? '/admin/user-management/users'
                : '/group/user-management/users';
                
            const response = await api.get(endpoint);
            if (response.data.success) {
                setUsers(response.data.data.users || response.data.data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // Handle input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // ✅ NEW: Handle email change (removes spaces and special chars)
    const handleEmailChange = (e) => {
        const value = e.target.value
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '')  // Remove invalid characters
            .replace(/\s+/g, '');           // Remove spaces
        
        setFormData(prev => ({
            ...prev,
            email: value
        }));
    };

    // Handle role config changes
    const handleRoleConfigChange = (key, value) => {
        setRoleConfig(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Handle dashboard access changes
    const handleDashboardAccessChange = (key, value) => {
        setRoleConfig(prev => ({
            ...prev,
            dashboardAccess: {
                ...prev.dashboardAccess,
                [key]: value
            }
        }));
    };

    // ✅ NEW: Handle column toggle
    const handleColumnToggle = (columnId) => {
        setFormData(prev => {
            const isSelected = prev.visibleColumns.includes(columnId);
            return {
                ...prev,
                visibleColumns: isSelected
                    ? prev.visibleColumns.filter(id => id !== columnId)
                    : [...prev.visibleColumns, columnId]
            };
        });
    };

    // ✅ NEW: Handle select/clear all columns
    const handleSelectAllColumns = (columns) => {
        setFormData(prev => ({ ...prev, visibleColumns: columns }));
    };

    // ✅ NEW: Handle multi-role toggle
    const handleMultiRoleToggle = (roleKey) => {
        setFormData(prev => {
            const isSelected = prev.accountRoles.includes(roleKey);
            const newRoles = isSelected
                ? prev.accountRoles.filter(r => r !== roleKey)
                : [...prev.accountRoles, roleKey];

            // If removing the primary role, set a new one
            let newPrimaryRole = prev.primaryRole;
            if (isSelected && prev.primaryRole === roleKey) {
                newPrimaryRole = newRoles[0] || '';
            }

            return {
                ...prev,
                accountRoles: newRoles,
                primaryRole: newPrimaryRole || newRoles[0] || ''
            };
        });
    };

    // ✅ NEW: Handle lab toggle
    const handleLabToggle = (labId) => {
        setFormData(prev => {
            const isSelected = prev.linkedLabs.some(lab => lab.labId === labId);
            return {
                ...prev,
                linkedLabs: isSelected
                    ? prev.linkedLabs.filter(lab => lab.labId !== labId)
                    : [...prev.linkedLabs, { labId, permissions: { canViewStudies: true, canAssignStudies: false } }]
            };
        });
    };

    // ✅ NEW: Handle qualifications array for radiologist
const handleQualificationChange = (index, value) => {
    const newQualifications = [...formData.qualifications];
    newQualifications[index] = value;
    setFormData(prev => ({
        ...prev,
        qualifications: newQualifications
    }));
};

const addQualification = () => {
    setFormData(prev => ({
        ...prev,
        qualifications: [...prev.qualifications, '']
    }));
};

const removeQualification = (index) => {
    setFormData(prev => ({
        ...prev,
        qualifications: prev.qualifications.filter((_, i) => i !== index)
    }));
};

// ✅ NEW: Signature handling for radiologist
const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
    }

    if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
    }

    setSignatureImage(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
        setSignaturePreview(reader.result);
    };
    reader.readAsDataURL(file);
};

const removeSignature = () => {
    setSignatureImage(null);
    setSignaturePreview(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
};

const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// ✅ NEW: Check if radiologist role is selected
const isRadiologistSelected = () => {
    if (useMultiRole) {
        return formData.accountRoles.includes('radiologist');
    }
    return formData.role === 'radiologist';
};

    // Get role-specific configuration component
    const getRoleSpecificConfig = () => {
        if (!formData.role) return null;

        switch (formData.role) {
            case 'group_id':
                return (
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2">
                            <Crown className="w-4 h-4 text-purple-600" />
                            <span>Group ID Configuration</span>
                        </h4>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <Crown className="w-5 h-5 text-purple-600 mt-0.5" />
                                <div>
                                    <h5 className="text-sm font-medium text-purple-900 mb-1">
                                        Role Creator Privileges
                                    </h5>
                                    <p className="text-xs text-purple-700">
                                        This user will be able to create and manage other user roles including Assignor, 
                                        Radiologist, Verifier, Physician, Receptionist, Billing, Typist, and Dashboard Viewer.
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Organization Type
                            </label>
                            <select
                                value={formData.organizationType}
                                onChange={(e) => handleInputChange({ target: { name: 'organizationType', value: e.target.value } })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="teleradiology_company">Teleradiology Company</option>
                                <option value="diagnostic_center">Diagnostic Center</option>
                                <option value="hospital">Hospital</option>
                                <option value="clinic">Clinic</option>
                            </select>
                        </div>
                    </div>
                );

            case 'typist':
                return (
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Typist Configuration</h4>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Link to Radiologist *
                            </label>
                            <select
                                value={roleConfig.linkedRadiologist}
                                onChange={(e) => handleRoleConfigChange('linkedRadiologist', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">Select Radiologist</option>
                                {users
                                    .filter(user => user.role === 'radiologist')
                                    .map(user => (
                                        <option key={user._id} value={user._id}>
                                            {user.fullName} ({user.email})
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>
                );

            case 'verifier':
                return (
                    <div className="space-y-6">
                        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-indigo-600" />
                            Verifier Configuration
                        </h4>

                        {/* ── ASSIGNED RADIOLOGISTS ── */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Bind to Radiologists
                                <span className="ml-2 text-xs text-gray-400 font-normal">
                                    (leave empty = sees ALL radiologists' studies)
                                </span>
                            </label>

                            {users.filter(u => u.role === 'radiologist').length === 0 ? (
                                <div className="p-4 border border-dashed border-gray-200 rounded-lg text-center text-sm text-gray-400">
                                    No radiologists found in this organization
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                                    {users.filter(u => u.role === 'radiologist').map(u => {
                                        const isChecked = (roleConfig.assignedRadiologists || []).includes(u._id);
                                        return (
                                            <label
                                                key={u._id}
                                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                                    isChecked ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const current = roleConfig.assignedRadiologists || [];
                                                        handleRoleConfigChange(
                                                            'assignedRadiologists',
                                                            e.target.checked
                                                                ? [...current, u._id]
                                                                : current.filter(id => id !== u._id)
                                                        );
                                                    }}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{u.fullName}</p>
                                                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                                </div>
                                                {isChecked && <CheckCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {(roleConfig.assignedRadiologists || []).length > 0 && (
                                <p className="text-xs text-indigo-600 mt-1.5 flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Bound to {roleConfig.assignedRadiologists.length} radiologist(s) — only their studies will appear
                                </p>
                            )}
                        </div>

                        {/* ── LAB ACCESS MODE ── */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Lab Access Mode
                                <span className="ml-2 text-xs text-gray-400 font-normal">
                                    (controls which lab studies are visible)
                                </span>
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'all',      label: 'All Labs',      desc: 'See all org labs',    color: 'green' },
                                    { value: 'selected', label: 'Selected Labs', desc: 'Only specific labs',  color: 'blue'  },
                                    { value: 'none',     label: 'No Lab Access', desc: 'Block all lab access', color: 'red'  }
                                ].map(opt => {
                                    const isActive = (roleConfig.labAccessMode || 'all') === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                handleRoleConfigChange('labAccessMode', opt.value);
                                                // Clear assigned labs when not in 'selected' mode
                                                if (opt.value !== 'selected') {
                                                    handleRoleConfigChange('assignedLabs', []);
                                                }
                                            }}
                                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                                                isActive
                                                    ? opt.value === 'green' ? 'border-green-500 bg-green-50'
                                                    : opt.value === 'red'   ? 'border-red-500 bg-red-50'
                                                    : 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                            }`}
                                        >
                                            <p className={`text-xs font-bold ${
                                                isActive
                                                    ? opt.value === 'none' ? 'text-red-700'
                                                    : opt.value === 'selected' ? 'text-blue-700'
                                                    : 'text-green-700'
                                                    : 'text-gray-700'
                                            }`}>
                                                {opt.label}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── SELECT SPECIFIC LABS (only when mode = 'selected') ── */}
                        {(roleConfig.labAccessMode || 'all') === 'selected' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Labs
                                    <span className="ml-2 text-xs text-gray-400 font-normal">
                                        (verifier will only see studies from these labs)
                                    </span>
                                </label>

                                {(availableRoles.labs || []).length === 0 ? (
                                    <div className="p-4 border border-dashed border-gray-200 rounded-lg text-center text-sm text-gray-400">
                                        No labs found — create labs first
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
                                        {(availableRoles.labs || []).map(lab => {
                                            const isChecked = (roleConfig.assignedLabs || []).includes(lab._id);
                                            return (
                                                <label
                                                    key={lab._id}
                                                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                                        isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            const current = roleConfig.assignedLabs || [];
                                                            handleRoleConfigChange(
                                                                'assignedLabs',
                                                                e.target.checked
                                                                    ? [...current, lab._id]
                                                                    : current.filter(id => id !== lab._id)
                                                            );
                                                        }}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-800 truncate">
                                                            {lab.name}
                                                        </p>
                                                        <p className="text-xs text-gray-400 truncate">
                                                            {lab.identifier} {lab.address?.city ? `• ${lab.address.city}` : ''}
                                                        </p>
                                                    </div>
                                                    {isChecked && <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}

                                {(roleConfig.assignedLabs || []).length > 0 && (
                                    <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        {roleConfig.assignedLabs.length} lab(s) selected
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── SUMMARY BADGE ── */}
                        {((roleConfig.assignedRadiologists || []).length > 0 || (roleConfig.labAccessMode || 'all') !== 'all') && (
                            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <p className="text-xs font-semibold text-indigo-800 mb-1">📋 Binding Summary</p>
                                <ul className="text-xs text-indigo-700 space-y-0.5">
                                    {(roleConfig.assignedRadiologists || []).length > 0 && (
                                        <li>• Doctors: {roleConfig.assignedRadiologists.length} radiologist(s) bound</li>
                                    )}
                                    {(roleConfig.labAccessMode || 'all') === 'selected' && (
                                        <li>• Labs: {(roleConfig.assignedLabs || []).length} lab(s) selected</li>
                                    )}
                                    {(roleConfig.labAccessMode || 'all') === 'none' && (
                                        <li>• Labs: ❌ No lab access</li>
                                    )}
                                    {(roleConfig.labAccessMode || 'all') === 'all' && (
                                        <li>• Labs: ✅ All labs accessible</li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    // Handle form submission
        const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.password) {
        toast.error('Please fill in all required fields');
        return;
    }

    if (!useMultiRole && !formData.role) {
        toast.error('Please select a role');
        return;
    }

    if (useMultiRole && formData.accountRoles.length === 0) {
        toast.error('Please select at least one role');
        return;
    }

    // Role-specific validation
    if (formData.role === 'typist' && !roleConfig.linkedRadiologist) {
        toast.error('Please select a radiologist for the typist');
        return;
    }

    // ✅ NEW: Radiologist validation
    if (isRadiologistSelected() && !formData.specialization) {
        toast.error('Please enter specialization for radiologist');
        return;
    }

    setLoading(true);

    try {
        // ✅ NEW: Convert signature to base64 if uploaded
        let signatureBase64 = null;
        if (signatureImage) {
            signatureBase64 = await convertImageToBase64(signatureImage);
        }

        const submissionData = {
            ...formData,
            roleConfig: {
                ...roleConfig,
                // ✅ Verifier: ensure lab config is included cleanly
                ...(formData.role === 'verifier' || (useMultiRole && formData.accountRoles.includes('verifier'))) && {
                    assignedRadiologists: roleConfig.assignedRadiologists || [],
                    labAccessMode: roleConfig.labAccessMode || 'all',
                    assignedLabs: roleConfig.labAccessMode === 'selected' 
                        ? (roleConfig.assignedLabs || []) 
                        : []
                }
            },
            requireReportVerification: formData.requireReportVerification,
            ...(isRadiologistSelected() && {
                specialization: formData.specialization,
                licenseNumber: formData.licenseNumber,
                department: formData.department,
                qualifications: formData.qualifications.filter(q => q.trim()),
                yearsOfExperience: formData.yearsOfExperience ? parseInt(formData.yearsOfExperience) : undefined,
                contactPhoneOffice: formData.contactPhoneOffice,
                signatureImageData: signatureBase64
            }),
            ...(useMultiRole && {
                role: formData.primaryRole,
                accountRoles: formData.accountRoles,
                primaryRole: formData.primaryRole
            })
        };

        const endpoint = currentUser?.role === 'admin' 
            ? '/admin/user-management/create'
            : '/group/user-management/create';

        const response = await api.post(endpoint, submissionData);

        if (response.data.success) {
            toast.success(`User created successfully!`);
            const redirectPath = currentUser?.role === 'admin' 
                ? '/admin/dashboard'
                : '/group/dashboard';
            navigate(redirectPath);
        }
    } catch (error) {
        console.error('Error creating user:', error);
        toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
        setLoading(false);
    }
};
    // Get role icon and color
    const getRoleDisplay = (roleKey) => {
        const roleIcons = {
            group_id: { icon: <Crown className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-100' },
            assignor: { icon: <Users className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-100' },
            radiologist: { icon: <Shield className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-100' },
            verifier: { icon: <CheckCircle className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-100' },
            physician: { icon: <User className="w-5 h-5" />, color: 'text-indigo-600', bg: 'bg-indigo-100' },
            receptionist: { icon: <UserPlus className="w-5 h-5" />, color: 'text-pink-600', bg: 'bg-pink-100' },
            billing: { icon: <CrownIcon className="w-5 h-5" />, color: 'text-yellow-600', bg: 'bg-yellow-100' },
            typist: { icon: <Zap className="w-5 h-5" />, color: 'text-orange-600', bg: 'bg-orange-100' },
            dashboard_viewer: { icon: <Eye className="w-5 h-5" />, color: 'text-gray-600', bg: 'bg-gray-100' }
        };

        return roleIcons[roleKey] || { icon: <User className="w-5 h-5" />, color: 'text-gray-600', bg: 'bg-gray-100' };
    };

    // Get page title based on current user role
    const getPageTitle = () => {
        return currentUser?.role === 'admin' ? 'Create New User' : 'Create User Role';
    };

    const getBackPath = () => {
        return currentUser?.role === 'admin' ? '/admin/dashboard' : '/group/dashboard';
    };

    // ✅ NEW: Check if role needs lab linking
    const shouldShowLabSelector = () => {
        const rolesNeedingLabs = ['assignor', 'admin', 'group_id', 'receptionist'];
        if (useMultiRole) {
            return formData.accountRoles.some(role => rolesNeedingLabs.includes(role));
        }
        return rolesNeedingLabs.includes(formData.role);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={() => navigate(getBackPath())}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Back to Dashboard</span>
                        </button>
                        
                        <div className="flex items-center space-x-2">
                            <Sparkles className="w-5 h-5 text-blue-500" />
                            <h1 className="text-xl font-bold text-gray-900">{getPageTitle()}</h1>
                        </div>

                        {/* ✅ REMOVED: Create Lab button from here - moved into form */}
                        <div className="w-24" /> {/* spacer for alignment */}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* Basic Information */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                <User className="w-5 h-5 text-blue-600" />
                                <span>Basic Information</span>
                            </h3>
                        </div>
                        
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter full name"
                                        required
                                    />
                                </div>

                                {/* ✅ USERNAME ONLY - backend appends @bharatpacs.com */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Username *
                                    </label>
                                    <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden">
                                        <input
                                            type="text"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleEmailChange}
                                            className="flex-1 px-3 py-2 outline-none border-none focus:ring-0"
                                            placeholder="username"
                                            required
                                        />
                                        <span className="flex items-center px-3 bg-gray-100 text-gray-500 text-sm border-l border-gray-300 whitespace-nowrap">
                                            @bharatpacs.com
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Login: <strong>{formData.email || 'username'}@bharatpacs.com</strong>
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Password *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Role Configuration */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                    <span>Role Configuration</span>
                                </h3>
                                
                                {/* ✅ CREATE LAB BUTTON - right side of Role Configuration header */}
                                <button
                                    type="button"
                                    onClick={() => navigate('/admin/create-lab')}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                                    title="Create a new Lab / Center"
                                >
                                    <Building2 className="w-4 h-4" />
                                    <span>+ Create Lab</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-between mt-2">
                                <p className="text-sm text-gray-600">
                                    Select the role for this user
                                </p>
                                {/* ✅ existing multi-role toggle */}
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useMultiRole}
                                        onChange={(e) => setUseMultiRole(e.target.checked)}
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Enable Multi-Role</span>
                                </label>
                            </div>
                        </div>
                        
                        <div className="p-6">
                            {useMultiRole ? (
                                <MultiAccountRoleSelector
                                    availableRoles={availableRoles}
                                    selectedRoles={formData.accountRoles}
                                    primaryRole={formData.primaryRole}
                                    onRoleToggle={handleMultiRoleToggle}
                                    onPrimaryRoleChange={(role) => setFormData(prev => ({ ...prev, primaryRole: role }))}
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Object.entries(availableRoles).map(([roleKey, roleData]) => {
                                        const roleDisplay = getRoleDisplay(roleKey);
                                        const isSelected = formData.role === roleKey;
                                        
                                        return (
                                            <div
                                                key={roleKey}
                                                onClick={() => handleInputChange({ target: { name: 'role', value: roleKey } })}
                                                className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                                                    isSelected 
                                                        ? 'border-blue-500 bg-blue-50 shadow-md' 
                                                        : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="flex items-start space-x-3">
                                                    <div className={`p-2 rounded-lg ${roleDisplay.bg}`}>
                                                        <div className={roleDisplay.color}>
                                                            {roleDisplay.icon}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                                            {roleData.name}
                                                            {roleKey === 'group_id' && (
                                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                                    <Crown className="w-3 h-3 mr-1" />
                                                                    Creator
                                                                </span>
                                                            )}
                                                        </h4>
                                                        <p className="text-xs text-gray-600 leading-relaxed">
                                                            {roleData.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2">
                                                        <CheckCircle className="w-5 h-5 text-blue-500" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ✅ FEATURE 1: Column-based Restriction */}
                    {(formData.role || formData.accountRoles.length > 0) && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                    <Columns className="w-5 h-5 text-teal-600" />
                                    <span>Visible Columns Configuration</span>
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Select which columns this user can see in their worklist
                                </p>
                            </div>
                            
                            <div className="p-6">
                                <ColumnSelector
                                    selectedColumns={formData.visibleColumns}
                                    onColumnToggle={handleColumnToggle}
                                    onSelectAll={(columns) => handleSelectAllColumns(columns)}
                                    onClearAll={() => handleSelectAllColumns([])}
                                    userRoles={useMultiRole ? formData.accountRoles : [formData.role]}
                                    formData={formData}
                                    setFormData={setFormData}
                                    useMultiRole={useMultiRole}
                                />
                            </div>
                        </div>
                    )}

                    {/* ✅ FEATURE 3: Lab/Center Linking */}
                    {shouldShowLabSelector() && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                    <Building2 className="w-5 h-5 text-orange-600" />
                                    <span>Lab/Center Access</span>
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Select which labs/centers this user can access
                                </p>
                            </div>
                            
                            <div className="p-6">
                                <LabSelector
    selectedLabs={formData.linkedLabs.map(lab => lab.labId)}
    onLabToggle={handleLabToggle}
    onSelectAll={(labIds) => setFormData(prev => ({ 
        ...prev, 
        linkedLabs: labIds.map(labId => ({ 
            labId, 
            permissions: { canViewStudies: true, canAssignStudies: false } 
        })) 
    }))}
    onClearAll={() => setFormData(prev => ({ ...prev, linkedLabs: [] }))}
    availableLabs={availableRoles.labs || []}
/>
                            </div>
                        </div>
                    )}

                    {/* Role-Specific Configuration */}
                    {getRoleSpecificConfig() && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                    <Settings className="w-5 h-5 text-green-600" />
                                    <span>Advanced Role Configuration</span>
                                </h3>
                            </div>
                            
                            <div className="p-6">
                                {getRoleSpecificConfig()}
                            </div>
                        </div>
                    )}

                    {/* ✅ NEW: Radiologist Professional Details */}
{isRadiologistSelected() && (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Stethoscope className="w-5 h-5 text-indigo-600" />
                <span>Radiologist Professional Details</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">
                Medical credentials and professional information
            </p>
        </div>
        
        <div className="p-6 space-y-6">
            {/* Specialization & License */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Specialization <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={formData.specialization}
                            onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., Radiology, Neuroradiology"
                            required={isRadiologistSelected()}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        License Number
                    </label>
                    <input
                        type="text"
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Medical license number"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                    </label>
                    <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Department name"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Years of Experience
                    </label>
                    <input
                        type="number"
                        value={formData.yearsOfExperience}
                        onChange={(e) => setFormData(prev => ({ ...prev, yearsOfExperience: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="0"
                        min="0"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Office Phone
                    </label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="tel"
                            value={formData.contactPhoneOffice}
                            onChange={(e) => setFormData(prev => ({ ...prev, contactPhoneOffice: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="+1 (555) 123-4567"
                        />
                    </div>
                </div>
            </div>

            {/* Qualifications */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Qualifications
                </label>
                <div className="space-y-2">
                    {formData.qualifications.map((qual, index) => (
                        <div key={index} className="flex space-x-2">
                            <input
                                type="text"
                                value={qual}
                                onChange={(e) => handleQualificationChange(index, e.target.value)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="e.g., MD, MBBS, Fellowship in Radiology"
                            />
                            <button
                                type="button"
                                onClick={() => removeQualification(index)}
                                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addQualification}
                        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center space-x-2"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Add Qualification</span>
                    </button>
                </div>
            </div>

            {/* Digital Signature */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                    <Award className="w-4 h-4 text-purple-600" />
                    <span>Digital Signature (Optional)</span>
                </label>
                
                {!signaturePreview ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 transition-colors">
                        <div className="text-center">
                            <Upload className="mx-auto w-10 h-10 text-gray-400 mb-3" />
                            <h4 className="text-sm font-medium text-gray-700 mb-1">
                                Upload Signature Image
                            </h4>
                            <p className="text-xs text-gray-500 mb-3">
                                PNG, JPG up to 5MB
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleSignatureUpload}
                                className="hidden"
                                id="signature-upload"
                            />
                            <label
                                htmlFor="signature-upload"
                                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                            >
                                <Image className="w-4 h-4 mr-2" />
                                Choose Image
                            </label>
                        </div>
                    </div>
                ) : (
                    <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                                <CheckCircle className="w-5 h-5 text-indigo-600" />
                                <span className="text-sm font-medium text-indigo-900">
                                    Signature Uploaded
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={removeSignature}
                                className="text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="bg-white rounded-lg p-4 flex items-center justify-center">
                            <img
                                src={signaturePreview}
                                alt="Signature preview"
                                className="max-h-32 object-contain"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
)}

                    {/* ✅ FEATURE 4: Report Verification Toggle for Radiologist */}
                    {((formData.role === 'radiologist' && !useMultiRole) || 
                      (useMultiRole && formData.accountRoles.includes('radiologist'))) && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                    <Shield className="w-5 h-5 text-green-600" />
                                    <span>Report Verification Settings</span>
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Configure whether reports need verification before completion
                                </p>
                            </div>
                            
                            <div className="p-6">
                                <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <div className="font-medium text-gray-900">Require Report Verification</div>
                                            <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                formData.requireReportVerification 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {formData.requireReportVerification ? 'ENABLED' : 'DISABLED'}
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            When enabled, all finalized reports must be verified by a verifier before being marked as complete
                                        </div>
                                    </div>
                                    <div className="relative ml-4">
                                        <input
                                            type="checkbox"
                                            checked={formData.requireReportVerification}
                                            onChange={(e) => setFormData(prev => ({ 
                                                ...prev, 
                                                requireReportVerification: e.target.checked 
                                            }))}
                                            className="sr-only"
                                        />
                                        <div className={`block w-14 h-8 rounded-full transition ${
                                            formData.requireReportVerification ? 'bg-green-500' : 'bg-gray-300'
                                        }`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                                            formData.requireReportVerification ? 'transform translate-x-6' : ''
                                        }`}></div>
                                    </div>
                                </label>

                                {formData.requireReportVerification && (
                                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex items-start space-x-2">
                                            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                            <div className="text-sm text-blue-800">
                                                <strong>Verification Workflow:</strong>
                                                <ul className="list-disc ml-4 mt-2 space-y-1">
                                                    <li>Reports will be sent to verification queue after finalization</li>
                                                    <li>A verifier must review and approve the report</li>
                                                    <li>Only verified reports will be marked as "Completed"</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={() => navigate(getBackPath())}
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-lg transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center space-x-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                    <span>Creating...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    <span>Create User</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUser;