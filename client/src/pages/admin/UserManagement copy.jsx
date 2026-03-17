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
    Check,
    Package,      // ✅ NEW: For compression icon
    Lock,         // ✅ NEW: For API key icon
    CheckCircle,  // ✅ NEW: For success states
    AlertCircle,  // ✅ NEW: For warnings
    Loader        // ✅ NEW: For loading states
} from 'lucide-react';
import ColumnSelector from '../../components/common/ColumnSelector';
import { getDefaultColumnsForRole } from '../../constants/worklistColumns';
import api from '../../services/api';
import toast from 'react-hot-toast';

const UserManagement = () => {
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
        requireReportVerification: false
    });

    // ✅ NEW: Compression Modal State
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
        if (!currentUser || currentUser.role !== 'admin') {
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

    // ✅ OPEN EDIT MODAL
    const handleOpenEditModal = async (user) => {
        setEditModal({ show: true, user, loading: true });
        
        let requireVerification = false;
        
        try {
            // ✅ Fetch verification setting based on user role
            if (user.role === 'radiologist' && user._id) {
                // Fetch doctor profile to get the ID
                const response = await api.get(`/admin/admin-crud/doctors`);
                const doctors = response.data.data;
                const doctorProfile = doctors.find(doc => doc.userAccount?._id === user._id);
                
                if (doctorProfile) {
                    requireVerification = doctorProfile.requireReportVerification || false;
                    console.log('📋 [Edit Modal] Doctor verification:', requireVerification);
                }
            } else if (user.role === 'lab_staff' && user.lab) {
                // Fetch lab to get the ID
                const response = await api.get(`/admin/admin-crud/labs`);
                const labs = response.data.data;
                const labProfile = labs.find(lab => lab._id === user.lab);
                
                if (labProfile) {
                    requireVerification = labProfile.settings?.requireReportVerification || false;
                    console.log('📋 [Edit Modal] Lab verification:', requireVerification);
                }
            }
        } catch (error) {
            console.error('Error fetching verification settings:', error);
            toast.error('Failed to load verification settings');
        }
        
        setEditForm({
            fullName: user.fullName || '',
            email: user.email || '',
            password: '',
            visibleColumns: user.visibleColumns || [],
            requireReportVerification: requireVerification
        });
        
        setEditModal({ show: true, user, loading: false });
    };

    // ✅ CLOSE EDIT MODAL
    const handleCloseEditModal = () => {
        setEditModal({ show: false, user: null, loading: false });
        setEditForm({
            fullName: '',
            email: '',
            password: '',
            visibleColumns: [],
            requireReportVerification: false
        });
    };

    // ✅ SAVE USER CHANGES
    const handleSaveUser = async () => {
        try {
            setEditModal({ ...editModal, loading: true });
            
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
            } else if (editModal.user.role === 'lab_staff' && editModal.user.lab) {
                await api.put(`/admin/admin-crud/labs/${editModal.user.lab}`, {
                    'settings.requireReportVerification': editForm.requireReportVerification
                });
            }

            // ✅ Actually call the API to save user changes
            await api.put(`/admin/manage-users/${editModal.user._id}`, updateData);

            toast.success('User updated successfully!');
            handleCloseEditModal();
            fetchOrganizationUsers();
            
        } catch (error) {
            console.error('Error updating user:', error);
            toast.error(error.response?.data?.message || 'Failed to update user');
        } finally {
            setEditModal({ ...editModal, loading: false });
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar title="User Management" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                            <p className="text-gray-600 mt-1">Manage users in your organization</p>
                        </div>
                        <div className="flex gap-3">
                            {/* ✅ NEW: Compression Toggle Button */}
                            <button
                                onClick={handleOpenCompressionModal}
                                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                            >
                                <Package className="w-4 h-4" />
                                Compression
                            </button>
                            <button
                                onClick={exportUsers}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                            >
                                <Download className="w-4 h-4 inline mr-2" />
                                Export
                            </button>
                            <button
                                onClick={() => navigate('/admin/create-user')}
                                className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
                            >
                                <UserPlus className="w-4 h-4 inline mr-2" />
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
                                            className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                                                user.isActive 
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
                                                    <div className={`block w-14 h-8 rounded-full transition ${
                                                        compressionModal.enableCompression ? 'bg-purple-500' : 'bg-gray-300'
                                                    }`}></div>
                                                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                                                        compressionModal.enableCompression ? 'transform translate-x-6' : ''
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
                                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                                lab.compressionEnabled 
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

                {/* Edit User Modal */}
                {editModal.show && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
                            {/* Modal Header */}
                            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">Edit User</h3>
                                    <p className="text-sm text-gray-500">{editModal.user?.email}</p>
                                </div>
                                <button
                                    onClick={handleCloseEditModal}
                                    disabled={editModal.loading}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={editForm.fullName}
                                            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            New Password (leave blank to keep current)
                                        </label>
                                        <input
                                            type="password"
                                            value={editForm.password}
                                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                            placeholder="••••••••"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                                        />
                                    </div>
                                </div>

                                {/* Visible Columns */}
                                <div>
                                    <h4 className="text-sm font-medium text-gray-900 mb-4">
                                        Visible Columns ({editForm.visibleColumns.length} selected)
                                    </h4>
                                    <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                                        <ColumnSelector
                                            selectedColumns={editForm.visibleColumns}
                                            onColumnToggle={handleColumnToggle}
                                            onSelectAll={handleSelectAllColumns}
                                            onClearAll={() => setEditForm({ ...editForm, visibleColumns: [] })}
                                        />
                                    </div>
                                </div>

                                {/* Verification Toggle (for radiologist and lab_staff) */}
                                {(editModal.user?.role === 'radiologist' || editModal.user?.role === 'lab_staff') && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-4">Report Verification</h4>
                                        <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                                            <div>
                                                <div className="font-medium text-gray-900">Require Report Verification</div>
                                                <div className="text-sm text-gray-500">
                                                    All finalized reports must be verified before completion
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={editForm.requireReportVerification}
                                                    onChange={(e) => setEditForm({ ...editForm, requireReportVerification: e.target.checked })}
                                                    className="sr-only"
                                                />
                                                <div className={`block w-14 h-8 rounded-full transition ${editForm.requireReportVerification ? 'bg-teal-500' : 'bg-gray-300'}`}></div>
                                                <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${editForm.requireReportVerification ? 'transform translate-x-6' : ''}`}></div>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white">
                                <button
                                    onClick={handleCloseEditModal}
                                    disabled={editModal.loading}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveUser}
                                    disabled={editModal.loading}
                                    className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 flex items-center"
                                >
                                    {editModal.loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 mr-2" />
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