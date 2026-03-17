import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  Building, 
  Users, 
  Activity, 
  Settings, 
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Search,
  Filter
} from 'lucide-react';
import api from '../../services/api';
import Navbar from '../../components/common/Navbar';
import OrganizationForm from '../../components/superadmin/OrganizationForm';

const SuperAdminDashboard = () => {
  const { currentUser } = useAuth();

  const [organizations, setOrganizations] = useState([]);
  const [orgStats, setOrgStats] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOrganizations();
    loadOrgStats();
  }, []);

  const loadOrganizations = async () => {
    try {
      const response = await api.get('/superadmin/organizations');
      if (response.data.success) {
        setOrganizations(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    }
  };

  const loadOrgStats = async () => {
    try {
      const response = await api.get('/superadmin/organizations/stats');
      if (response.data.success) {
        setOrgStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load organization stats:', error);
    }
  };

  const handleRefresh = () => {
    loadOrganizations();
    loadOrgStats();
  };

  const handleCreateOrganization = () => {
    setFormData({
      name: '',
      identifier: '',
      displayName: '',
      companyType: 'hospital',
      adminEmail: '',
      adminPassword: '',
      adminFullName: '',
      contactInfo: {
        primaryContact: { name: '', email: '', phone: '', designation: '' },
        billingContact: { name: '', email: '', phone: '' },
        technicalContact: { name: '', email: '', phone: '' }
      },
      address: { street: '', city: '', state: '', zipCode: '', country: 'USA' },
      subscription: { plan: 'basic', maxUsers: 10, maxStudiesPerMonth: 1000, maxStorageGB: 100 },
      features: { aiAnalysis: false, advancedReporting: false, multiModalitySupport: true, cloudStorage: true, mobileAccess: true, apiAccess: false, whiteLabeling: false },
      compliance: { hipaaCompliant: false, dicomCompliant: true, hl7Integration: false, fda510k: false }
    });
    setFormErrors({});
    setShowCreateModal(true);
  };

  const handleEditOrganization = (org) => {
    setSelectedOrganization(org);
    setFormData({
      name: org.name,
      identifier: org.identifier,
      displayName: org.displayName,
      companyType: org.companyType,
      contactInfo: org.contactInfo || {},
      address: org.address || {},
      subscription: org.subscription || {},
      features: org.features || {},
      compliance: org.compliance || {},
      status: org.status,
      notes: org.notes || ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleDeleteOrganization = async (orgId) => {
    if (!window.confirm('Are you sure you want to deactivate this organization? This will deactivate all associated users and labs.')) {
      return;
    }

    try {
      const response = await api.delete(`/superadmin/organizations/${orgId}`);
      if (response.data.success) {
        handleRefresh();
      }
    } catch (error) {
      console.error('Failed to delete organization:', error);
      alert('Failed to delete organization');
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name?.trim()) errors.name = 'Organization name is required';
    if (!formData.identifier?.trim()) errors.identifier = 'Identifier is required';
    if (!formData.displayName?.trim()) errors.displayName = 'Display name is required';
    if (!formData.companyType) errors.companyType = 'Company type is required';

    if (showCreateModal) {
      if (!formData.adminEmail?.trim()) errors.adminEmail = 'Admin email is required';
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
      let response;
      if (showCreateModal) {
        response = await api.post('/superadmin/organizations', formData);
      } else {
        response = await api.put(`/superadmin/organizations/${selectedOrganization._id}`, formData);
      }

      if (response.data.success) {
        handleRefresh();
        setShowCreateModal(false);
        setShowEditModal(false);
        setSelectedOrganization(null);
      }
    } catch (error) {
      console.error('Failed to save organization:', error);
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert('Failed to save organization');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ✅ UPDATED: Define navbar actions with teal theme
  const navbarActions = [
    {
      label: 'Create Organization',
      icon: Plus,
      onClick: handleCreateOrganization,
      variant: 'primary',
      tooltip: 'Create new organization'
    }
  ];

  return (
    <div className="min-h-screen bg-teal-50"> {/* ✅ UPDATED: Teal background */}
      {/* ✅ UPDATED: Navbar with teal theme */}
      <Navbar
        title="Super Admin Dashboard"
        subtitle={`Welcome back, ${currentUser?.fullName}`}
        showOrganizationSelector={true}
        onCreateOrganization={handleCreateOrganization}
        onRefresh={handleRefresh}
        additionalActions={navbarActions}
        notifications={0}
        theme="admin" // ✅ UPDATED: Use admin theme for teal colors
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ✅ UPDATED: MINIMALIST STATS BAR with teal accents */}
        <div className="bg-white border border-teal-200 rounded-lg mb-6 px-6 py-4"> {/* ✅ UPDATED: Teal border */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-teal-100 rounded-lg"> {/* ✅ UPDATED: Teal bg */}
                  <Building className="h-4 w-4 text-teal-600" /> {/* ✅ UPDATED: Teal icon */}
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{orgStats?.total || 0}</div>
                  <div className="text-xs text-teal-600 uppercase tracking-wide font-medium">Total Organizations</div> {/* ✅ UPDATED: Teal text */}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{orgStats?.active || 0}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Active</div>
                </div>
              </div>
              
              {orgStats?.inactive > 0 && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{orgStats?.inactive}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Inactive</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all" // ✅ UPDATED: Teal hover
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={handleCreateOrganization}
                className="flex items-center space-x-2 bg-gradient-to-r from-teal-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-teal-700 hover:to-green-700 transition-all text-sm font-medium shadow-lg" // ✅ UPDATED: Teal gradient
              >
                <Plus className="h-4 w-4" />
                <span>New Organization</span>
              </button>
            </div>
          </div>
        </div>

        {/* ✅ UPDATED: MODERN SEARCH BAR with teal theme */}
        <div className="bg-white border border-teal-200 rounded-lg mb-6"> {/* ✅ UPDATED: Teal border */}
          <div className="px-6 py-4 border-b border-teal-100"> {/* ✅ UPDATED: Teal border */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-teal-800">Organizations</h2> {/* ✅ UPDATED: Teal title */}
                <p className="text-sm text-teal-600 mt-1">Manage all organizations in the system</p> {/* ✅ UPDATED: Teal subtitle */}
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-teal-400" /> {/* ✅ UPDATED: Teal icon */}
                  <input
                    type="text"
                    placeholder="Search organizations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-64 border border-teal-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all" // ✅ UPDATED: Teal focus
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ✅ UPDATED: MINIMALIST TABLE with teal accents */}
          <div className="overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-teal-100"> {/* ✅ UPDATED: Teal border */}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-teal-600 uppercase tracking-wider"> {/* ✅ UPDATED: Teal headers */}
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-teal-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-teal-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50"> {/* ✅ UPDATED: Teal dividers */}
                {filteredOrganizations.map((org) => (
                  <tr key={org._id} className="hover:bg-teal-25 transition-colors"> {/* ✅ UPDATED: Teal hover */}
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center"> {/* ✅ UPDATED: Teal bg */}
                            <Building className="h-4 w-4 text-teal-600" /> {/* ✅ UPDATED: Teal icon */}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{org.displayName}</div>
                          <div className="text-xs text-teal-600 font-mono">{org.identifier}</div> {/* ✅ UPDATED: Teal text */}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 capitalize">
                        {org.companyType?.replace('_', ' ')}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        org.status === 'active' 
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : org.status === 'inactive'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-gray-50 text-gray-700 border border-gray-200'
                      }`}>
                        {org.status}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-gray-900">
                        {org.stats?.activeUsers || 0}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-teal-700 capitalize font-medium"> {/* ✅ UPDATED: Teal text */}
                        {org.subscription?.plan || 'Basic'}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleEditOrganization(org)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all" // ✅ UPDATED: Teal hover
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrganization(org._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filteredOrganizations.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-4"> {/* ✅ UPDATED: Teal bg */}
                          <Building className="h-6 w-6 text-teal-400" /> {/* ✅ UPDATED: Teal icon */}
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations found</h3>
                        <p className="text-gray-500 mb-6 max-w-sm">
                          {searchTerm ? 'Try adjusting your search terms or clear the search to see all organizations.' : 'Get started by creating your first organization to manage users and studies.'}
                        </p>
                        {!searchTerm && (
                          <button
                            onClick={handleCreateOrganization}
                            className="flex items-center space-x-2 bg-gradient-to-r from-teal-600 to-green-600 text-white px-4 py-2 rounded-lg hover:from-teal-700 hover:to-green-700 transition-all text-sm font-medium shadow-lg" // ✅ UPDATED: Teal gradient
                          >
                            <Plus className="h-4 w-4" />
                            <span>Create Organization</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ✅ MODAL (pass theme to form) */}
      <OrganizationForm
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setSelectedOrganization(null);
          setFormData({});
          setFormErrors({});
        }}
        isEdit={showEditModal}
        formData={formData}
        setFormData={setFormData}
        formErrors={formErrors}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        theme="admin" // ✅ UPDATED: Pass teal theme
      />
    </div>
  );
};

export default SuperAdminDashboard;