import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    ArrowLeft,
    UserPlus,
    User,
    Users,
    Shield,
    Settings,
    CheckCircle,
    CrownIcon,
    Save,
    Eye,
    EyeOff,
    Crown,
    Zap,
    Columns,
    Building2,
    Stethoscope,
    Phone,
    Award,
    Upload,
    X,
    Search,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ColumnSelector from '../../components/common/ColumnSelector';
import MultiAccountRoleSelector from '../../components/admin/MultiAccountRoleSelector';
import LabSelector from '../../components/common/LabSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';
import sessionManager from '../../services/sessionManager';

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
    const [radSearch, setRadSearch] = useState('');
    const [labSearch, setLabSearch] = useState('');

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
                    <div className="space-y-2.5">
                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-2.5">
                            <div className="flex items-start gap-2">
                                <Crown className="w-3.5 h-3.5 text-purple-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <div className="text-xs font-medium text-purple-900">Role Creator Privileges</div>
                                    <p className="text-[10px] text-purple-700 mt-0.5 leading-relaxed">
                                        Can create/manage Assignor, Radiologist, Verifier, Physician, Receptionist, Billing, Typist, Dashboard Viewer.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Organization Type</label>
                            <select
                                value={formData.organizationType}
                                onChange={(e) => handleInputChange({ target: { name: 'organizationType', value: e.target.value } })}
                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Link to Radiologist <span className="text-red-500">*</span></label>
                        <select
                            value={roleConfig.linkedRadiologist}
                            onChange={(e) => handleRoleConfigChange('linkedRadiologist', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                );

            case 'verifier':
                return (
                    <div className="space-y-3">
                        {/* ── BIND TO RADIOLOGISTS ── */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Bind to Radiologists
                                <span className="ml-1 text-[10px] text-gray-400 font-normal">(empty = all)</span>
                            </label>

                            {users.filter(u => u.role === 'radiologist').length === 0 ? (
                                <div className="p-2.5 border border-dashed border-gray-200 rounded-lg text-center text-xs text-gray-400">
                                    No radiologists found
                                </div>
                            ) : (
                                <>
                                    <div className="relative mb-1">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search radiologists..."
                                            value={radSearch}
                                            onChange={(e) => setRadSearch(e.target.value)}
                                            className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        />
                                    </div>
                                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-36 overflow-y-auto">
                                        {users.filter(u => u.role === 'radiologist').filter(u => {
                                            if (!radSearch) return true;
                                            const s = radSearch.toLowerCase();
                                            return u.fullName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
                                        }).map(u => {
                                            const isChecked = (roleConfig.assignedRadiologists || []).includes(u._id);
                                            return (
                                                <label
                                                    key={u._id}
                                                    className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
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
                                                        className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-gray-800 truncate">{u.fullName}</p>
                                                        <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                                                    </div>
                                                    {isChecked && <CheckCircle className="w-3 h-3 text-indigo-500 flex-shrink-0" />}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {(roleConfig.assignedRadiologists || []).length > 0 && (
                                <p className="text-[10px] text-indigo-600 mt-1 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Bound to {roleConfig.assignedRadiologists.length} radiologist(s)
                                </p>
                            )}
                        </div>

                        {/* ── LAB ACCESS MODE ── */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Lab Access Mode</label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {[
                                    { value: 'all', icon: '🌐', label: 'All Labs' },
                                    { value: 'selected', icon: '✅', label: 'Selected' },
                                    { value: 'none', icon: '🚫', label: 'None' },
                                ].map(opt => {
                                    const isActive = (roleConfig.labAccessMode || 'all') === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                handleRoleConfigChange('labAccessMode', opt.value);
                                                if (opt.value !== 'selected') {
                                                    handleRoleConfigChange('assignedLabs', []);
                                                }
                                            }}
                                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all text-center ${isActive
                                                ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-sm'
                                                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                                }`}
                                        >
                                            {opt.icon} {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── SELECT SPECIFIC LABS ── */}
                        {(roleConfig.labAccessMode || 'all') === 'selected' && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Select Labs <span className="text-[10px] text-gray-400 font-normal">(visible studies)</span>
                                </label>

                                {(availableRoles.labs || []).length === 0 ? (
                                    <div className="p-2.5 border border-dashed border-gray-200 rounded-lg text-center text-xs text-gray-400">
                                        No labs found — create labs first
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative mb-1">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search labs..."
                                                value={labSearch}
                                                onChange={(e) => setLabSearch(e.target.value)}
                                                className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500"
                                            />
                                        </div>
                                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-32 overflow-y-auto">
                                            {(availableRoles.labs || []).filter(lab => {
                                                if (!labSearch) return true;
                                                const s = labSearch.toLowerCase();
                                                return lab.name?.toLowerCase().includes(s) || lab.identifier?.toLowerCase().includes(s) || lab.address?.city?.toLowerCase().includes(s);
                                            }).map(lab => {
                                                const isChecked = (roleConfig.assignedLabs || []).includes(lab._id);
                                                return (
                                                    <label
                                                        key={lab._id}
                                                        className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${isChecked ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
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
                                                            className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-gray-800 truncate">{lab.name}</p>
                                                            <p className="text-[10px] text-gray-400 truncate">{lab.identifier} {lab.address?.city ? `• ${lab.address.city}` : ''}</p>
                                                        </div>
                                                        {isChecked && <CheckCircle className="w-3 h-3 text-teal-600 flex-shrink-0" />}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {(roleConfig.assignedLabs || []).length > 0 && (
                                    <p className="text-[10px] text-teal-600 mt-1 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        {roleConfig.assignedLabs.length} lab(s) selected
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── SUMMARY ── */}
                        {((roleConfig.assignedRadiologists || []).length > 0 || (roleConfig.labAccessMode || 'all') !== 'all') && (
                            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-700">
                                <span className="font-semibold">Summary:</span>
                                {(roleConfig.assignedRadiologists || []).length > 0 && ` ${roleConfig.assignedRadiologists.length} doctor(s) bound`}
                                {(roleConfig.labAccessMode || 'all') === 'selected' && ` · ${(roleConfig.assignedLabs || []).length} lab(s)`}
                                {(roleConfig.labAccessMode || 'all') === 'none' && ' · No lab access'}
                                {(roleConfig.labAccessMode || 'all') === 'all' && ' · All labs'}
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
                    signature: signatureBase64,           // ✅ FIX: was 'signatureImageData'
                    signatureMetadata: signatureImage ? {
                        originalName: signatureImage.name,
                        originalSize: signatureImage.size,
                        mimeType: signatureImage.type,
                        format: 'base64'
                    } : undefined
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
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
            {/* ─── SLIM STICKY HEADER ─── */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-gray-200 flex-shrink-0 z-10">
                <button
                    onClick={() => navigate(getBackPath())}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="font-medium">Back</span>
                </button>

                <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-teal-600" />
                    <h1 className="text-sm font-semibold text-gray-900">{getPageTitle()}</h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/create-lab')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        + Lab
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(getBackPath())}
                        className="px-3.5 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {loading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5" />
                        )}
                        {loading ? 'Creating…' : 'Create User'}
                    </button>
                </div>
            </div>

            {/* ─── BODY: 3-Column Grid ─── */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 h-full">

                    {/* ══════ COLUMN 1: User Identity & Settings ══════ */}
                    <div className="lg:col-span-3 border-r border-gray-200 bg-white overflow-y-auto px-4 py-3 space-y-3">

                        {/* User Details */}
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <User className="w-3.5 h-3.5 text-teal-600" />
                                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Account Details</h4>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleInputChange}
                                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                                        placeholder="Enter full name"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                                    <div className="flex rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 overflow-hidden">
                                        <input
                                            type="text"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleEmailChange}
                                            className="flex-1 px-2.5 py-1.5 outline-none border-none focus:ring-0 text-sm"
                                            placeholder="username"
                                            required
                                        />
                                        <span className="flex items-center px-2.5 bg-gray-50 text-gray-400 text-xs border-l border-gray-300 whitespace-nowrap">
                                            @bharatpacs.com
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        Login: <strong>{formData.email || 'username'}@bharatpacs.com</strong>
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleInputChange}
                                            className="w-full px-2.5 py-1.5 pr-9 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center"
                                        >
                                            {showPassword ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Report Verification Toggle (radiologist) */}
                        {((formData.role === 'radiologist' && !useMultiRole) ||
                            (useMultiRole && formData.accountRoles.includes('radiologist'))) && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Shield className="w-3.5 h-3.5 text-teal-600" />
                                        <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Verification</h4>
                                    </div>
                                    <label className="flex items-center justify-between p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                        <div className="pr-3">
                                            <div className="text-xs font-medium text-gray-900">Require Report Verification</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">Reports verified before completion</div>
                                        </div>
                                        <div className="relative flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={formData.requireReportVerification}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    requireReportVerification: e.target.checked
                                                }))}
                                                className="sr-only"
                                            />
                                            <div className={`block w-10 h-5 rounded-full transition ${formData.requireReportVerification ? 'bg-teal-500' : 'bg-gray-300'}`}></div>
                                            <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${formData.requireReportVerification ? 'transform translate-x-5' : ''}`}></div>
                                        </div>
                                    </label>
                                    {formData.requireReportVerification && (
                                        <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-700">
                                            <strong>Workflow:</strong> Reports → Verification Queue → Verifier Approves → Completed
                                        </div>
                                    )}
                                </div>
                            )}

                        {/* Radiologist Details (conditional) */}
                        {isRadiologistSelected() && (
                            <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Professional Details</h4>
                                </div>
                                <div className="space-y-2.5">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Specialization <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={formData.specialization}
                                            onChange={(e) => setFormData(prev => ({ ...prev, specialization: e.target.value }))}
                                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="e.g., Neuroradiology"
                                            required={isRadiologistSelected()}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">License No.</label>
                                            <input
                                                type="text"
                                                value={formData.licenseNumber}
                                                onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                placeholder="License #"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Experience</label>
                                            <input
                                                type="number"
                                                value={formData.yearsOfExperience}
                                                onChange={(e) => setFormData(prev => ({ ...prev, yearsOfExperience: e.target.value }))}
                                                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                placeholder="Years"
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                                        <input
                                            type="text"
                                            value={formData.department}
                                            onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="Department"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Office Phone</label>
                                        <input
                                            type="tel"
                                            value={formData.contactPhoneOffice}
                                            onChange={(e) => setFormData(prev => ({ ...prev, contactPhoneOffice: e.target.value }))}
                                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="+91 98765 43210"
                                        />
                                    </div>

                                    {/* Qualifications */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Qualifications</label>
                                        <div className="space-y-1.5">
                                            {formData.qualifications.map((qual, index) => (
                                                <div key={index} className="flex gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={qual}
                                                        onChange={(e) => handleQualificationChange(index, e.target.value)}
                                                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                        placeholder="e.g., MD, MBBS"
                                                    />
                                                    <button type="button" onClick={() => removeQualification(index)} className="px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addQualification}
                                                className="w-full px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors"
                                            >
                                                + Add Qualification
                                            </button>
                                        </div>
                                    </div>

                                    {/* Digital Signature */}
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Award className="w-3 h-3 text-purple-600" />
                                            Signature <span className="text-gray-400 font-normal">(optional)</span>
                                        </label>
                                        {!signaturePreview ? (
                                            <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-teal-400 transition-colors">
                                                <Upload className="mx-auto w-6 h-6 text-gray-300 mb-1" />
                                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" id="signature-upload" />
                                                <label htmlFor="signature-upload" className="text-xs text-teal-600 font-medium cursor-pointer hover:underline">
                                                    Upload Image
                                                </label>
                                                <p className="text-[10px] text-gray-400 mt-0.5">PNG/JPG, max 5MB</p>
                                            </div>
                                        ) : (
                                            <div className="border border-indigo-200 rounded-lg p-2 bg-indigo-50">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[10px] font-medium text-indigo-800 flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Uploaded
                                                    </span>
                                                    <button type="button" onClick={removeSignature} className="text-indigo-500 hover:text-indigo-700">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="bg-white rounded p-2 flex items-center justify-center">
                                                    <img src={signaturePreview} alt="Signature" className="max-h-16 object-contain" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ══════ COLUMN 2: Roles & Configuration ══════ */}
                    <div className="lg:col-span-4 border-r border-gray-200 bg-white overflow-y-auto px-4 py-3 space-y-3">

                        {/* Role Selector */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-teal-600" />
                                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Role Selection</h4>
                                </div>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useMultiRole}
                                        onChange={(e) => setUseMultiRole(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span className="text-[11px] font-medium text-gray-600">Multi-Role</span>
                                </label>
                            </div>

                            {useMultiRole ? (
                                <MultiAccountRoleSelector
                                    availableRoles={availableRoles}
                                    selectedRoles={formData.accountRoles}
                                    primaryRole={formData.primaryRole}
                                    onRoleToggle={handleMultiRoleToggle}
                                    onPrimaryRoleChange={(role) => setFormData(prev => ({ ...prev, primaryRole: role }))}
                                />
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(availableRoles)
                                        .filter(([key]) => key !== 'labs')
                                        .map(([roleKey, roleData]) => {
                                            const roleDisplay = getRoleDisplay(roleKey);
                                            const isSelected = formData.role === roleKey;

                                            return (
                                                <div
                                                    key={roleKey}
                                                    onClick={() => handleInputChange({ target: { name: 'role', value: roleKey } })}
                                                    className={`relative p-2 border rounded-lg cursor-pointer transition-all text-left ${isSelected
                                                        ? 'border-teal-500 bg-teal-50 shadow-sm'
                                                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-md ${roleDisplay.bg}`}>
                                                            <div className={`${roleDisplay.color} [&>svg]:w-3.5 [&>svg]:h-3.5`}>
                                                                {roleDisplay.icon}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-semibold text-gray-900 truncate flex items-center gap-1">
                                                                {roleData.name || roleKey}
                                                                {roleKey === 'group_id' && <Crown className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 line-clamp-1">{roleData.description}</div>
                                                        </div>
                                                    </div>
                                                    {isSelected && (
                                                        <CheckCircle className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-teal-600" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>

                        {/* Role-Specific Configuration (verifier/typist/group_id) */}
                        {getRoleSpecificConfig() && (
                            <div>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <Settings className="w-3.5 h-3.5 text-teal-600" />
                                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Role Settings</h4>
                                </div>
                                <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50/50">
                                    {getRoleSpecificConfig()}
                                </div>
                            </div>
                        )}

                        {/* Lab/Center Access */}
                        {shouldShowLabSelector() && (
                            <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Lab / Center Access</h4>
                                </div>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                    </div>

                    {/* ══════ COLUMN 3: Worklist Column Configuration ══════ */}
                    <div className="lg:col-span-5 bg-white overflow-y-auto px-4 py-3 flex flex-col">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Columns className="w-3.5 h-3.5 text-teal-600" />
                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Worklist Columns</h4>
                            <span className="ml-auto text-[11px] text-gray-400 font-medium">
                                {formData.visibleColumns.length} selected
                            </span>
                        </div>

                        {(formData.role || formData.accountRoles.length > 0) ? (
                            <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/30">
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
                        ) : (
                            <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-gray-200">
                                <div className="text-center py-12">
                                    <Columns className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400">Select a role first</p>
                                    <p className="text-xs text-gray-300 mt-0.5">Column configuration will appear here</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreateUser;