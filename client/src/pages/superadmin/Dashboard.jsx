import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Navbar from '../../components/common/Navbar';
import OrganizationForm from '../../components/superadmin/OrganizationForm';
import AdminDashboard from '../admin/Dashboard';
import {
  Building,
  Users,
  Database,
  Shield,
  Plus,
  RefreshCw,
  Search,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  ArrowLeft,
  Power,
  PowerOff
} from 'lucide-react';

const SuperAdminDashboard = () => {
  const { currentUser, switchOrganization } = useAuth();
  const navigate = useNavigate();

  // View state - 'list' or 'organization-dashboard'
  const [currentView, setCurrentView] = useState('list');
  const [selectedOrganizationForDashboard, setSelectedOrganizationForDashboard] = useState(null);

  // Organization list states
  const [organizations, setOrganizations] = useState([]);
  const [orgStats, setOrgStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentView === 'list') {
      loadOrganizations();
      loadOrgStats();
    }
  }, [currentView]);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/superadmin/organizations', {
        params: { 
          limit: 1000,
          search: searchTerm,
          status: filterStatus !== 'all' ? filterStatus : ''
        }
      });
      if (response.data.success) {
        setOrganizations(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgStats = async () => {
    try {
      const response = await api.get('/superadmin/organizations/stats');
      if (response.data.success) {
        setOrgStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleRefresh = () => {
    loadOrganizations();
    loadOrgStats();
  };

  const handleViewOrganizationDashboard = async (org, e) => {
    if (e) {
      e.stopPropagation();
    }
    
    try {
      await switchOrganization(org.identifier);
      setSelectedOrganizationForDashboard(org);
      setCurrentView('organization-dashboard');
    } catch (error) {
      console.error('Failed to switch organization:', error);
      alert('Failed to switch organization context');
    }
  };

  const handleBackToList = async () => {
    // Switch back to global context
    await switchOrganization('global');
    setSelectedOrganizationForDashboard(null);
    setCurrentView('list');
  };

  const handleCreateOrganization = () => {
    setFormData({
      name: '',
      displayName: '',
      companyType: 'hospital',
      contactInfo: {
        primaryContact: {
          name: '',
          email: '',
          phone: '',
          designation: ''
        }
      },
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      },
      features: {
        aiAnalysis: false,
        advancedReporting: false,
        multiModalitySupport: true,
        cloudStorage: true,
        mobileAccess: true,
        apiAccess: false,
        whiteLabeling: false
      },
      compliance: {
        hipaaCompliant: false,
        dicomCompliant: true,
        hl7Integration: false,
        fda510k: false
      },
      adminEmail: '',
      adminPassword: '',
      adminFullName: ''
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOrganization = async (org, e) => {
    e.stopPropagation();
    
    try {
      const response = await api.get(`/superadmin/organizations/${org._id}`);
      if (response.data.success) {
        const orgData = response.data.data;
        setFormData({
          _id: org._id,
          name: orgData.name,
          identifier: orgData.identifier,
          displayName: orgData.displayName,
          companyType: orgData.companyType,
          contactInfo: orgData.contactInfo || {},
          address: orgData.address || {},
          features: orgData.features || {},
          compliance: orgData.compliance || {},
          notes: orgData.notes || '',
          adminEmail: orgData.primaryAdmin?.email || '',
          adminPassword: orgData.primaryAdmin?.tempPassword || '',
          adminFullName: orgData.primaryAdmin?.fullName || ''
        });
        setFormErrors({});
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Failed to load organization details:', error);
      alert('Failed to load organization details');
    }
  };

  const handleToggleStatus = async (org, e) => {
    e.stopPropagation();
    
    const newStatus = org.status === 'active' ? 'inactive' : 'active';
    const confirmMessage = newStatus === 'inactive'
      ? 'Are you sure you want to deactivate this organization? This will deactivate all associated users, labs, and doctors.'
      : 'Are you sure you want to activate this organization?';
    
    if (!confirm(confirmMessage)) return;

    try {
      if (newStatus === 'inactive') {
        await api.delete(`/superadmin/organizations/${org._id}`);
      } else {
        await api.put(`/superadmin/organizations/${org._id}`, { status: 'active' });
      }
      loadOrganizations();
      loadOrgStats();
    } catch (error) {
      console.error('Failed to toggle organization status:', error);
      alert(error.response?.data?.message || 'Failed to update organization status');
    }
  };

  const handleDeleteOrganization = async (orgId, e) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to permanently deactivate this organization? This will deactivate all associated users, labs, and doctors.')) return;

    try {
      await api.delete(`/superadmin/organizations/${orgId}`);
      loadOrganizations();
      loadOrgStats();
    } catch (error) {
      console.error('Failed to delete organization:', error);
      alert(error.response?.data?.message || 'Failed to delete organization');
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name?.trim()) errors.name = 'Organization name is required';
    if (!formData.displayName?.trim()) errors.displayName = 'Display name is required';
    if (!formData.companyType) errors.companyType = 'Company type is required';
    
    if (!showEditModal) {
      if (!formData.adminEmail?.trim()) errors.adminEmail = 'Admin username is required';
      if (!formData.adminPassword?.trim()) errors.adminPassword = 'Admin password is required';
      if (!formData.adminFullName?.trim()) errors.adminFullName = 'Admin full name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (showEditModal) {
        await api.put(`/superadmin/organizations/${formData._id}`, formData);
      } else {
        await api.post('/superadmin/organizations', formData);
      }
      
      setShowCreateModal(false);
      setShowEditModal(false);
      loadOrganizations();
      loadOrgStats();
    } catch (error) {
      console.error('Failed to save organization:', error);
      alert(error.response?.data?.message || 'Failed to save organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || org.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Navbar actions for list view
  const listViewNavbarActions = [
    {
      label: 'Create Organization',
      icon: Plus,
      onClick: handleCreateOrganization,
      variant: 'primary',
      tooltip: 'Create new organization'
    },
    {
      label: 'Refresh',
      icon: RefreshCw,
      onClick: handleRefresh,
      variant: 'secondary',
      tooltip: 'Refresh data'
    }
  ];

  // Navbar actions for organization dashboard view
  const dashboardViewNavbarActions = [
    {
      label: 'Back to Organizations',
      icon: ArrowLeft,
      onClick: handleBackToList,
      variant: 'secondary',
      tooltip: 'Return to organization list'
    }
  ];

  // Render organization dashboard view
  if (currentView === 'organization-dashboard' && selectedOrganizationForDashboard) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar
          title={`${selectedOrganizationForDashboard.displayName} - Admin Dashboard`}
          subtitle={`Viewing as Super Admin • ${selectedOrganizationForDashboard.identifier}`}
          additionalActions={dashboardViewNavbarActions}
        />
        {/* Organization context banner */}
        <div className="bg-teal-600 text-white px-6 py-2 shadow-md">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building className="w-4 h-4" />
              <div>
                <p className="font-bold text-sm uppercase">ORGANIZATION: {selectedOrganizationForDashboard.name}</p>
                <p className="text-xs font-semibold text-teal-100">
                  {selectedOrganizationForDashboard.stats?.activeUsers || 0} USERS • 
                  {selectedOrganizationForDashboard.stats?.activeLabs || 0} LABS • 
                  {selectedOrganizationForDashboard.stats?.activeDoctors || 0} DOCTORS
                </p>
              </div>
            </div>
            <button
              onClick={handleBackToList}
              className="px-3 py-1.5 bg-white text-teal-600 rounded-lg hover:bg-teal-50 transition-colors font-bold text-xs flex items-center gap-2 uppercase"
            >
              <ArrowLeft className="w-3 h-3" />
              BACK
            </button>
          </div>
        </div>

        {/* Render the actual Admin Dashboard with full functionality */}
        <AdminDashboard isSuperAdminView={true} />
      </div>
    );
  }

  // Render organization list view
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        title="SUPER ADMIN DASHBOARD"
        subtitle="MANAGE ALL ORGANIZATIONS"
        additionalActions={listViewNavbarActions}
      />

      <div className="max-w-[1920px] mx-auto p-4 space-y-4">
        {/* Stats Overview - Compact */}
        {orgStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase">TOTAL ORGS</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{orgStats.totalOrganizations}</p>
                </div>
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-teal-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase">ACTIVE ORGS</p>
                  <p className="text-2xl font-bold text-green-600 mt-0.5">{orgStats.activeOrganizations}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase">TOTAL USERS</p>
                  <p className="text-2xl font-bold text-blue-600 mt-0.5">{orgStats.totalUsers}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase">TOTAL LABS</p>
                  <p className="text-2xl font-bold text-purple-600 mt-0.5">{orgStats.totalLabs}</p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search - Compact */}
        <div className="bg-white rounded-lg shadow p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="SEARCH ORGANIZATIONS..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs font-bold uppercase border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold uppercase border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="all">ALL STATUS</option>
                <option value="active">ACTIVE</option>
                <option value="inactive">INACTIVE</option>
                <option value="suspended">SUSPENDED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Organizations List - Compact & Clickable Rows */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                    ORGANIZATION
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                    ID
                  </th>
                  {/* <th className="px-4 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                    TYPE
                  </th> */}
                  <th className="px-4 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                    STATUS
                  </th>
                  
                  <th className="px-4 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      <p className="text-xs font-bold uppercase">LOADING...</p>
                    </td>
                  </tr>
                ) : filteredOrganizations.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      <Building className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs font-bold uppercase">NO ORGANIZATIONS FOUND</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrganizations.map((org) => (
                    <tr 
                      key={org._id} 
                      onClick={(e) => handleViewOrganizationDashboard(org, e)}
                      className="hover:bg-teal-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2">
                        <div>
                          <div className="font-bold text-sm text-gray-900 uppercase">{org.name}</div>
                          {/* <div className="text-xs text-gray-600 font-semibold uppercase">{org.displayName}</div> */}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 text-xs font-bold bg-gray-900 text-white rounded uppercase">
                          {org.identifier}
                        </span>
                      </td>
                      {/* <td className="px-4 py-2">
                        <span className="text-xs font-bold text-gray-900 uppercase">
                          {org.companyType.replace('_', ' ')}
                        </span>
                      </td> */}
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs font-bold rounded uppercase ${
                          org.status === 'active' ? 'bg-green-100 text-green-800' :
                          org.status === 'inactive' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {org.status}
                        </span>
                      </td>
                      
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <button
                                  onClick={(e) => handleToggleStatus(org, e)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                                    org.status === 'active'
                                      ? 'text-red-700 bg-red-50 hover:bg-red-100'
                                      : 'text-green-700 bg-green-50 hover:bg-green-100'
                                  }`}
                                  title={org.status === 'active' ? 'Deactivate' : 'Activate'}
                                >
                                  {org.status === 'active' ? 'DEACTIVATE' : 'ACTIVATE'}
                                </button>
                          <button
                            onClick={(e) => handleEditOrganization(org, e)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteOrganization(org._id, e)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Permanent Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <OrganizationForm
          isOpen={showCreateModal || showEditModal}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
          }}
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          isEditMode={showEditModal}
        />
      )}
    </div>
  );
};

export default SuperAdminDashboard;