import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import api from '../../services/api';
import { RefreshCw, Plus, Shield, Database, Palette, CheckCircle, FileText, Users, UserPlus, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate as useNav } from 'react-router-dom';
import SettingsModal from '../../components/common/SettingsModal';
import UserManagement from '../admin/UserManagement';

const HEADER_COLOR_PRESETS = [
  { name: 'Dark Gray', gradient: 'from-gray-800 via-gray-900 to-black', textColor: 'text-white' },
  { name: 'Blue', gradient: 'from-blue-700 via-blue-800 to-blue-900', textColor: 'text-white' },
  { name: 'Green', gradient: 'from-green-700 via-green-800 to-green-900', textColor: 'text-white' },
  { name: 'Purple', gradient: 'from-purple-700 via-purple-800 to-purple-900', textColor: 'text-white' },
  { name: 'Red', gradient: 'from-red-700 via-red-800 to-red-900', textColor: 'text-white' },
  { name: 'Indigo', gradient: 'from-indigo-700 via-indigo-800 to-indigo-900', textColor: 'text-white' },
  { name: 'Teal', gradient: 'from-teal-700 via-teal-800 to-teal-900', textColor: 'text-white' },
  { name: 'Orange', gradient: 'from-orange-700 via-orange-800 to-orange-900', textColor: 'text-white' },
  { name: 'Pink', gradient: 'from-pink-700 via-pink-800 to-pink-900', textColor: 'text-white' },
  { name: 'Cyan', gradient: 'from-cyan-700 via-cyan-800 to-cyan-900', textColor: 'text-white' }
];

