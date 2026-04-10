import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import WorklistTable from '../../components/common/WorklistTable/WorklistTable';
import ColumnConfigurator from '../../components/common/WorklistTable/ColumnConfigurator';
import api from '../../services/api';
import { RefreshCw, Plus, Shield, Database, Palette, CheckCircle, FileText, DollarSign, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';
import { useNavigate } from 'react-router-dom';
import ManualStudyCreator from '../../components/admin/ManualStudyCreator';
// import FileText from 'react-icons/all';

const HEADER_COLOR_PRESETS = [
  { name: 'Dark Gray', gradient: 'from-gray-800 via-gray-900 to-black', textColor: 'text-white', css: 'linear-gradient(to right, #1f2937, #111827, #000000)' },
  { name: 'Blue', gradient: 'from-blue-700 via-blue-800 to-blue-900', textColor: 'text-white', css: 'linear-gradient(to right, #1d4ed8, #1e40af, #1e3a8a)' },
  { name: 'Green', gradient: 'from-green-700 via-green-800 to-green-900', textColor: 'text-white', css: 'linear-gradient(to right, #15803d, #166534, #14532d)' },
  { name: 'Purple', gradient: 'from-purple-700 via-purple-800 to-purple-900', textColor: 'text-white', css: 'linear-gradient(to right, #7e22ce, #6b21a8, #581c87)' },
  { name: 'Red', gradient: 'from-red-700 via-red-800 to-red-900', textColor: 'text-white', css: 'linear-gradient(to right, #b91c1c, #991b1b, #7f1d1d)' },
  { name: 'Indigo', gradient: 'from-indigo-700 via-indigo-800 to-indigo-900', textColor: 'text-white', css: 'linear-gradient(to right, #4338ca, #3730a3, #312e81)' },
  { name: 'Teal', gradient: 'from-teal-700 via-teal-800 to-teal-900', textColor: 'text-white', css: 'linear-gradient(to right, #0f766e, #115e59, #134e4a)' },
  { name: 'Orange', gradient: 'from-orange-700 via-orange-800 to-orange-900', textColor: 'text-white', css: 'linear-gradient(to right, #c2410c, #9a3412, #7c2d12)' },
  { name: 'Pink', gradient: 'from-pink-700 via-pink-800 to-pink-900', textColor: 'text-white', css: 'linear-gradient(to right, #be185d, #9d174d, #831843)' },
  { name: 'Cyan', gradient: 'from-cyan-700 via-cyan-800 to-cyan-900', textColor: 'text-white', css: 'linear-gradient(to right, #0e7490, #155e75, #164e63)' },
  { name: 'Amber', gradient: 'from-amber-700 via-amber-800 to-amber-900', textColor: 'text-white', css: 'linear-gradient(to right, #b45309, #92400e, #78350f)' },
  { name: 'Lime', gradient: 'from-lime-700 via-lime-800 to-lime-900', textColor: 'text-white', css: 'linear-gradient(to right, #4d7c0f, #3f6212, #365314)' },
  { name: 'Rose', gradient: 'from-rose-700 via-rose-800 to-rose-900', textColor: 'text-white', css: 'linear-gradient(to right, #be123c, #9f1239, #881337)' },
  { name: 'Slate', gradient: 'from-slate-600 via-slate-700 to-slate-800', textColor: 'text-white', css: 'linear-gradient(to right, #475569, #334155, #1e293b)' },
  { name: 'Emerald', gradient: 'from-emerald-700 via-emerald-800 to-emerald-900', textColor: 'text-white', css: 'linear-gradient(to right, #047857, #065f46, #064e3b)' },
  { name: 'Violet', gradient: 'from-violet-700 via-violet-800 to-violet-900', textColor: 'text-white', css: 'linear-gradient(to right, #6d28d9, #5b21b6, #4c1d95)' },
  { name: 'Sky', gradient: 'from-sky-600 via-sky-700 to-sky-800', textColor: 'text-white', css: 'linear-gradient(to right, #0284c7, #0369a1, #075985)' },
  { name: 'Fuchsia', gradient: 'from-fuchsia-700 via-fuchsia-800 to-fuchsia-900', textColor: 'text-white', css: 'linear-gradient(to right, #a21caf, #86198f, #701a75)' },
  { name: 'Zinc', gradient: 'from-zinc-600 via-zinc-700 to-zinc-800', textColor: 'text-white', css: 'linear-gradient(to right, #52525b, #3f3f46, #27272a)' },
  { name: 'Stone', gradient: 'from-stone-600 via-stone-700 to-stone-800', textColor: 'text-white', css: 'linear-gradient(to right, #57534e, #44403c, #292524)' },
];

const HeaderColorPicker = ({ isOpen, onClose, currentColor, onSelectColor }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10001]">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-900 text-white rounded-t-lg">
          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            <h2 className="text-xs font-semibold tracking-wide uppercase">Header Color</h2>
          </div>
          <button onClick={onClose} className="p-0.5 hover:bg-gray-700 rounded transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-4 gap-1.5">
            {HEADER_COLOR_PRESETS.map((preset, index) => (
              <button
                key={index}
                onClick={() => {
                  onSelectColor(preset);
                  onClose();
                }}
                className={`relative px-2 py-1.5 rounded-md transition-all border ${currentColor.name === preset.name
                    ? 'border-gray-900 ring-1 ring-gray-900/20 scale-[1.02] shadow-md'
                    : 'border-gray-200 hover:border-gray-400'
                  }`}
              >
                <div className={`h-6 rounded bg-gradient-to-r ${preset.gradient} flex items-center justify-center ${preset.textColor} text-[10px] font-semibold`}>
                  {preset.name}
                </div>
                {currentColor.name === preset.name && (
                  <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                    <CheckCircle className="w-3 h-3 text-gray-900 fill-current" />
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

const Dashboard = ({ isSuperAdminView = false }) => {
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
  const [showManualStudyModal, setShowManualStudyModal] = useState(false);
  const [queryCallNumber, setQueryCallNumber] = useState('');

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
    reverted: 0  // ✅ NEW
  });

  // Column configuration
  const getDefaultColumnConfig = () => ({
    selection: { visible: true, order: 1, label: 'Select' },
    bharatPacsId: { visible: true, order: 2, label: 'BP ID' },
    centerName: { visible: true, order: 3, label: 'Center' },
    location: { visible: true, order: 4, label: 'Location' },
    timeline: { visible: true, order: 5, label: 'Timeline' },
    patientName: { visible: true, order: 6, label: 'Patient Name' },
    ageGender: { visible: true, order: 7, label: 'Age/Sex' },
    modality: { visible: true, order: 8, label: 'Modality' },
    viewOnly: { visible: true, order: 9, label: 'View' },
    reporting: { visible: true, order: 10, label: 'Reporting' },
    seriesCount: { visible: true, order: 11, label: 'Series' },
    patientId: { visible: true, order: 12, label: 'Patient ID' },
    referralDoctor: { visible: true, order: 13, label: 'Referral Dr.' },
    clinicalHistory: { visible: true, order: 14, label: 'History' },
    studyTime: { visible: true, order: 15, label: 'Study Time' },
    uploadTime: { visible: true, order: 16, label: 'Upload Time' },
    radiologist: { visible: true, order: 17, label: 'Radiologist' },
    studyLock: { visible: true, order: 18, label: 'Lock/Unlock' },
    caseStatus: { visible: true, order: 19, label: 'Status' },
    printCount: { visible: true, order: 20, label: 'Print Report' },
    rejectionReason: { visible: true, order: 21, label: 'Reverted Reason' },
    assignedVerifier: { visible: true, order: 22, label: 'Finalised By' },
    verifiedDateTime: { visible: true, order: 23, label: 'Finalised Date/Time' },
    actions: { visible: true, order: 24, label: 'Actions' },
  });


  const [columnConfig, setColumnConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('adminColumn');
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
      localStorage.setItem('adminColumn', JSON.stringify(columnConfig));
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
      case 'reverted': return '/admin/studies/category/reverted';  // ✅ NEW
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
          reprint_need: response.data.reprint_need || 0,
          reverted: response.data.reverted || 0  // ✅ NEW
        });

        console.log('📊 [Admin] CATEGORY VALUES UPDATED:', response.data);
      }
    } catch (error) {
      console.error('Error fetching category values:', error);
      setCategoryValues({
        all: 0, created: 0, history_created: 0, unassigned: 0, assigned: 0,
        pending: 0, draft: 0, verification_pending: 0, final: 0, urgent: 0,
        reprint_need: 0, reverted: 0  // ✅ NEW
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
  // Line 318-327: Update the localStorage save to exclude search term
  useEffect(() => {
    if (Object.keys(searchFilters).length > 0) {
      try {
        // ✅ FIX: Don't save search term to localStorage
        const filtersToSave = { ...searchFilters };
        delete filtersToSave.search; // Remove search before saving

        localStorage.setItem('adminDashboardFilters', JSON.stringify(filtersToSave));
        console.log('💾 [Admin] Saved filters to localStorage (without search):', filtersToSave);
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


  const handleRefreshStudies = useCallback(() => {
    // Re-fetch studies from API
    fetchStudies();  // Your existing fetch function
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
        clinicalHistory: formData.clinicalHistory,
        caseType: formData.caseType,
        priority: formData.priority,
        assignmentPriority: formData.assignmentPriority
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

  const handleOpenManualStudy = () => {
    setShowManualStudyModal(true);
  };

  const additionalActions = [
    {
      label: 'Create Study',
      icon: Plus,
      onClick: handleOpenManualStudy,
      variant: 'primary',
      tooltip: 'Create Manual Study'
    },
    {
      label: 'Templates',
      icon: FileText,
      onClick: () => navigate('/admin/templates'),
      variant: 'secondary',
      tooltip: 'Manage organization templates'
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
    { key: 'reverted', label: 'Reverted', count: categoryValues.reverted },  // ✅ NEW
    { key: 'urgent', label: 'Urgent', count: categoryValues.urgent },
    { key: 'reprint_need', label: 'Reprint', count: categoryValues.reprint_need }
  ];

  const handleCloseManualStudy = () => {
    setShowManualStudyModal(false);
  };

  const handleManualStudySuccess = (data) => {
    console.log('Manual study created:', data);
    toast.success('Study created successfully!');
    setShowManualStudyModal(false);
    loadStudies(); // Reload the studies list
  };

  const navbarActions = useMemo(() => {
    const actions = [];

    // Add Create Study action
    // if (['admin', 'super_admin', 'lab_staff'].includes(currentUser?.role)) {
    //   actions.push({
    //     label: 'Create Study',
    //     icon: Plus,
    //     onClick: handleOpenManualStudy,
    //     variant: 'primary',
    //     tooltip: 'Create Manual Study'
    //   });
    // }

    // Add User Management action
    if (['admin', 'super_admin'].includes(currentUser?.role)) {
      actions.push({
        label: 'User Management',
        icon: Shield,
        onClick: () => navigate('/admin/user-management'),
        variant: 'secondary',
        tooltip: 'Manage Users'
      });
    }

    // Add Branding Settings action
    if (['admin', 'super_admin'].includes(currentUser?.role)) {
      actions.push({
        label: 'Branding',
        icon: Palette,
        onClick: () => navigate('/admin/branding'),
        variant: 'secondary',
        tooltip: 'Branding Settings'
      });
    }

    // Add Data Extraction action
    if (['admin', 'super_admin'].includes(currentUser?.role)) {
      actions.push({
        label: 'System Overview',
        icon: Database,
        onClick: () => navigate('/admin/system-overview'),
        variant: 'secondary',
        tooltip: 'System Overview'
      });
    }

    // ✅ Add Billing Modules action
    if (['admin', 'super_admin'].includes(currentUser?.role)) {
      actions.push({
        label: 'Billing Modules',
        icon: DollarSign,
        onClick: () => navigate('/admin/billing-modules'),
        variant: 'secondary',
        tooltip: 'Manage Billing Modules'
      });
    }

    return actions;
  }, [currentUser?.role, navigate]);

  // Fetch query call number on mount
  useEffect(() => {
    const fetchQueryNumber = async () => {
      try {
        const res = await api.get('/admin/org-settings/query-number');
        if (res.data.success) setQueryCallNumber(res.data.queryCallNumber || '');
      } catch { }
    };
    fetchQueryNumber();
  }, []);

  const handleQueryCallNumberChange = async (number) => {
    try {
      await api.put('/admin/org-settings/query-number', { queryCallNumber: number });
      setQueryCallNumber(number);
    } catch (error) {
      console.error('Failed to update query call number:', error);
    }
  };

  return (
    <div className={`${isSuperAdminView ? 'h-full' : 'h-screen'} bg-gray-50 flex flex-col`}>
      {/* ✅ Only show navbar if NOT in super admin view */}
      {!isSuperAdminView && (
        <Navbar
          title="Admin Dashboard"
          subtitle={`${currentOrganizationContext === 'global' ? 'Global View' : currentOrganizationContext || 'Organization View'} • PACS Administration`}
          showOrganizationSelector={true}
          onRefresh={handleRefresh}
          additionalActions={additionalActions}
          notifications={0}
          theme="admin"
        />
      )}

      <Search
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        loading={loading}
        totalStudies={categoryValues.all}
        currentCategory={currentView}
        theme="admin"
        initialFilters={searchFilters}
        onRefresh={handleRefresh}
      />

      <div className="flex-1 min-h-0 p-0 px-0">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">

          {/* COMPACT WORKLIST HEADER */}
          <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                title="Go back"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <h2 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Admin Worklist
              </h2>
              <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                {studies.length} loaded
              </span>
              {selectedStudies.length > 0 && (
                <span className="text-[10px] text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded font-medium border border-gray-200">
                  {selectedStudies.length} selected
                </span>
              )}
            </div>

            {/* COMPACT B&W CATEGORY TABS */}
            <div className="flex-1 mx-3 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1 min-w-max">
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => handleViewChange(tab.key)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${currentView === tab.key
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{tab.label}</span>
                      <span className={`min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[8px] font-bold ${currentView === tab.key
                          ? 'bg-white text-gray-900'
                          : 'bg-white text-gray-500'
                        }`}>
                        {tab.count}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowColorPicker(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium bg-white hover:bg-gray-50 border border-gray-200 rounded transition-colors"
                title="Change table header color"
              >
                <Palette className="w-3 h-3 text-gray-500" />
                <span className="hidden sm:inline text-gray-600">Color</span>
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
              onRefreshStudies={handleRefresh}  // ✅ PASS THIS

              headerColor={headerColor}
              queryCallNumber={queryCallNumber}
              onQueryCallNumberChange={handleQueryCallNumberChange}
              isAdmin={true}
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
      {/* ✅ Manual Study Creator Modal */}
      <ManualStudyCreator
        isOpen={showManualStudyModal}
        onClose={handleCloseManualStudy}
        onSuccess={handleManualStudySuccess}
      />
    </div>
  );
};

export default Dashboard;