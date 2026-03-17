import React, { useState, useEffect } from 'react';
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
    Building2
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ✅ IMPORT NEW COMPONENTS
import ColumnSelector from '../../components/common/ColumnSelector';
import MultiAccountRoleSelector from '../../components/admin/MultiAccountRoleSelector';
import LabSelector from '../../components/common/LabSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';

const CreateUser = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // State management
    const [loading, setLoading] = useState(false);
    const [availableRoles, setAvailableRoles] = useState({});
    const [users, setUsers] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    
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
        linkedLabs: []
    });
    
    // Role-specific configuration
    const [roleConfig, setRoleConfig] = useState({
        linkedRadiologist: '',
        assignedRadiologists: [],
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
            const endpoint = currentUser?.role === 'admin' 
                ? '/admin/user-management/available-roles'
                : '/group/user-management/available-roles';
                
            const response = await api.get(endpoint);
            console.log(response)
            if (response.data.success) {
                setAvailableRoles(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching available roles:', error);
            
            // ✅ FALLBACK: If API fails, provide default roles based on user type
            const defaultRoles = currentUser?.role === 'admin' 
                ? {
                    // Admin can create all roles including group_id
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
                    // Group ID can create all roles except group_id (to prevent circular creation)
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
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Verifier Configuration</h4>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Assigned Radiologists
                            </label>
                            <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
                                {users
                                    .filter(user => user.role === 'radiologist')
                                    .map(user => (
                                        <label key={user._id} className="flex items-center space-x-2 p-1">
                                            <input
                                                type="checkbox"
                                                checked={roleConfig.assignedRadiologists.includes(user._id)}
                                                onChange={(e) => {
                                                    const newList = e.target.checked
                                                        ? [...roleConfig.assignedRadiologists, user._id]
                                                        : roleConfig.assignedRadiologists.filter(id => id !== user._id);
                                                    handleRoleConfigChange('assignedRadiologists', newList);
                                                }}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm">{user.fullName}</span>
                                        </label>
                                    ))}
                            </div>
                        </div>
                    </div>
                );

            case 'dashboard_viewer':
                return (
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Dashboard Access Configuration</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries({
                                viewWorkload: 'View Workload',
                                viewTAT: 'View TAT Reports',
                                viewRevenue: 'View Revenue',
                                viewReports: 'View Reports'
                            }).map(([key, label]) => (
                                <label key={key} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={roleConfig.dashboardAccess[key]}
                                        onChange={(e) => handleDashboardAccessChange(key, e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm">{label}</span>
                                </label>
                            ))}
                        </div>
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

        setLoading(true);

        try {
            const submissionData = {
                ...formData,
                roleConfig: roleConfig,
                // ✅ Include multi-role data if enabled
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

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Enter email address"
                                        required
                                    />
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
                                            {showPassword ? (
                                                <EyeOff className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <Eye className="w-4 h-4 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Auto-generated from email"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ✅ FEATURE 2: Multi-Account Role Setup */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                    <span>Role Configuration</span>
                                </h3>
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
                                    onSelectAll={(labs) => setFormData(prev => ({ 
                                        ...prev, 
                                        linkedLabs: labs.map(labId => ({ 
                                            labId, 
                                            permissions: { canViewStudies: true, canAssignStudies: false } 
                                        })) 
                                    }))}
                                    onClearAll={() => setFormData(prev => ({ ...prev, linkedLabs: [] }))}
                                    organizationId={currentUser?.organization}
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