const HeaderColorPicker = ({ isOpen, onClose, currentColor, onSelectColor }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md border-2 border-gray-300">
        <div className="px-6 py-4 border-b-2 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            <h2 className="text-lg font-bold">Choose Header Color</h2>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            {HEADER_COLOR_PRESETS.map((preset, index) => (
              <button
                key={index}
                onClick={() => { onSelectColor(preset); onClose(); }}
                className={`relative px-4 py-3 rounded-lg transition-all border-2 ${
                  currentColor.name === preset.name
                    ? 'border-gray-900 scale-105 shadow-lg'
                    : 'border-gray-300 hover:border-gray-500'
                }`}
              >
                <div className={`h-8 rounded bg-gradient-to-r ${preset.gradient} flex items-center justify-center ${preset.textColor} text-sm font-bold`}>
                  {preset.name}
                </div>
                {currentColor.name === preset.name && (
                  <div className="absolute top-1 right-1 bg-white rounded-full p-0.5">
                    <CheckCircle className="w-4 h-4 text-green-600 fill-current" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const GroupIdDashboard = () => {
  const { currentUser, currentOrganizationContext } = useAuth();
  const navigate = useNavigate();

  // ✅ PAGINATION STATE - Single source of truth
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 50,
    hasNextPage: false,
    hasPrevPage: false
  });

  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilters, setSearchFilters] = useState({});
  const [currentView, setCurrentView] = useState('all');
  const [headerColor, setHeaderColor] = useState(() => {
    const saved = localStorage.getItem('groupIdWorklistTableHeaderColor');
    return saved ? JSON.parse(saved) : HEADER_COLOR_PRESETS[0];
  });
  const [showColorPicker, setShowColorPicker] = useState(false);

  // ✅ CATEGORY-BASED API VALUES
  const [categoryValues, setCategoryValues] = useState({
    all: 0,
    created: 0,
    history_created: 0,
    unassigned: 0,
    assigned: 0,
    pending: 0,
    draft: 0,
    verification_pending: 0,
    final: 0,
    urgent: 0,
    reprint_need: 0,
    reverted: 0
  });

  // ✅ FETCH CATEGORY VALUES
  const fetchCategoryValues = useCallback(async (filters = {}) => {
    try {
      const params = Object.keys(filters).length > 0 ? filters : searchFilters;
      console.log('🔍 [GroupId] Fetching category values with params:', params);
      const response = await api.get('/admin/category-values', { params });
      if (response.data.success) {
        setCategoryValues({
          all: response.data.all || 0,
          created: response.data.created || 0,
          history_created: response.data.history_created || 0,
          unassigned: response.data.unassigned || 0,
          assigned: response.data.assigned || 0,
          pending: response.data.pending || 0,
          draft: response.data.draft || 0,
          verification_pending: response.data.verification_pending || 0,
          final: response.data.final || 0,
          urgent: response.data.urgent || 0,
          reprint_need: response.data.reprint_need || 0,
          reverted: response.data.reverted || 0
        });
        console.log('📊 [GroupId] CATEGORY VALUES UPDATED:', response.data);
      }
    } catch (error) {
      console.error('Error fetching category values:', error);
      setCategoryValues({
        all: 0, created: 0, history_created: 0, unassigned: 0, assigned: 0,
        pending: 0, draft: 0, verification_pending: 0, final: 0, urgent: 0,
        reprint_need: 0, reverted: 0
      });
    }
  }, [searchFilters]);

  // ✅ INITIAL DATA FETCH
  useEffect(() => {
    const savedFilters = localStorage.getItem('groupIdDashboardFilters');
    let defaultFilters = {
      dateFilter: 'today',
      dateType: 'createdAt',
      modality: 'all',
      labId: 'all',
      priority: 'all'
    };
    if (savedFilters) {
      try {
        defaultFilters = JSON.parse(savedFilters);
        console.log('📁 [GroupId] Loaded saved filters:', defaultFilters);
      } catch (error) {
        console.warn('Error loading saved filters:', error);
      }
    }
    setSearchFilters(defaultFilters);
    fetchCategoryValues(defaultFilters);
  }, []);

  // ✅ Save filters whenever they change
  useEffect(() => {
    if (Object.keys(searchFilters).length > 0) {
      try {
        const filtersToSave = { ...searchFilters };
        delete filtersToSave.search;
        localStorage.setItem('groupIdDashboardFilters', JSON.stringify(filtersToSave));
        console.log('💾 [GroupId] Saved filters to localStorage:', filtersToSave);
      } catch (error) {
        console.warn('Error saving filters:', error);
      }
    }
  }, [searchFilters]);

  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 [GroupId] NEW SEARCH:', searchParams);
    const cleanedParams = { ...searchParams };
    if (!cleanedParams.search || cleanedParams.search.trim() === '') {
      delete cleanedParams.search;
    }
    setSearchFilters(cleanedParams);
    fetchCategoryValues(cleanedParams);
  }, [fetchCategoryValues]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 [GroupId] FILTER CHANGE:', filters);
    const cleanedFilters = { ...filters };
    if (!cleanedFilters.search || cleanedFilters.search.trim() === '') {
      delete cleanedFilters.search;
    }
    setSearchFilters(cleanedFilters);
    fetchCategoryValues(cleanedFilters);
  }, [fetchCategoryValues]);

  const handleViewChange = useCallback((view) => {
    console.log(`🔄 [GroupId] VIEW CHANGE: ${currentView} -> ${view}`);
    setCurrentView(view);
  }, [currentView]);

  const handleRefresh = useCallback(() => {
    console.log('🔄 [GroupId] Manual refresh');
    fetchCategoryValues(searchFilters);
  }, [fetchCategoryValues, searchFilters]);

  const handleSelectColor = useCallback((color) => {
    setHeaderColor(color);
    localStorage.setItem('groupIdWorklistTableHeaderColor', JSON.stringify(color));
    toast.success(`Header color changed to ${color.name}`, {
      duration: 2000,
      position: 'top-center'
    });
  }, []);

  const additionalActions = [
    {
      label: 'System Overview',
      icon: Database,
      onClick: () => navigate('/admin/system-overview'),
      variant: 'secondary',
      tooltip: 'View comprehensive system overview'
    },
    {
      label: 'User Management',
      icon: Shield,
      onClick: () => navigate('/admin/user-management'),
      variant: 'primary',
      tooltip: 'Manage users'
    },
    {
      label: 'Create User',
      icon: UserPlus,
      onClick: () => navigate('/admin/create-user'),
      variant: 'success',
      tooltip: 'Create a new user'
    },
    {
      label: 'Branding',
      icon: Palette,
      onClick: () => navigate('/admin/branding'),
      variant: 'secondary',
      tooltip: 'Configure report branding'
    }
  ];

  // ✅ CATEGORY TABS - identical to admin
  const categoryTabs = [
    { key: 'all', label: 'All', count: categoryValues.all },
    { key: 'created', label: 'Created', count: categoryValues.created },
    { key: 'history_created', label: 'History', count: categoryValues.history_created },
    { key: 'unassigned', label: 'Unassigned', count: categoryValues.unassigned },
    { key: 'assigned', label: 'Assigned', count: categoryValues.assigned },
    { key: 'pending', label: 'Pending', count: categoryValues.pending },
    { key: 'draft', label: 'Draft', count: categoryValues.draft },
    { key: 'verification_pending', label: 'Verify', count: categoryValues.verification_pending },
    { key: 'final', label: 'Final', count: categoryValues.final },
    { key: 'reverted', label: 'Reverted', count: categoryValues.reverted },
    { key: 'urgent', label: 'Urgent', count: categoryValues.urgent },
    { key: 'reprint_need', label: 'Reprint', count: categoryValues.reprint_need }
  ];

  // ✅ Group ID has no worklist — show settings modal as the main UI, not auto-open
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  return (
    <div className="h-screen bg-teal-50 flex flex-col">
      <Navbar
        title="Group ID Dashboard"
        subtitle={`${currentOrganizationContext === 'global' ? 'Global View' : currentOrganizationContext || 'Organization View'} • PACS Administration`}
        showOrganizationSelector={true}
        onRefresh={handleRefresh}
        additionalActions={additionalActions}
        notifications={0}
        theme="admin"
      />

      {/* ✅ Show UserManagement inline - fills the entire remaining space */}
      <div className="flex-1 min-h-0 overflow-auto">
        <UserManagement isEmbedded={true} />
      </div>
    </div>
  );
};

export default GroupIdDashboard;