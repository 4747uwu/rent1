import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';

import {
    Download,
    Search,
    UserPlus,
    Edit,
    Trash2,
    Eye,
    EyeOff,
    UserCheck,
    UserX,
    Settings,
    X,
    Building2,
    Check,
    Package,
    Lock,
    CheckCircle,
    AlertCircle,
    Loader,
    User,
    Shield,
    Columns3,
    Link2,
    ChevronRight,
    IndianRupee,
} from 'lucide-react';
import ColumnSelector from '../../components/common/ColumnSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';
import api from '../../services/api';
import toast from 'react-hot-toast';


const UserManagement = ({ isEmbedded = false }) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // State management
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [showPasswords, setShowPasswords] = useState({});
    const [deleteModal, setDeleteModal] = useState({ show: false, user: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    // ✅ NEW: Edit Modal State
    const [editModal, setEditModal] = useState({
        show: false,
        user: null,
        loading: false
    });

    // ✅ NEW: Edit Form State
    const [editForm, setEditForm] = useState({
        fullName: '',
        email: '',
        password: '',
        visibleColumns: [],
        requireReportVerification: false,
        assignedRadiologists: [],
        assignedLabs: [],
        labAccessMode: 'all',
    });

    // ✅ NEW: Available radiologists and labs for verifier assignment
    const [availableRadiologists, setAvailableRadiologists] = useState([]);
    const [availableLabs, setAvailableLabs] = useState([]);

    // ✅ NEW: Billing modules for lab_staff
    const [availableBillingModules, setAvailableBillingModules] = useState([]);
    const [selectedBillingModules, setSelectedBillingModules] = useState([]);
    const [billingModuleSearch, setBillingModuleSearch] = useState('');


    const [compressionModal, setCompressionModal] = useState({
        show: false,
        loading: false,
        labs: [],
        selectedLabs: [],
        searchTerm: '',
        apiKey: '',
        showApiKey: false,
        enableCompression: true
    });

    const roleOptions = [
        { value: 'group_id', label: 'Group ID', color: 'bg-purple-100 text-purple-800' },
        { value: 'assignor', label: 'Assignor', color: 'bg-teal-100 text-teal-800' },
        { value: 'radiologist', label: 'Radiologist', color: 'bg-green-100 text-green-800' },
        { value: 'verifier', label: 'Verifier', color: 'bg-indigo-100 text-indigo-800' },
        { value: 'physician', label: 'Physician', color: 'bg-teal-100 text-teal-800' },
        { value: 'receptionist', label: 'Receptionist', color: 'bg-pink-100 text-pink-800' },
        { value: 'billing', label: 'Billing', color: 'bg-yellow-100 text-yellow-800' },
        { value: 'typist', label: 'Typist', color: 'bg-orange-100 text-orange-800' },
        { value: 'dashboard_viewer', label: 'Dashboard Viewer', color: 'bg-gray-100 text-gray-800' },
        { value: 'lab_staff', label: 'Lab Staff', color: 'bg-cyan-100 text-cyan-800' }
    ];

    useEffect(() => {
        if (!currentUser || !['admin', 'super_admin', 'group_id', 'assignor'].includes(currentUser.role)) {
            navigate('/');
            return;
        }
        fetchOrganizationUsers();
    }, [currentUser, navigate]);

    // Filter users based on search and role
    useEffect(() => {
        let filtered = users;

        if (searchTerm) {
            filtered = filtered.filter(user =>
                user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.username?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (roleFilter && roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        setFilteredUsers(filtered);
    }, [users, searchTerm, roleFilter]);

    const fetchOrganizationUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('admin/manage-users');
            setUsers(response.data.data.users || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePassword = (userId) => {
        setShowPasswords(prev => ({
            ...prev,
            [userId]: !prev[userId]
        }));
    };

    // ✅ UPDATED: OPEN EDIT MODAL
    const handleOpenEditModal = async (user) => {
        setEditModal({ show: true, user, loading: true });

        let requireVerification = false;
        let assignedRadiologists = [];
        let assignedLabs = [];
        let labAccessMode = 'all';

        try {
            // ✅ Fetch available labs for BOTH assignor and verifier
            if (user.role === 'assignor' || user.role === 'verifier') {
                const labsRes = await api.get('/admin/admin-crud/labs');
                setAvailableLabs(labsRes.data.data || []);
            }

            if (user.role === 'radiologist' && user._id) {
                const response = await api.get(`/admin/admin-crud/doctors`);
                const doctors = response.data.data;
                const doctorProfile = doctors.find(doc => 
                    doc.userAccount?._id === user._id || 
                    doc.userAccount?._id?.toString() === user._id?.toString()
                );
                if (doctorProfile) {
                    requireVerification = doctorProfile.requireReportVerification || false;
                }
            } else if (user.role === 'lab_staff' && user.lab) {
                const response = await api.get(`/admin/admin-crud/labs`);
                const labs = response.data.data;
                const labProfile = labs.find(lab => 
                    lab._id === user.lab || lab._id?.toString() === user.lab?.toString()
                );
                if (labProfile) {
                    requireVerification = labProfile.settings?.requireReportVerification || false;
                }
            }

            // ✅ ASSIGNOR: Load lab assignments from roleConfig
            if (user.role === 'assignor') {
                labAccessMode = user.roleConfig?.labAccessMode || 'all';
                assignedLabs = (user.roleConfig?.assignedLabs || []).map(
                    id => (typeof id === 'object' ? id._id || id : id).toString()
                );
            }

            // ✅ VERIFIER: Load both lab + radiologist assignments
            if (user.role === 'verifier') {
                labAccessMode = user.roleConfig?.labAccessMode || 'all';
                assignedLabs = (user.roleConfig?.assignedLabs || []).map(
                    id => (typeof id === 'object' ? id._id || id : id).toString()
                );
                assignedRadiologists = (user.roleConfig?.assignedRadiologists || []).map(
                    id => (typeof id === 'object' ? id._id || id : id).toString()
                );

                // ✅ FIX: correct endpoint for fetching radiologists
                const radRes = await api.get('/admin/manage-users', {
                    params: { role: 'radiologist' }
                });
                const allUsers = radRes.data.data?.users || radRes.data.data || [];
                setAvailableRadiologists(allUsers.filter(u => u.role === 'radiologist'));
            }

        } catch (error) {
            console.error('Error fetching edit data:', error);
            toast.error('Failed to load user settings');
        }

        // ✅ Fetch billing modules for lab_staff
        if (user.role === 'lab_staff' && user.lab) {
            try {
                const [modulesRes, configRes] = await Promise.all([
                    api.get('/billing/modules'),
                    api.get(`/billing/lab/${user.lab}`).catch(() => ({ data: { data: null } }))
                ]);
                setAvailableBillingModules(modulesRes.data.data || []);
                const currentItems = configRes.data?.data?.billingItems || [];
                setSelectedBillingModules(currentItems.map(item => {
                    // module may be populated object or string ID
                    const mod = item.module;
                    return typeof mod === 'object' ? (mod._id || mod).toString() : (mod || '').toString();
                }).filter(Boolean));
            } catch (err) {
                console.error('Failed to fetch billing modules:', err);
            }
        }

        setEditForm({
            fullName: user.fullName || '',
            email: user.email || '',
            password: '',
            visibleColumns: user.visibleColumns || [],
            requireReportVerification: requireVerification,
            assignedRadiologists,
            assignedLabs,
            labAccessMode,
        });

        setEditModal(prev => ({ ...prev, loading: false }));
    };

    // ✅ CLOSE EDIT MODAL
    const handleCloseEditModal = () => {
        setEditModal({ show: false, user: null, loading: false });
        setEditForm({
            fullName: '',
            email: '',
            password: '',
            visibleColumns: [],
            requireReportVerification: false,
            assignedRadiologists: [],
            assignedLabs: [],
            labAccessMode: 'all',
        });
        setAvailableBillingModules([]);
        setSelectedBillingModules([]);
        setBillingModuleSearch('');
    };

    // ✅ SAVE USER CHANGES
    const handleSaveUser = async () => {
        try {
            setEditModal(prev => ({ ...prev, loading: true }));

            const updateData = {
                fullName: editForm.fullName,
                visibleColumns: editForm.visibleColumns,
            };

            if (editForm.password && editForm.password.trim() !== '') {
                updateData.password = editForm.password;
            }

            if (editModal.user.role === 'radiologist') {
                const response = await api.get(`/admin/admin-crud/doctors`);
                const doctors = response.data.data;
                const doctorProfile = doctors.find(doc => doc.userAccount?._id === editModal.user._id);
                if (doctorProfile) {
                    await api.put(`/admin/admin-crud/doctors/${doctorProfile._id}`, {
                        requireReportVerification: editForm.requireReportVerification
                    });
                }
            }

            if (editModal.user.role === 'lab_staff' && editModal.user.lab) {
                await api.put(`/admin/admin-crud/labs/${editModal.user.lab}`, {
                    'settings.requireReportVerification': editForm.requireReportVerification
                });
            }

            // ✅ ASSIGNOR: Save lab assignments
            if (editModal.user.role === 'assignor') {
                await api.put(`/admin/manage-users/${editModal.user._id}/role-config`, {
                    roleConfig: {
                        labAccessMode: editForm.labAccessMode,
                        assignedLabs: editForm.labAccessMode === 'selected'
                            ? editForm.assignedLabs
                            : [],
                    }
                });
            }

            // ✅ VERIFIER: Save lab + radiologist assignments
            if (editModal.user.role === 'verifier') {
                await api.put(`/admin/manage-users/${editModal.user._id}/role-config`, {
                    roleConfig: {
                        labAccessMode: editForm.labAccessMode,
                        assignedLabs: editForm.labAccessMode === 'selected'
                            ? editForm.assignedLabs
                            : [],
                        assignedRadiologists: editForm.assignedRadiologists,
                    }
                });
            }

            await api.put(`/admin/manage-users/${editModal.user._id}`, updateData);

            // ✅ Save billing modules for lab_staff
            if (editModal.user.role === 'lab_staff' && editModal.user.lab) {
                const billingItems = selectedBillingModules.map(modId => {
                    const mod = availableBillingModules.find(m => m._id === modId);
                    return {
                        module: modId,
                        moduleName: mod?.name || '',
                        moduleCode: mod?.code || '',
                        modality: mod?.modality || '',
                        price: mod?.defaultPrice || 0,
                        isActive: true
                    };
                });
                await api.post(`/billing/lab/${editModal.user.lab}`, {
                    billingItems
                });
            }

            toast.success('User updated successfully!');
            handleCloseEditModal();
            fetchOrganizationUsers();

        } catch (error) {
            console.error('Error updating user:', error);
            toast.error(error.response?.data?.message || 'Failed to update user');
            setEditModal(prev => ({ ...prev, loading: false }));
        }
    };

    // ✅ HANDLE COLUMN TOGGLE
    const handleColumnToggle = (columnId) => {
        setEditForm(prev => ({
            ...prev,
            visibleColumns: prev.visibleColumns.includes(columnId)
                ? prev.visibleColumns.filter(id => id !== columnId)
                : [...prev.visibleColumns, columnId]
        }));
    };

    // ✅ HANDLE SELECT ALL COLUMNS
    const handleSelectAllColumns = (columns) => {
        const allColumnIds = columns.map(col => col.id);
        setEditForm({ ...editForm, visibleColumns: allColumnIds });
    };

    // ✅ HANDLE VERIFIER LAB TOGGLE
    const handleToggleVerifierLab = (labId) => {
        const idStr = labId.toString();
        setEditForm(prev => ({
            ...prev,
            assignedLabs: prev.assignedLabs.includes(idStr)
                ? prev.assignedLabs.filter(id => id !== idStr)
                : [...prev.assignedLabs, idStr]
        }));
    };

    // ✅ HANDLE VERIFIER RADIOLOGIST TOGGLE
    const handleToggleVerifierRadiologist = (radId) => {
        const idStr = radId.toString();
        setEditForm(prev => ({
            ...prev,
            assignedRadiologists: prev.assignedRadiologists.includes(idStr)
                ? prev.assignedRadiologists.filter(id => id !== idStr)
                : [...prev.assignedRadiologists, idStr]
        }));
    };

    // ✅ NEW: Toggle billing module
    const handleToggleBillingModule = (moduleId) => {
        setSelectedBillingModules(prev =>
            prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
        );
    };

    const filteredBillingModules = availableBillingModules.filter(m => {
        if (m.isActive === false) return false;
        if (!billingModuleSearch) return true;
        const s = billingModuleSearch.toLowerCase();
        return m.name?.toLowerCase().includes(s) || m.code?.toLowerCase().includes(s) || m.modality?.toLowerCase().includes(s);
    });

    const handleToggleUserStatus = async (userId, currentStatus) => {
        try {
            await api.patch(`admin/manage-users/${userId}/toggle-status`);
            toast.success(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`);
            fetchOrganizationUsers();
        } catch (error) {
            console.error('Error toggling user status:', error);
            toast.error('Failed to update user status');
        }
    };

    const handleDeleteUser = async () => {
        try {
            await api.delete(`admin/manage-users/${deleteModal.user._id}`);
            toast.success('User deleted successfully');
            setDeleteModal({ show: false, user: null });
            fetchOrganizationUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user');
        }
    };

    const getRoleColor = (role) => {
        const roleOption = roleOptions.find(opt => opt.value === role);
        return roleOption?.color || 'bg-gray-100 text-gray-800';
    };

    const exportUsers = () => {
        const csv = [
            ['Full Name', 'Email', 'Username', 'Role', 'Status', 'Created At'].join(','),
            ...filteredUsers.map(user => [
                user.fullName,
                user.email,
                user.username,
                user.role,
                user.isActive ? 'Active' : 'Inactive',
                new Date(user.createdAt).toLocaleDateString()
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'users.csv';
        a.click();
    };

    // ✅ NEW: OPEN COMPRESSION MODAL
    const handleOpenCompressionModal = async () => {
        try {
            setCompressionModal(prev => ({ ...prev, show: true, loading: true }));

            // ✅ FIX: Extract organization ID properly
            const orgId = typeof currentUser.organization === 'object'
                ? currentUser.organization._id || currentUser.organization
                : currentUser.organization;

            console.log('🔍 Fetching labs for organization:', orgId);

            // Fetch all labs with compression status
            // ✅ FIX: Remove apiKey from initial fetch (only needed for toggle operations)
            const response = await api.get('/compression/status-all', {
                params: {
                    organizationId: orgId
                }
            });

            if (response.data.success) {
                setCompressionModal(prev => ({
                    ...prev,
                    labs: response.data.data || [],
                    loading: false
                }));
            }
        } catch (error) {
            console.error('Error fetching labs:', error);
            toast.error('Failed to load labs. Please try again.');
            setCompressionModal(prev => ({ ...prev, show: false, loading: false }));
        }
    };

    // ✅ NEW: CLOSE COMPRESSION MODAL
    const handleCloseCompressionModal = () => {
        setCompressionModal({
            show: false,
            loading: false,
            labs: [],
            selectedLabs: [],
            searchTerm: '',
            apiKey: '',
            showApiKey: false,
            enableCompression: true
        });
    };

    // ✅ NEW: TOGGLE LAB SELECTION
    const handleToggleLabSelection = (labId) => {
        setCompressionModal(prev => ({
            ...prev,
            selectedLabs: prev.selectedLabs.includes(labId)
                ? prev.selectedLabs.filter(id => id !== labId)
                : [...prev.selectedLabs, labId]
        }));
    };

    // ✅ NEW: SELECT/DESELECT ALL LABS
    const handleSelectAllLabs = () => {
        const filteredLabs = getFilteredLabs();
        const allLabIds = filteredLabs.map(lab => lab.labId);
        setCompressionModal(prev => ({
            ...prev,
            selectedLabs: prev.selectedLabs.length === filteredLabs.length ? [] : allLabIds
        }));
    };

    // ✅ NEW: GET FILTERED LABS
    const getFilteredLabs = () => {
        if (!compressionModal.searchTerm) return compressionModal.labs;

        return compressionModal.labs.filter(lab =>
            lab.labName?.toLowerCase().includes(compressionModal.searchTerm.toLowerCase()) ||
            lab.labIdentifier?.toLowerCase().includes(compressionModal.searchTerm.toLowerCase())
        );
    };

    // ✅ NEW: APPLY COMPRESSION TOGGLE
    const handleApplyCompressionToggle = async () => {
        if (compressionModal.selectedLabs.length === 0) {
            toast.error('Please select at least one lab');
            return;
        }

        if (!compressionModal.apiKey || compressionModal.apiKey.trim() === '') {
            toast.error('Please enter the API key');
            return;
        }

        try {
            setCompressionModal(prev => ({ ...prev, loading: true }));

            // Use batch endpoint if multiple labs selected
            const response = compressionModal.selectedLabs.length === 1
                ? await api.post('/compression/toggle-single', {
                    labId: compressionModal.selectedLabs[0],
                    enable: compressionModal.enableCompression,
                    apiKey: compressionModal.apiKey
                })
                : await api.post('/compression/toggle-batch', {
                    labIds: compressionModal.selectedLabs,
                    enable: compressionModal.enableCompression,
                    apiKey: compressionModal.apiKey
                });

            if (response.data.success) {
                toast.success(response.data.message);
                handleCloseCompressionModal();
                // Optionally refresh the lab list
            } else {
                toast.error(response.data.message || 'Failed to toggle compression');
            }
        } catch (error) {
            console.error('Error toggling compression:', error);
            toast.error(error.response?.data?.message || 'Failed to toggle compression');
        } finally {
            setCompressionModal(prev => ({ ...prev, loading: false }));
        }
    };

    if (loading && !isEmbedded) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
            </div>
        );
    }

    return (
        // ✅ Remove min-h-screen + bg when embedded
        <div className={isEmbedded ? '' : 'min-h-screen bg-gray-50'}>
            {/* ✅ Only show Navbar when NOT embedded */}
            {!isEmbedded && <Navbar title="User Management" />}

            <div className={isEmbedded ? 'px-4 py-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
                {/* Header Section */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                            <p className="text-gray-600 mt-1">Manage users in your organization</p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <button
                                onClick={() => navigate('/admin/manage-labs')}
                                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
                            >
                                <Building2 className="w-4 h-4" />
                                Manage Labs
                            </button>
                            <button
                                onClick={handleOpenCompressionModal}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                            >
                                <Package className="w-4 h-4" />
                                Compression
                            </button>
                            <button
                                onClick={exportUsers}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                            <button
                                onClick={() => navigate('/admin/create-user')}
                                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center gap-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                Create User
                            </button>
                        </div>
                    </div>

                    {/* Search and Filter */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, email, or username..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="all">All Roles</option>
                            {roleOptions.map(role => (
                                <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Password</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                                <tr key={user._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                                <div className="text-xs text-gray-400">@{user.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                                            {roleOptions.find(r => r.value === user.role)?.label || user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleUserStatus(user._id, user.isActive)}
                                            className={`flex items-center space-x-2 px-3 py-1 rounded-full ${user.isActive
                                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                                                }`}
                                        >
                                            {user.isActive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                                            <span className="text-xs font-medium">
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type={showPasswords[user._id] ? "text" : "password"}
                                                value={user.tempPassword || '********'}
                                                readOnly
                                                className="text-sm bg-gray-50 border border-gray-200 rounded px-2 py-1 w-32"
                                            />
                                            <button
                                                onClick={() => handleTogglePassword(user._id)}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                {showPasswords[user._id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <button
                                                onClick={() => handleOpenEditModal(user)}
                                                className="text-blue-600 hover:text-blue-800"
                                            >
                                                <Edit className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteModal({ show: true, user })}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No users found
                        </div>
                    )}
                </div>

                {/* ✅ NEW: COMPRESSION TOGGLE MODAL */}
                {compressionModal.show && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
                            {/* Modal Header */}
                            <div className="flex justify-between items-center p-6 border-b border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <Package className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-gray-900">Compression Management</h3>
                                        <p className="text-sm text-gray-500">Toggle compression for labs</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCloseCompressionModal}
                                    disabled={compressionModal.loading}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {compressionModal.loading && compressionModal.labs.length === 0 ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader className="w-8 h-8 animate-spin text-purple-500" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Toggle Direction */}
                                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <div>
                                                    <div className="font-medium text-gray-900">Compression Action</div>
                                                    <div className="text-sm text-gray-600">
                                                        {compressionModal.enableCompression
                                                            ? 'Enable compression for selected labs'
                                                            : 'Disable compression for selected labs'}
                                                    </div>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={compressionModal.enableCompression}
                                                        onChange={(e) => setCompressionModal(prev => ({
                                                            ...prev,
                                                            enableCompression: e.target.checked
                                                        }))}
                                                        className="sr-only"
                                                    />
                                                    <div className={`block w-14 h-8 rounded-full transition ${compressionModal.enableCompression ? 'bg-purple-500' : 'bg-gray-300'
                                                        }`}></div>
                                                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${compressionModal.enableCompression ? 'transform translate-x-6' : ''
                                                        }`}></div>
                                                </div>
                                            </label>
                                        </div>

                                        {/* Search and Select All */}
                                        <div className="flex gap-3">
                                            <div className="flex-1 relative">
                                                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search labs..."
                                                    value={compressionModal.searchTerm}
                                                    onChange={(e) => setCompressionModal(prev => ({
                                                        ...prev,
                                                        searchTerm: e.target.value
                                                    }))}
                                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSelectAllLabs}
                                                className="px-4 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50"
                                            >
                                                {compressionModal.selectedLabs.length === getFilteredLabs().length
                                                    ? 'Deselect All'
                                                    : 'Select All'}
                                            </button>
                                        </div>

                                        {/* Selected Count */}
                                        {compressionModal.selectedLabs.length > 0 && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                                                <CheckCircle className="w-5 h-5 text-blue-600" />
                                                <span className="text-sm text-blue-800">
                                                    {compressionModal.selectedLabs.length} lab(s) selected
                                                </span>
                                            </div>
                                        )}

                                        {/* Labs List */}
                                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
                                            {getFilteredLabs().length === 0 ? (
                                                <div className="text-center py-8 text-gray-500">
                                                    No labs found
                                                </div>
                                            ) : (
                                                getFilteredLabs().map((lab) => (
                                                    <label
                                                        key={lab.labId}
                                                        className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={compressionModal.selectedLabs.includes(lab.labId)}
                                                                onChange={() => handleToggleLabSelection(lab.labId)}
                                                                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                                            />
                                                            <div>
                                                                <div className="font-medium text-gray-900">{lab.labName}</div>
                                                                <div className="text-sm text-gray-500">{lab.labIdentifier}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${lab.compressionEnabled
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                {lab.compressionEnabled ? 'Enabled' : 'Disabled'}
                                                            </span>
                                                        </div>
                                                    </label>
                                                ))
                                            )}
                                        </div>

                                        {/* API Key Input */}
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="font-medium text-gray-900">Security Verification Required</div>
                                                    <div className="text-sm text-gray-600">Enter the compression API key to proceed</div>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                                <input
                                                    type={compressionModal.showApiKey ? "text" : "password"}
                                                    placeholder="Enter API Key..."
                                                    value={compressionModal.apiKey}
                                                    onChange={(e) => setCompressionModal(prev => ({
                                                        ...prev,
                                                        apiKey: e.target.value
                                                    }))}
                                                    className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setCompressionModal(prev => ({
                                                        ...prev,
                                                        showApiKey: !prev.showApiKey
                                                    }))}
                                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                                >
                                                    {compressionModal.showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                                <button
                                    onClick={handleCloseCompressionModal}
                                    disabled={compressionModal.loading}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApplyCompressionToggle}
                                    disabled={compressionModal.loading || compressionModal.selectedLabs.length === 0 || !compressionModal.apiKey}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {compressionModal.loading ? (
                                        <>
                                            <Loader className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Apply Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit User Modal — Full-width adaptive layout */}
                {editModal.show && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2">
                        <div className="bg-white rounded-xl w-full max-w-[97vw] 2xl:max-w-[1680px] max-h-[96vh] flex flex-col shadow-2xl border border-gray-200/60">

                            {/* ─── HEADER ─── */}
                            <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                        {editModal.user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-semibold text-gray-900">Edit User</h3>
                                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getRoleColor(editModal.user?.role)}`}>
                                                {roleOptions.find(r => r.value === editModal.user?.role)?.label || editModal.user?.role}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">{editModal.user?.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCloseEditModal}
                                    disabled={editModal.loading}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* ─── BODY ─── */}
                            <div className="flex-1 overflow-hidden">
                                <div className={`grid h-full ${
                                    editModal.user?.role === 'verifier' ? 'grid-cols-1 lg:grid-cols-12' :
                                    editModal.user?.role === 'assignor' ? 'grid-cols-1 lg:grid-cols-12' :
                                    editModal.user?.role === 'lab_staff' ? 'grid-cols-1 lg:grid-cols-12' :
                                    'grid-cols-1 lg:grid-cols-10'
                                }`}>

                                    {/* ══════ COLUMN 1: User Details ══════ */}
                                    <div className={`${
                                        editModal.user?.role === 'verifier' ? 'lg:col-span-3' : 
                                        editModal.user?.role === 'assignor' ? 'lg:col-span-3' : 'lg:col-span-3'
                                    } px-5 py-4 overflow-y-auto border-r border-gray-100`}>
                                        <div className="flex items-center gap-1.5 mb-3">
                                            <User className="w-3.5 h-3.5 text-teal-600" />
                                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">User Details</h4>
                                        </div>
                                        <div className="space-y-2.5">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.fullName}
                                                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    value={editForm.email}
                                                    readOnly
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    New Password
                                                    <span className="ml-1 text-[10px] font-normal text-gray-400">(leave blank to keep)</span>
                                                </label>
                                                <input
                                                    type="password"
                                                    value={editForm.password}
                                                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                                    placeholder="••••••••"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-shadow"
                                                />
                                            </div>
                                        </div>

                                        {/* Report Verification (radiologist / lab_staff only) */}
                                        {(editModal.user?.role === 'radiologist' || editModal.user?.role === 'lab_staff') && (
                                            <div className="mt-4">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <Shield className="w-3.5 h-3.5 text-teal-600" />
                                                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Verification</h4>
                                                </div>
                                                <label className="flex items-center justify-between p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                                    <div className="pr-3">
                                                        <div className="text-xs font-medium text-gray-900">Require Verification</div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">Reports must be verified before completion</div>
                                                    </div>
                                                    <div className="relative flex-shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={editForm.requireReportVerification}
                                                            onChange={(e) => setEditForm({ ...editForm, requireReportVerification: e.target.checked })}
                                                            className="sr-only"
                                                        />
                                                        <div className={`block w-10 h-5 rounded-full transition ${editForm.requireReportVerification ? 'bg-teal-500' : 'bg-gray-300'}`}></div>
                                                        <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${editForm.requireReportVerification ? 'transform translate-x-5' : ''}`}></div>
                                                    </div>
                                                </label>
                                            </div>
                                        )}
                                    </div>

                                    {/* ══════ COLUMN 2: ASSIGNOR Lab Assignment ══════ */}
                                    {editModal.user?.role === 'assignor' && (
                                        <div className="lg:col-span-4 px-5 py-4 overflow-y-auto border-r border-gray-100">
                                            <div className="flex items-center gap-1.5 mb-3">
                                                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                                                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Lab Access Assignment</h4>
                                            </div>

                                            {editModal.loading ? (
                                                <div className="flex justify-center py-8">
                                                    <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {/* Lab Access Mode */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Access Mode</label>
                                                        <div className="grid grid-cols-3 gap-1.5">
                                                            {[
                                                                { value: 'all', icon: '🌐', label: 'All Labs' },
                                                                { value: 'selected', icon: '✅', label: 'Selected' },
                                                                { value: 'none', icon: '🚫', label: 'None' },
                                                            ].map(opt => (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => setEditForm(prev => ({ ...prev, labAccessMode: opt.value }))}
                                                                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all text-center ${
                                                                        editForm.labAccessMode === opt.value
                                                                            ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-sm'
                                                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                                                    }`}
                                                                >
                                                                    {opt.icon} {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Current mode summary */}
                                                    <div className={`rounded-lg px-3 py-2 text-[11px] border ${
                                                        editForm.labAccessMode === 'all' ? 'bg-green-50 border-green-200 text-green-800' :
                                                        editForm.labAccessMode === 'none' ? 'bg-red-50 border-red-200 text-red-800' :
                                                        'bg-teal-50 border-teal-200 text-teal-800'
                                                    }`}>
                                                        {editForm.labAccessMode === 'all' && '🌐 This assignor can see studies from ALL labs'}
                                                        {editForm.labAccessMode === 'none' && '🚫 This assignor has NO lab access'}
                                                        {editForm.labAccessMode === 'selected' && (
                                                            <span>✅ Assigned to <strong>{editForm.assignedLabs.length} lab(s)</strong>
                                                            {editForm.assignedLabs.length === 0 && <span className="text-amber-600 ml-1">⚠️ Select at least one lab below</span>}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Lab checklist — shown only for 'selected' mode */}
                                                    {editForm.labAccessMode === 'selected' && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <label className="text-xs font-medium text-gray-700">Select Labs</label>
                                                                    <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] rounded-full font-semibold">
                                                                        {editForm.assignedLabs.length} selected
                                                                    </span>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditForm(prev => ({
                                                                            ...prev,
                                                                            assignedLabs: availableLabs.map(l => (l._id || l.id).toString())
                                                                        }))}
                                                                        className="text-[10px] text-teal-600 hover:underline font-medium"
                                                                    >
                                                                        All
                                                                    </button>
                                                                    <span className="text-gray-300">|</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditForm(prev => ({ ...prev, assignedLabs: [] }))}
                                                                        className="text-[10px] text-red-500 hover:underline font-medium"
                                                                    >
                                                                        Clear
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[45vh] overflow-y-auto">
                                                                {availableLabs.length === 0 ? (
                                                                    <div className="p-4 text-xs text-gray-400 text-center">No labs found in organization</div>
                                                                ) : availableLabs.map(lab => {
                                                                    const labId = (lab._id || lab.id).toString();
                                                                    const isChecked = editForm.assignedLabs.includes(labId);
                                                                    return (
                                                                        <label key={labId} className={`flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors ${isChecked ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={() => handleToggleVerifierLab(labId)}
                                                                                className="w-3.5 h-3.5 text-teal-600 border-gray-300 rounded"
                                                                            />
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-xs font-medium text-gray-800 truncate">{lab.name}</div>
                                                                                <div className="text-[10px] text-gray-400">{lab.identifier}</div>
                                                                            </div>
                                                                            {isChecked && <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ══════ BILLING MODULES (lab_staff only) ══════ */}
                                    {editModal.user?.role === 'lab_staff' && (
                                        <div className="lg:col-span-4 px-5 py-4 overflow-y-auto border-r border-gray-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-1.5">
                                                    <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                                                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Billing Modules</h4>
                                                </div>
                                                <span className="text-[10px] text-gray-400">{selectedBillingModules.length} attached</span>
                                            </div>

                                            {availableBillingModules.length === 0 ? (
                                                <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center">
                                                    <p className="text-xs text-gray-400">No billing modules configured.</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="relative mb-2">
                                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search modules..."
                                                            value={billingModuleSearch}
                                                            onChange={(e) => setBillingModuleSearch(e.target.value)}
                                                            className="w-full pl-7 pr-2 py-1 border border-gray-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
                                                        {filteredBillingModules.map(mod => {
                                                            const isChecked = selectedBillingModules.includes(mod._id);
                                                            return (
                                                                <label key={mod._id} className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${isChecked ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                                                                    <input type="checkbox" checked={isChecked} onChange={() => handleToggleBillingModule(mod._id)} className="w-3 h-3 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
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
                                    )}

                                    {/* ══════ COLUMN 2: Verifier Assignments (verifier only) ══════ */}
                                    {editModal.user?.role === 'verifier' && (
                                        <div className="lg:col-span-4 px-5 py-4 overflow-y-auto border-r border-gray-100">
                                            <div className="flex items-center gap-1.5 mb-3">
                                                <Link2 className="w-3.5 h-3.5 text-teal-600" />
                                                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Verifier Assignments</h4>
                                            </div>

                                            {editModal.loading ? (
                                                <div className="flex justify-center py-8">
                                                    <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {/* Lab Access Mode */}
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1.5">Lab Access Mode</label>
                                                        <div className="grid grid-cols-3 gap-1.5">
                                                            {[
                                                                { value: 'all', icon: '🌐', label: 'All Labs' },
                                                                { value: 'selected', icon: '✅', label: 'Selected' },
                                                                { value: 'none', icon: '🚫', label: 'None' },
                                                            ].map(opt => (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => setEditForm(prev => ({ ...prev, labAccessMode: opt.value }))}
                                                                    className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all text-center ${
                                                                        editForm.labAccessMode === opt.value
                                                                            ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-sm'
                                                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                                                    }`}
                                                                >
                                                                    {opt.icon} {opt.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Assigned Labs & Radiologists — side by side */}
                                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                        {/* Assigned Labs */}
                                                        {editForm.labAccessMode === 'selected' && (
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                                    <Building2 className="w-3 h-3 text-teal-600" />
                                                                    <label className="text-xs font-medium text-gray-700">Labs</label>
                                                                    <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] rounded-full font-semibold">
                                                                        {editForm.assignedLabs.length}
                                                                    </span>
                                                                </div>
                                                                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 flex-1 max-h-[45vh] overflow-y-auto">
                                                                    {availableLabs.length === 0 ? (
                                                                        <div className="p-4 text-xs text-gray-400 text-center">No labs found</div>
                                                                    ) : availableLabs.map(lab => {
                                                                        const labId = (lab._id || lab.id).toString();
                                                                        const isChecked = editForm.assignedLabs.includes(labId);
                                                                        return (
                                                                            <label key={labId} className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors text-xs ${isChecked ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => handleToggleVerifierLab(labId)}
                                                                                    className="w-3.5 h-3.5 text-teal-600 border-gray-300 rounded"
                                                                                />
                                                                                <span className="text-xs font-medium text-gray-800 truncate flex-1">{lab.name}</span>
                                                                                {isChecked && <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />}
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Assigned Radiologists */}
                                                        <div className={`flex flex-col ${editForm.labAccessMode !== 'selected' ? 'xl:col-span-2' : ''}`}>
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <UserCheck className="w-3 h-3 text-indigo-600" />
                                                                <label className="text-xs font-medium text-gray-700">Radiologists</label>
                                                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-full font-semibold">
                                                                    {editForm.assignedRadiologists.length}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400">empty = all</span>
                                                            </div>
                                                            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 flex-1 max-h-[45vh] overflow-y-auto">
                                                                {availableRadiologists.length === 0 ? (
                                                                    <div className="p-4 text-xs text-gray-400 text-center">No radiologists found</div>
                                                                ) : availableRadiologists.map(rad => {
                                                                    const radId = (rad._id || rad.id).toString();
                                                                    const isChecked = editForm.assignedRadiologists.includes(radId);
                                                                    return (
                                                                        <label key={radId} className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={() => handleToggleVerifierRadiologist(radId)}
                                                                                className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded"
                                                                            />
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-xs font-medium text-gray-800 truncate">{rad.fullName}</div>
                                                                                <div className="text-[10px] text-gray-400 truncate">{rad.email}</div>
                                                                            </div>
                                                                            {isChecked && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Summary */}
                                                    <div className={`rounded-lg p-2 text-[11px] border ${
                                                        editForm.assignedRadiologists.length > 0 || editForm.labAccessMode !== 'all'
                                                            ? 'bg-teal-50 border-teal-200 text-teal-800'
                                                            : 'bg-gray-50 border-gray-200 text-gray-500'
                                                    }`}>
                                                        <strong>Summary:</strong>{' '}
                                                        Handles{' '}
                                                        <strong>
                                                            {editForm.assignedRadiologists.length > 0
                                                                ? `${editForm.assignedRadiologists.length} radiologist(s)`
                                                                : 'all radiologists'}
                                                        </strong>{' '}
                                                        from{' '}
                                                        <strong>
                                                            {editForm.labAccessMode === 'all'
                                                                ? 'all labs'
                                                                : editForm.labAccessMode === 'none'
                                                                    ? 'no labs'
                                                                    : `${editForm.assignedLabs.length} lab(s)`}
                                                        </strong>.
                                                        {editForm.labAccessMode === 'none' && (
                                                            <span className="ml-1 text-red-600 font-semibold">Verification disabled for unassigned labs.</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ══════ LAST COLUMN: Worklist Columns ══════ */}
                                    <div className={`${
                                        editModal.user?.role === 'verifier' ? 'lg:col-span-5' : 
                                        editModal.user?.role === 'assignor' ? 'lg:col-span-5' : 
                                        editModal.user?.role === 'lab_staff' ? 'lg:col-span-5' :
                                        'lg:col-span-7'
                                    } px-5 py-4 flex flex-col overflow-hidden`}>
                                        <div className="flex items-center gap-1.5 mb-3">
                                            <Columns3 className="w-3.5 h-3.5 text-teal-600" />
                                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Worklist Columns</h4>
                                            <span className="ml-auto text-[11px] text-gray-400 font-medium">
                                                {editForm.visibleColumns.length} selected
                                            </span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/30">
                                            <ColumnSelector
                                                selectedColumns={editForm.visibleColumns}
                                                onColumnToggle={handleColumnToggle}
                                                onSelectAll={handleSelectAllColumns}
                                                onClearAll={() => setEditForm({ ...editForm, visibleColumns: [] })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ─── FOOTER ─── */}
                            <div className="flex items-center justify-end gap-3 px-6 py-2.5 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
                                <button
                                    onClick={handleCloseEditModal}
                                    disabled={editModal.loading}
                                    className="px-4 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveUser}
                                    disabled={editModal.loading}
                                    className="px-5 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    {editModal.loading ? (
                                        <>
                                            <Loader className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {deleteModal.show && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md">
                            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete <strong>{deleteModal.user?.fullName}</strong>?
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setDeleteModal({ show: false, user: null })}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;