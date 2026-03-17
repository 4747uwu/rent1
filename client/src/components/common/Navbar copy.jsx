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
  Copy
} from 'lucide-react';
import StudyCopyModal from '../StudyCopy/StudyCopyModal';
import DoctorProfileModal from '../doctor/DoctorProfileModal'; // ✅ ADD THIS IMPORT
import ManualStudyCreator from '../admin/ManualStudyCreator'; // ✅ ADD THIS IMPORT

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
  const [showProfileModal, setShowProfileModal] = useState(false); // ✅ ADD THIS STATE
  const [showManualStudyModal, setShowManualStudyModal] = useState(false); // ✅ ADD THIS STATE

  const orgDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

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
  const canCreateManualStudy = ['admin','lab_staff'].includes(currentUser?.role);

  return (
    <>
      {/* ✅ COMPACT NAVBAR - Height reduced from 16 to 12 */}
      <nav className="bg-white border-b border-gray-300 shadow-sm sticky top-0 z-40">
        <div className="max-w-8xl mx-auto px-3">
          <div className="flex justify-between items-center h-12">
            
            {/* ✅ LEFT SECTION - Logo + Title */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
              
              {/* ✅ ADD: Bharat PACS Logo */}
              <div className="flex items-center space-x-2.5">
                <img 
                  src="/bharat.png" 
                  alt="Bharat PACS" 
                  className="h-8 w-8 object-contain"
                />
                <div className="hidden md:block">
                  <div className="flex items-center space-x-2">
                    <h1 className="text-lg font-bold text-black tracking-tight">{title}</h1>
                    {subtitle && (
                      <span className="text-xs text-gray-500 font-medium">• {subtitle}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ RIGHT SECTION - More compact */}
            <div className="flex items-center space-x-2">
              
              {/* ✅ ADD: PROFILE SETTINGS BUTTON - Show for doctors/radiologists */}
              {canAccessProfileModal && (
                <button
                  onClick={handleOpenProfileModal}
                  className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors bg-teal-600 text-white hover:bg-teal-700"
                  title="Profile Settings"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Profile</span>
                </button>
              )}

              {/* ✅ ADD: COPY STUDY BUTTON - Show for admin, assignor, super_admin */}
              {(['admin', 'assignor'].includes(currentUser?.role) || 
                currentUser?.accountRoles?.some(role => ['admin', 'assignor', 'super_admin'].includes(role))) && (
                <button
                  onClick={handleOpenCopyModal}
                  className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors bg-teal-600 text-white hover:bg-teal-700"
                  title="Copy Study to Organization"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Study</span>
                </button>
              )}

              {/* ✅ ADD: CREATE STUDY BUTTON - Show for admin, super_admin, lab_staff */}
              {canCreateManualStudy && (
                <button
                  onClick={handleOpenManualStudy}
                  className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors bg-gradient-to-r from-teal-600 to-green-600 text-white hover:from-teal-700 hover:to-green-700"
                  title="Create Manual Study"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Study</span>
                </button>
              )}

              {/* ✅ COMPACT ADDITIONAL ACTIONS */}
              {additionalActions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    action.variant === 'primary' 
                      ? 'bg-black text-white hover:bg-gray-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title={action.tooltip}
                >
                  {action.icon && <action.icon className="h-3.5 w-3.5" />}
                  <span>{action.label}</span>
                </button>
              ))}

              {/* ✅ COMPACT REFRESH BUTTON */}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}

              {/* ✅ COMPACT NOTIFICATIONS */}
              {notifications > 0 && (
                <button className="relative p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {notifications > 9 ? '9+' : notifications}
                  </span>
                </button>
              )}

              {/* ✅ COMPACT ORGANIZATION SELECTOR */}
              {showOrganizationSelector && (
                <div className="relative" ref={orgDropdownRef}>
                  <button
                    onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                    className="flex items-center space-x-1.5 bg-gray-100 border border-gray-300 rounded px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 transition-colors"
                    disabled={isLoading}
                  >
                    <Globe className="h-3.5 w-3.5 text-gray-500" />
                    <span className="hidden sm:block max-w-20 truncate">
                      {selectedOrgName}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showOrgDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Organization Dropdown */}
                  {showOrgDropdown && (
                    <div className="absolute right-0 mt-1 w-72 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                      <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search organizations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                          />
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto">
                        {/* Global Context */}
                        <button
                          onClick={() => handleOrganizationSwitch('global')}
                          className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                            (!currentOrganizationContext || currentOrganizationContext === 'global') ? 'bg-gray-50 border-r-2 border-black' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 bg-gray-100 rounded">
                              <Globe className="h-3.5 w-3.5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">Global Context</p>
                              <p className="text-xs text-gray-500">All Organizations</p>
                            </div>
                          </div>
                        </button>

                        {/* Organizations */}
                        {filteredOrganizations.map(org => (
                          <button
                            key={org._id}
                            onClick={() => handleOrganizationSwitch(org.identifier)}
                            className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${
                              currentOrganizationContext === org.identifier ? 'bg-gray-50 border-r-2 border-black' : ''
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="p-1.5 bg-blue-50 rounded">
                                <Building className="h-3.5 w-3.5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate text-sm">{org.displayName}</p>
                                <p className="text-xs text-gray-500 font-mono">{org.identifier}</p>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {org.status}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}

                        {filteredOrganizations.length === 0 && searchTerm && (
                          <div className="px-3 py-2.5 text-xs text-gray-500 text-center">
                            No organizations found
                          </div>
                        )}
                      </div>

                      {/* Create Organization Button */}
                      {onCreateOrganization && (
                        <div className="p-3 border-t border-gray-200">
                          <button 
                            onClick={() => {
                              onCreateOrganization();
                              setShowOrgDropdown(false);
                            }}
                            className="w-full flex items-center justify-center space-x-1.5 text-xs font-medium text-black hover:text-gray-700 py-1.5 hover:bg-gray-50 rounded transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Create New Organization</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ✅ COMPACT PROFILE DROPDOWN */}
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center space-x-2 bg-gray-100 border border-gray-300 rounded px-2.5 py-1.5 hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <div className="h-6 w-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {getInitials(currentUser?.fullName || 'User')}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-xs font-medium text-gray-900 truncate max-w-24">
                        {currentUser?.fullName}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown Menu */}
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    {/* User Info */}
                    <div className="p-3 border-b border-gray-200">
                      <div className="flex items-center space-x-2.5">
                        <div className="h-8 w-8 bg-black text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {getInitials(currentUser?.fullName || 'User')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate text-sm">{currentUser?.fullName}</p>
                          <p className="text-xs text-gray-600 truncate">{currentUser?.email}</p>
                          <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(currentUser?.role)}`}>
                            {currentUser?.role?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      {/* ✅ UPDATED: Profile Settings - Only show for doctors/radiologists */}
                      {canAccessProfileModal && (
                        <button 
                          onClick={handleOpenProfileModal}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors flex items-center space-x-2"
                        >
                          <User className="h-3.5 w-3.5" />
                          <span>Profile Settings</span>
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
                <h1 className="text-sm font-bold text-black">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-gray-600">{subtitle}</p>
                )}
              </div>
              
              {additionalActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                    action.variant === 'primary' 
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
    </>
  );
};

export default Navbar;