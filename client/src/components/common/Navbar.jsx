import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  Globe,
  ChevronDown,
  Plus,
  Search,
  RefreshCw,
  LogOut,
  User,
  Settings,
  Building,
  Bell,
  Menu,
  X,
  Copy,
  Upload
} from 'lucide-react';
import StudyCopyModal from '../StudyCopy/StudyCopyModal';
import DoctorProfileModal from '../doctor/DoctorProfileModal';
import ManualStudyCreator from '../admin/ManualStudyCreator';
import SettingsModal from './SettingsModal';
import api from '../../services/api';

const Navbar = ({
  title,
  subtitle,
  showOrganizationSelector = false,
  onCreateOrganization,
  onRefresh,
  additionalActions = [],
  notifications = 0
}) => {
  const {
    currentUser,
    currentOrganizationContext,
    availableOrganizations,
    switchOrganization,
    logout
  } = useAuth();

  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); // ✅ ADD
  const [showManualStudyModal, setShowManualStudyModal] = useState(false); // ✅ ADD
  const [showSettingsModal, setShowSettingsModal] = useState(false); // ✅ ADD

  const orgDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const logoInputRef = useRef(null);

  // Org logo state
  const [orgLogoUrl, setOrgLogoUrl] = useState(null);

  // Fetch org logo when organization context changes
  useEffect(() => {
    let blobUrl = null;
    const fetchOrgLogo = async () => {
      // Reset to default when org switches
      setOrgLogoUrl(null);
      try {
        const res = await api.get('/admin/org-logo', { responseType: 'blob' });
        blobUrl = URL.createObjectURL(res.data);
        setOrgLogoUrl(blobUrl);
      } catch {
        // No custom logo for this org — will use default
        setOrgLogoUrl(null);
      }
    };
    fetchOrgLogo();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [currentOrganizationContext]);

  // Handle logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('logo', file);
      await api.post('/admin/org-logo/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Refresh logo
      const res = await api.get('/admin/org-logo', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setOrgLogoUrl(url);
    } catch (error) {
      console.error('Logo upload failed:', error);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target)) {
        setShowOrgDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOrganizationSwitch = async (orgIdentifier) => {
    setIsLoading(true);
    try {
      const success = await switchOrganization(orgIdentifier === 'global' ? null : orgIdentifier);
      if (success) {
        setShowOrgDropdown(false);
        onRefresh?.();
      }
    } catch (error) {
      console.error('Failed to switch organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleOpenCopyModal = () => {
    setShowCopyModal(true);
  };

  const handleCloseCopyModal = () => {
    setShowCopyModal(false);
  };

  const handleCopySuccess = () => {
    onRefresh?.();
  };

  const handleOpenProfileModal = () => {
    setShowProfileModal(true);
    setShowProfileDropdown(false); // Close dropdown when opening modal
  };

  const handleProfileSuccess = (updatedProfile) => {
    console.log('Profile updated:', updatedProfile);
    // Optionally refresh data if needed
    onRefresh?.();
  };

  const handleOpenManualStudy = () => {
    setShowManualStudyModal(true);
  };

  const handleCloseManualStudy = () => {
    setShowManualStudyModal(false);
  };

  const handleManualStudySuccess = (data) => {
    console.log('Manual study created:', data);
    setShowManualStudyModal(false);
    onRefresh?.();
  };

  const filteredOrganizations = availableOrganizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      'super_admin': 'bg-black text-white',
      'admin': 'bg-gray-800 text-white',
      'owner': 'bg-gray-700 text-white',
      'lab_staff': 'bg-gray-600 text-white',
      'doctor_account': 'bg-gray-500 text-white',
      'radiologist': 'bg-teal-600 text-white',
      'verifier': 'bg-purple-600 text-white',
      'typist': 'bg-blue-600 text-white'
    };
    return colors[role] || 'bg-gray-400 text-white';
  };

  const selectedOrgName = currentOrganizationContext === 'global' || !currentOrganizationContext
    ? 'Global'
    : availableOrganizations.find(org => org.identifier === currentOrganizationContext)?.displayName?.slice(0, 8) || currentOrganizationContext;

  const currentOrgName = currentOrganizationContext === 'global' || !currentOrganizationContext
    ? 'Global'
    : availableOrganizations.find(org => org.identifier === currentOrganizationContext)?.displayName || currentOrganizationContext;

  // ✅ CHECK IF USER CAN ACCESS PROFILE MODAL (doctors and radiologists)
  const canAccessProfileModal = ['doctor_account', 'radiologist'].includes(currentUser?.role);

  // ✅ CHECK IF USER CAN CREATE MANUAL STUDIES
  const canCreateManualStudy = ['admin', 'lab_staff'].includes(currentUser?.role);

  // ✅ ADD: Settings access check (same logic as Search.jsx)
  const role = (currentUser?.role || '').toString().toLowerCase();
  const hasSettingsAccess = ['admin', 'super_admin', 'group_id'].includes(role);

  return (
    <>
      {/* COMPACT NAVBAR */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-8xl mx-auto px-3">
          <div className="flex justify-between items-center h-10">

            {/* LEFT SECTION - Logo + Title */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {showMobileMenu ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
              </button>

              <div className="flex items-center space-x-2">
                <img
                  src={orgLogoUrl || '/rent.jpeg'}
                  alt="Radx1 Logo"
                  className="h-8 w-auto max-w-[80px] object-contain"
                />
                <div className="hidden md:block">
                  <div className="flex items-center space-x-1.5">
                    <h1 className="text-sm font-bold text-gray-900 tracking-tight">RADX1</h1>
                    <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
                      {title ? `· ${title}` : ''} {subtitle ? `- ${subtitle}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SECTION */}
            <div className="flex items-center gap-1">

              {canAccessProfileModal && (
                <button
                  onClick={handleOpenProfileModal}
                  className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
                  title="Profile Settings"
                >
                  <User className="h-3 w-3" />
                  <span>Profile</span>
                </button>
              )}


              {/* {(['admin', 'assignor'].includes(currentUser?.role) || 
                currentUser?.accountRoles?.some(role => ['admin', 'assignor', 'super_admin'].includes(role))) && (
                <button
                  onClick={handleOpenCopyModal}
                  className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
                  title="Copy Study to Organization"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy Study</span>
                </button>
              )} */}

              {canCreateManualStudy && (
                <button
                  onClick={handleOpenManualStudy}
                  className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
                  title="Create Manual Study"
                >
                  <Plus className="h-3 w-3" />
                  <span>Create Study</span>
                </button>
              )}

              {hasSettingsAccess && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
                  title="Open Settings"
                >
                  <Settings className="h-3 w-3" />
                  <span>Settings</span>
                </button>
              )}

              {additionalActions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`hidden md:flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors border ${action.variant === 'primary'
                      ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                      : 'text-gray-600 hover:bg-gray-100 border-gray-200'
                    }`}
                  title={action.tooltip}
                >
                  {action.icon && <action.icon className="h-3 w-3" />}
                  <span>{action.label}</span>
                </button>
              ))}

              {/* Refresh */}


              {notifications > 0 && (
                <button className="relative p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                  <Bell className="h-3.5 w-3.5" />
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold">
                    {notifications > 9 ? '9+' : notifications}
                  </span>
                </button>
              )}

              {/* Organization Selector */}

              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-100 focus:outline-none transition-colors"
                >
                  <div className="h-5 w-5 bg-gray-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                    {getInitials(currentUser?.fullName || 'User')}
                  </div>
                  <span className="hidden sm:block text-[11px] font-medium text-gray-900 truncate max-w-20">
                    {currentUser?.fullName?.split(' ')[0]}
                  </span>
                  <ChevronDown className={`h-2.5 w-2.5 text-gray-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown Menu */}
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="p-2.5 border-b border-gray-200">
                      <div className="flex items-center space-x-2">
                        <div className="h-7 w-7 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {getInitials(currentUser?.fullName || 'User')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate text-xs">{currentUser?.fullName}</p>
                          <p className="text-[11px] text-gray-500 truncate">{currentUser?.email}</p>
                          <span className={`inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${getRoleBadgeColor(currentUser?.role)}`}>
                            {currentUser?.role?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      {/* Profile Settings - Only show for doctors/radiologists */}
                      {canAccessProfileModal && (
                        <button
                          onClick={handleOpenProfileModal}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        >
                          <User className="h-3.5 w-3.5" />
                          <span>Profile Settings</span>
                        </button>
                      )}

                      {/* Upload Logo - admin only */}
                      {hasSettingsAccess && (
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload Logo</span>
                        </button>
                      )}

                      <button className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2">
                        <Settings className="h-3.5 w-3.5" />
                        <span>Account Settings</span>
                      </button>
                    </div>

                    <div className="border-t border-gray-200 py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-2"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ✅ COMPACT MOBILE MENU */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-3 py-2 space-y-2">
              <div>
                <h1 className="text-sm font-bold text-black">RADX1</h1>
                <p className="text-xs text-gray-600 font-medium">
                  {title ? `${title}` : 'Menu'} {subtitle ? `- ${subtitle}` : ''}
                </p>
              </div>

              {additionalActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${action.variant === 'primary'
                      ? 'bg-black text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {action.icon && <action.icon className="h-3.5 w-3.5" />}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-4 flex items-center space-x-2.5 shadow-lg">
            <RefreshCw className="animate-spin h-4 w-4 text-gray-600" />
            <span className="text-gray-700 font-medium text-sm">Switching context...</span>
          </div>
        </div>
      )}

      {/* ✅ ADD: Study Copy Modal */}
      <StudyCopyModal
        isOpen={showCopyModal}
        onClose={handleCloseCopyModal}
        bharatPacsId="" // Empty means user needs to input
        currentOrgName={currentOrgName}
        onSuccess={handleCopySuccess}
      />

      {/* ✅ ADD: Doctor Profile Modal */}
      {canAccessProfileModal && (
        <DoctorProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onSuccess={handleProfileSuccess}
        />
      )}

      {/* ✅ Manual Study Creator Modal */}
      <ManualStudyCreator
        isOpen={showManualStudyModal}
        onClose={handleCloseManualStudy}
        onSuccess={handleManualStudySuccess}
      />

      {/* Settings Modal */}
      {hasSettingsAccess && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onNavigate={(path) => { window.location.href = path; }}
          theme="default"
        />
      )}

      {/* Hidden file input for logo upload */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoUpload}
      />
    </>
  );
};

export default Navbar;