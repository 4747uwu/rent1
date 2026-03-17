import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import WorklistTable from '../../components/common/WorklistTable/WorklistTable';
import ColumnConfigurator from '../../components/common/WorklistTable/ColumnConfigurator';
import api from '../../services/api';
import { RefreshCw, Plus, Shield, Database, Palette, CheckCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';
import { useNavigate } from 'react-router-dom';
// import FileText from 'react-icons/all';

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
                onClick={() => {
                  onSelectColor(preset);
                  onClose();
                }}
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

const Dashboard = (isSuperAdminView = false) => {
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
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilters, setSearchFilters] = useState({});
  const [currentView, setCurrentView] = useState('all');
  const [selectedStudies, setSelectedStudies] = useState([]);
  const [availableAssignees, setAvailableAssignees] = useState({ radiologists: [], verifiers: [] });
  const [headerColor, setHeaderColor] = useState(() => {
    const saved = localStorage.getItem('adminWorklistTableHeaderColor');
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
    reprint_need: 0
  });

  // Column configuration
  const getDefaultColumnConfig = () => ({
    checkbox: { visible: true, order: 1, label: 'Select' },
    bharatPacsId: { visible: true, order: 2, label: 'BP ID' },
    centerName: { visible: true, order: 3, label: 'Center' },
    patientName: { visible: true, order: 4, label: 'Patient Name' },
    patientId: { visible: true, order: 5, label: 'Patient ID' },
    ageGender: { visible: true, order: 6, label: 'Age/Sex' },
    modality: { visible: true, order: 7, label: 'Modality' },
    seriesCount: { visible: true, order: 8, label: 'Series' },
    accessionNumber: { visible: true, order: 9, label: 'Acc. No.' },
    referralDoctor: { visible: false, order: 10, label: 'Referral Dr.' },
    clinicalHistory: { visible: false, order: 11, label: 'History' },
    studyTime: { visible: true, order: 12, label: 'Study Time' },
    uploadTime: { visible: true, order: 13, label: 'Upload Time' },
    radiologist: { visible: true, order: 14, label: 'Radiologist' },
    caseStatus: { visible: true, order: 15, label: 'Status' },
    actions: { visible: true, order: 16, label: 'Actions' }
  });

  const [columnConfig, setColumnConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('adminWorklistColumnConfig');
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        return { ...getDefaultColumnConfig(), ...parsedConfig };
      }
    } catch (error) {
      console.warn('Error loading admin column config:', error);
    }
    return getDefaultColumnConfig();
  });

  useEffect(() => {
    try {
      localStorage.setItem('adminWorklistColumnConfig', JSON.stringify(columnConfig));
    } catch (error) {
      console.warn('Error saving admin column config:', error);
    }
  }, [columnConfig]);

  // ✅ CATEGORY-BASED ENDPOINT MAPPING
  const getApiEndpoint = useCallback(() => {
    switch (currentView) {
      case 'created': return '/admin/studies/category/created';
      case 'history_created': return '/admin/studies/category/history-created';
      case 'unassigned': return '/admin/studies/category/unassigned';
      case 'assigned': return '/admin/studies/category/assigned';
      case 'pending': return '/admin/studies/category/pending';
      case 'draft': return '/admin/studies/category/draft';
      case 'verification_pending': return '/admin/studies/category/verification-pending';
      case 'final': return '/admin/studies/category/final';
      case 'urgent': return '/admin/studies/category/urgent';
      case 'reprint_need': return '/admin/studies/category/reprint-need';
      default: return '/admin/studies';
    }
  }, [currentView]);

  // ✅ FETCH STUDIES BY CATEGORY
  // ✅ UPDATED: Fetch studies with pagination - FIX for recordsPerPage reset
  const fetchStudies = useCallback(async (filters = {}, page = null, limit = null) => {
    setLoading(true);
    setError(null);
    
    // ✅ CRITICAL: Use parameters if provided, otherwise use current state
    const requestPage = page !== null ? page : pagination.currentPage;
    const requestLimit = limit !== null ? limit : pagination.recordsPerPage;
    
    try {
      const endpoint = getApiEndpoint();
      const activeFilters = Object.keys(filters).length > 0 ? filters : searchFilters;
      
      const params = { 
        ...activeFilters,
        page: requestPage,
        limit: requestLimit
      };
      delete params.category;
    
      console.log('🔍 [Admin] Fetching studies:', {
        endpoint,
        requestPage,
        requestLimit,
        filters: params
      });
      
      const response = await api.get(endpoint, { params });
      
      if (response.data.success) {
        const rawStudies = response.data.data || [];
        const formattedStudies = formatStudiesForWorklist(rawStudies);
        setStudies(formattedStudies);
        
        // ✅ CRITICAL: Update pagination with response data but keep our requested values
        setPagination({
          currentPage: requestPage, // Use what we REQUESTED
          totalPages: response.data.pagination?.totalPages || 1,
          totalRecords: response.data.pagination?.totalRecords || 0,
          recordsPerPage: requestLimit, // Use what we REQUESTED
          hasNextPage: response.data.pagination?.hasNextPage || false,
          hasPrevPage: response.data.pagination?.hasPrevPage || false
        });
        
        console.log('✅ [Admin] Studies loaded:', {
          count: formattedStudies.length,
          page: requestPage,
          limit: requestLimit,
          total: response.data.pagination?.totalRecords
        });
      }
    } catch (err) {
      console.error('❌ [Admin] Error fetching studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, searchFilters, currentView]); // ✅ REMOVED pagination from dependencies

  // ✅ FETCH CATEGORY VALUES
  const fetchCategoryValues = useCallback(async (filters = {}) => {
    try {
      const params = Object.keys(filters).length > 0 ? filters : searchFilters;
      
      console.log('🔍 [Admin] Fetching category values with params:', params);
      
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
          reprint_need: response.data.reprint_need || 0
        });

        console.log('📊 [Admin] CATEGORY VALUES UPDATED:', response.data);
      }
    } catch (error) {
      console.error('Error fetching category values:', error);
      setCategoryValues({
        all: 0, created: 0, history_created: 0, unassigned: 0, assigned: 0,
        pending: 0, draft: 0, verification_pending: 0, final: 0, urgent: 0, reprint_need: 0
      });
    }
  }, [searchFilters]);

  // ✅ FETCH AVAILABLE ASSIGNEES
  const fetchAvailableAssignees = useCallback(async () => {
    try {
      const response = await api.get('/assigner/available-assignees');
      console.log(response)
      if (response.data.success) {
        setAvailableAssignees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching assignees:', error);
    }
  }, []);

  // ✅ INITIAL DATA FETCH - Load saved filters or use defaults
  useEffect(() => {
    // Try to load saved filters from localStorage
    const savedFilters = localStorage.getItem('adminDashboardFilters');
    
    let defaultFilters = {
      dateFilter: 'today',
      dateType: 'createdAt',
      modality: 'all',
      labId: 'all',
      priority: 'all'
    };
    
    // If saved filters exist, use them
    if (savedFilters) {
      try {
        defaultFilters = JSON.parse(savedFilters);
        console.log('📁 [Admin] Loaded saved filters:', defaultFilters);
      } catch (error) {
        console.warn('Error loading saved filters:', error);
      }
    }
    
    setSearchFilters(defaultFilters);
    fetchStudies(defaultFilters, 1, 50);
    fetchCategoryValues(defaultFilters);
    fetchAvailableAssignees();
  }, []); // ✅ Empty deps - only run once on mount

  // ✅ Save filters whenever they change
  useEffect(() => {
    if (Object.keys(searchFilters).length > 0) {
      try {
        localStorage.setItem('adminDashboardFilters', JSON.stringify(searchFilters));
        console.log('💾 [Admin] Saved filters to localStorage:', searchFilters);
      } catch (error) {
        console.warn('Error saving filters:', error);
      }
    }
  }, [searchFilters]);

  // ✅ FETCH STUDIES WHEN CURRENT VIEW CHANGES (SINGLE useEffect - Remove duplicate)
  useEffect(() => {
    // Skip if this is the initial mount (filters are empty)
    if (Object.keys(searchFilters).length === 0) {
      return;
    }
    
    console.log(`🔄 [Admin] currentView changed to: ${currentView}`);
    // ✅ Reset to page 1, keep current limit
    fetchStudies(searchFilters, 1, pagination.recordsPerPage);
  }, [currentView]); // ✅ Only depend on currentView, NOT fetchStudies

  // ✅ SIMPLIFIED: Handle page change
  const handlePageChange = useCallback((newPage) => {
    console.log(`📄 [Admin] Changing page: ${pagination.currentPage} -> ${newPage}`);
    
    // ✅ Just fetch with new page, keeping current limit
    fetchStudies(searchFilters, newPage, pagination.recordsPerPage);
  }, [fetchStudies, searchFilters, pagination.recordsPerPage]);

  // ✅ SIMPLIFIED: Handle records per page change
  const handleRecordsPerPageChange = useCallback((newLimit) => {
    console.log(`📊 [Admin] Changing limit: ${pagination.recordsPerPage} -> ${newLimit}`);
    
    // ✅ Fetch with new limit, reset to page 1
    fetchStudies(searchFilters, 1, newLimit);
  }, [fetchStudies, searchFilters]);

  // Handlers
  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 [Admin] NEW SEARCH:', searchParams);
    
    // ✅ FIX: Remove search key if it's empty
    const cleanedParams = { ...searchParams };
    if (!cleanedParams.search || cleanedParams.search.trim() === '') {
        delete cleanedParams.search;
    }
    
    setSearchFilters(cleanedParams);
    
    // ✅ Reset to page 1, keep current limit
    fetchStudies(cleanedParams, 1, pagination.recordsPerPage);
    fetchCategoryValues(cleanedParams);
}, [fetchStudies, fetchCategoryValues, pagination.recordsPerPage]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 [Admin] FILTER CHANGE:', filters);
    
    // ✅ FIX: Remove search key if it's empty
    const cleanedFilters = { ...filters };
    if (!cleanedFilters.search || cleanedFilters.search.trim() === '') {
        delete cleanedFilters.search;
    }
    
    setSearchFilters(cleanedFilters);
    
    // ✅ Reset to page 1, keep current limit
    fetchStudies(cleanedFilters, 1, pagination.recordsPerPage);
    fetchCategoryValues(cleanedFilters);
}, [fetchStudies, fetchCategoryValues, pagination.recordsPerPage]);
  
  // ✅ SIMPLIFIED: View change
  const handleViewChange = useCallback((view) => {
    console.log(`🔄 [Admin] VIEW CHANGE: ${currentView} -> ${view}`);
    setCurrentView(view);
    // Note: This will trigger the useEffect above
  }, [currentView]);

  const handleSelectAll = useCallback((checked) => {
    setSelectedStudies(checked ? studies.map(study => study._id) : []);
  }, [studies]);

  const handleSelectStudy = useCallback((studyId) => {
    setSelectedStudies(prev => 
      prev.includes(studyId) 
        ? prev.filter(id => id !== studyId) 
        : [...prev, studyId]
    );
  }, []);

  const handleRefresh = useCallback(() => {
    console.log('🔄 [Admin] Manual refresh');
    fetchStudies(searchFilters);
    fetchCategoryValues(searchFilters);
    fetchAvailableAssignees();
  }, [fetchStudies, fetchCategoryValues, fetchAvailableAssignees, searchFilters]);

  const handleCreateStudy = useCallback(() => {
    console.log('Create new study');
    toast.success('Study creation feature coming soon');
  }, []);

  const handleAssignmentSubmit = useCallback(async (assignmentData) => {
    try {
      const { study, assignedToIds, assigneeRole, priority, notes, dueDate } = assignmentData;
      
      console.log('🔄 [Admin] Submitting assignment:', {
        studyId: study._id,
        assignedToIds,
        assigneeRole,
        priority
      });
      
      const response = await api.post(`/assigner/update-study-assignments/${study._id}`, {
        assignedToIds,
        assigneeRole,
        priority,
        notes,
        dueDate
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchStudies(searchFilters);
        fetchCategoryValues(searchFilters);
      }
    } catch (error) {
      console.error('Admin assignment error:', error);
      toast.error(error.response?.data?.message || 'Failed to update assignments');
    }
  }, [fetchStudies, searchFilters, fetchCategoryValues]);

  const handleColumnChange = useCallback((columnKey, visible) => {
    setColumnConfig(prev => ({
      ...prev,
      [columnKey]: {
        ...prev[columnKey],
        visible
      }
    }));
  }, []);

  const handleResetColumns = useCallback(() => {
    const defaultConfig = getDefaultColumnConfig();
    setColumnConfig(defaultConfig);
  }, []);

  const handleUpdateStudyDetails = useCallback(async (formData) => {
    try {
      console.log('🔄 Updating study details:', formData);
      
      const response = await api.put(`/admin/studies/${formData.studyId}/details`, {
        patientName: formData.patientName,
        patientAge: formData.patientAge,
        patientGender: formData.patientGender,
        studyName: formData.studyName,
        referringPhysician: formData.referringPhysician,
        accessionNumber: formData.accessionNumber,
        clinicalHistory: formData.clinicalHistory
      });

      if (response.data.success) {
        toast.success('Study details updated successfully');
        fetchStudies(searchFilters);
        fetchCategoryValues(searchFilters);
      }
    } catch (error) {
      console.error('Error updating study details:', error);
      toast.error(error.response?.data?.message || 'Failed to update study details');
      throw error;
    }
  }, [fetchStudies, searchFilters, fetchCategoryValues]);

  const handleToggleStudyLock = useCallback(async (studyId, shouldLock) => {
    try {
      // Refresh studies after lock toggle
      await fetchStudies();
    } catch (error) {
      console.error('Lock toggle failed:', error);
    }
  }, [fetchStudies]);

    const handleSelectColor = useCallback((color) => {
    setHeaderColor(color);
    localStorage.setItem('adminWorklistTableHeaderColor', JSON.stringify(color));
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
      label: 'Templates',
      icon: FileText,
      onClick: () => navigate('/admin/templates'),
      variant: 'primary',
      tooltip: 'Manage organization templates'
    },
    {
      label: 'Admin Panel',
      icon: Shield,
      onClick: () => console.log('Open admin panel'),
      variant: 'primary',
      tooltip: 'Open admin panel'
    },
    {
      label: 'Create Study',
      icon: Plus,
      onClick: handleCreateStudy,
      variant: 'success',
      tooltip: 'Create a new study'
    },
    {
      label: 'Branding',
      icon: Palette,
      onClick: () => navigate('/admin/branding'),
      variant: 'secondary',
      tooltip: 'Configure report branding'
    }
  ];

  // ✅ UPDATED CATEGORY TABS - Compact & Modern with unified color
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
    { key: 'urgent', label: 'Urgent', count: categoryValues.urgent },
    { key: 'reprint_need', label: 'Reprint', count: categoryValues.reprint_need }
  ];

  return (
    <div className="h-screen bg-teal-50 flex flex-col">
      <Navbar
        title="Admin Dashboard"
        subtitle={`${currentOrganizationContext === 'global' ? 'Global View' : currentOrganizationContext || 'Organization View'} • PACS Administration`}
        showOrganizationSelector={true}
        onRefresh={handleRefresh}
        additionalActions={additionalActions}
        notifications={0}
        theme="admin"
      />
      
      <Search
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        loading={loading}
        totalStudies={categoryValues.all}
        currentCategory={currentView}
        theme="admin"
        initialFilters={searchFilters}
      />

      <div className="flex-1 min-h-0 p-0 px-0">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
          
          {/* ✅ COMPACT WORKLIST HEADER WITH MODERN CATEGORY TABS */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center space-x-3">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Admin Worklist
              </h2>
              <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                {studies.length} loaded
              </span>
              {selectedStudies.length > 0 && (
                <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-medium border border-teal-200">
                  {selectedStudies.length} selected
                </span>
              )}
            </div>

            {/* ✅ COMPACT MODERN CATEGORY TABS */}
            <div className="flex-1 mx-4 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1.5 min-w-max">
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleViewChange(tab.key)}
                    className={`group relative px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200 ${
                      currentView === tab.key
                        ? 'bg-teal-600 text-white shadow-md scale-[1.02]'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{tab.label}</span>
                      <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold transition-colors ${
                        currentView === tab.key 
                          ? 'bg-white text-teal-600' 
                          : 'bg-white text-slate-600'
                      }`}>
                        {tab.count}
                      </span>
                    </div>
                    
                    {/* Active indicator */}
                    {currentView === tab.key && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-white rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowColorPicker(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 border border-gray-300 rounded-lg transition-all shadow-sm"
                title="Change table header color"
              >
                <Palette className="w-4 h-4" />
                <span>Header Color</span>
              </button>
              <ColumnConfigurator
                columnConfig={columnConfig}
                onColumnChange={handleColumnChange}
                onResetToDefault={handleResetColumns}
                theme="admin"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <WorklistTable
              studies={studies}
              loading={loading}
              columnConfig={columnConfig}
              selectedStudies={selectedStudies}
              onSelectAll={handleSelectAll}
              onSelectStudy={handleSelectStudy}
              onPatienIdClick={(patientId, study) => console.log('Patient clicked:', patientId)}
              onAssignDoctor={(study) => console.log('Assign doctor:', study._id)}
              availableAssignees={availableAssignees}
              onAssignmentSubmit={handleAssignmentSubmit}
              onUpdateStudyDetails={handleUpdateStudyDetails}
              userRole={currentUser?.role || 'viewer'}
              userRoles={currentUser?.roles || []}
              onToggleStudyLock={handleToggleStudyLock}
              pagination={pagination}
              onPageChange={handlePageChange}
              onRecordsPerPageChange={handleRecordsPerPageChange}
              theme="admin"
              headerColor={headerColor} // ✅ NEW PROP
            />
          </div>
        </div>
      </div>

      {showColorPicker && (
        <HeaderColorPicker
          isOpen={showColorPicker}
          onClose={() => setShowColorPicker(false)}
          currentColor={headerColor}
          onSelectColor={handleSelectColor}
        />
      )}
    </div>
  );
};

export default Dashboard;