import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import UnifiedWorklistTable from '../../components/common/WorklistTable/UnifiedWorklistTable.jsx';
import ColumnConfigurator from '../../components/common/WorklistTable/ColumnConfigurator';
import api from '../../services/api';
import { Building, Palette, Plus, Receipt } from 'lucide-react';
import ManualStudyCreator from '../../components/admin/ManualStudyCreator';
import toast from 'react-hot-toast';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';
import { useNavigate } from 'react-router-dom';
import { resolveUserVisibleColumns } from '../../utils/columnResolver';
import useVisibleColumns from '../../hooks/useVisibleColumns';



const LabDashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // ✅ RESOLVE VISIBLE COLUMNS ONCE

  const { visibleColumns, columnsLoading } = useVisibleColumns(currentUser);



  console.log('🎯 Lab Dashboard Visible Columns:', {
    total: visibleColumns.length,
    columns: visibleColumns,
    user: {
      primaryRole: currentUser?.primaryRole,
      accountRoles: currentUser?.accountRoles,
      visibleColumns: currentUser?.visibleColumns
    }
  });

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
  const [showManualStudyModal, setShowManualStudyModal] = useState(false);
  const [selectedStudies, setSelectedStudies] = useState([]);

  // ✅ CATEGORY VALUES - removed inprogress
  const [categoryValues, setCategoryValues] = useState({
    all: 0,
    pending: 0,
    completed: 0   // ✅ removed inprogress
  });

  // Column configuration
  const getDefaultColumnConfig = () => ({
    checkbox: { visible: false, order: 1, label: 'Select' },
    bharatPacsId: { visible: true, order: 2, label: 'BP ID' },
    centerName: { visible: true, order: 3, label: 'Center' },
    location: { visible: false, order: 4, label: 'Location' },
    timeline: { visible: true, order: 5, label: 'Timeline' },
    patientName: { visible: true, order: 6, label: 'Patient Name' },
    ageGender: { visible: true, order: 7, label: 'Age/Sex' },
    modality: { visible: true, order: 8, label: 'Modality' },
    viewOnly: { visible: true, order: 9, label: 'View' },
    reporting: { visible: false, order: 10, label: 'Reporting' },
    studySeriesImages: { visible: true, order: 11, label: 'Series' },
    patientId: { visible: true, order: 12, label: 'Patient ID' },
    referralDoctor: { visible: false, order: 13, label: 'Referral Dr.' },
    clinicalHistory: { visible: true, order: 14, label: 'History' },
    studyDateTime: { visible: true, order: 15, label: 'Study Time' },
    uploadDateTime: { visible: true, order: 16, label: 'Upload Time' },
    assignedRadiologist: { visible: true, order: 17, label: 'Radiologist' },
    studyLock: { visible: false, order: 18, label: 'Lock' },
    status: { visible: true, order: 19, label: 'Status' },
    printCount: { visible: true, order: 20, label: 'Print' },
    rejectionReason: { visible: false, order: 21, label: 'Rejection' },
    assignedVerifier: { visible: false, order: 22, label: 'Verifier' },
    verifiedDateTime: { visible: false, order: 23, label: 'Verified' },
    actions: { visible: true, order: 24, label: 'Actions' }
  });

  const [columnConfig, setColumnConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('labWorklistColumnConfig');
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        return { ...getDefaultColumnConfig(), ...parsedConfig };
      }
    } catch (error) {
      console.warn('Error loading lab column config:', error);
    }
    return getDefaultColumnConfig();
  });

  useEffect(() => {
    try {
      localStorage.setItem('labWorklistColumnConfig', JSON.stringify(columnConfig));
    } catch (error) {
      console.warn('Error saving lab column config:', error);
    }
  }, [columnConfig]);

  // ✅ ENDPOINT MAPPING - removed inprogress
  const getApiEndpoint = useCallback(() => {
    switch (currentView) {
      case 'pending': return '/lab/studies/pending';
      case 'completed': return '/lab/studies/completed';
      default: return '/lab/studies';   // ✅ all = no status filter
    }
  }, [currentView]);

  // ✅ FETCH STUDIES WITH PAGINATION (EXACT SAME AS ASSIGNOR)
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
      delete params.category; // ✅ Don't send category in params

      console.log('🔍 [Lab] Fetching studies:', {
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
          currentPage: requestPage,
          totalPages: response.data.pagination?.totalPages || 1,
          totalRecords: response.data.pagination?.totalRecords || 0,
          recordsPerPage: requestLimit,
          hasNextPage: response.data.pagination?.hasNextPage || false,
          hasPrevPage: response.data.pagination?.hasPrevPage || false
        });

        console.log('✅ [Lab] Studies loaded:', {
          count: formattedStudies.length,
          page: requestPage,
          limit: requestLimit,
          total: response.data.pagination?.totalRecords
        });
      }
    } catch (err) {
      console.error('❌ [Lab] Error fetching studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, searchFilters, currentView]); // ✅ REMOVED pagination from dependencies

  // ✅ FETCH CATEGORY VALUES (lab-specific)
  const fetchCategoryValues = useCallback(async (filters = {}) => {
    try {
      const params = Object.keys(filters).length > 0 ? filters : searchFilters;

      console.log('🔍 [Lab] Fetching category values with params:', params);

      const response = await api.get('/lab/values', { params });
      if (response.data.success) {
        setCategoryValues({
          all: response.data.total || 0,
          pending: response.data.pending || 0,
          completed: response.data.completed || 0   // ✅ removed inprogress
        });

        console.log('📊 [Lab] CATEGORY VALUES UPDATED:', response.data);
      }
    } catch (error) {
      console.error('Error fetching lab category values:', error);
      setCategoryValues({ all: 0, pending: 0, completed: 0 });
    }
  }, [searchFilters]);

  // ✅ INITIAL DATA FETCH WITH TODAY AS DEFAULT
  useEffect(() => {
    const defaultFilters = {
      dateFilter: 'today',
      dateType: 'createdAt',
      modality: 'all',
      priority: 'all'
    };

    setSearchFilters(defaultFilters);
    fetchStudies(defaultFilters, 1, 50);
    fetchCategoryValues(defaultFilters);
  }, []); // ✅ Empty deps - only run once on mount

  // ✅ FETCH STUDIES WHEN CURRENT VIEW CHANGES
  useEffect(() => {
    console.log(`🔄 [Lab] currentView changed to: ${currentView}`);
    // ✅ Reset to page 1, keep current limit
    fetchStudies(searchFilters, 1, pagination.recordsPerPage);
  }, [currentView]); // ✅ Only depend on currentView, NOT fetchStudies

  // ✅ SIMPLIFIED: Handle page change
  const handlePageChange = useCallback((newPage) => {
    console.log(`📄 [Lab] Changing page: ${pagination.currentPage} -> ${newPage}`);

    // ✅ Just fetch with new page, keeping current limit
    fetchStudies(searchFilters, newPage, pagination.recordsPerPage);
  }, [fetchStudies, searchFilters, pagination.recordsPerPage]);

  // ✅ SIMPLIFIED: Handle records per page change
  const handleRecordsPerPageChange = useCallback((newLimit) => {
    console.log(`📊 [Lab] Changing limit: ${pagination.recordsPerPage} -> ${newLimit}`);

    // ✅ Fetch with new limit, reset to page 1
    fetchStudies(searchFilters, 1, newLimit);
  }, [fetchStudies, searchFilters]);

  // Handlers
  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 [Lab] NEW SEARCH:', searchParams);
    setSearchFilters(searchParams);

    // ✅ Reset to page 1, keep current limit
    fetchStudies(searchParams, 1, pagination.recordsPerPage);
    fetchCategoryValues(searchParams);
  }, [fetchStudies, fetchCategoryValues, pagination.recordsPerPage]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 [Lab] FILTER CHANGE:', filters);
    setSearchFilters(filters);

    // ✅ Reset to page 1, keep current limit
    fetchStudies(filters, 1, pagination.recordsPerPage);
    fetchCategoryValues(filters);
  }, [fetchStudies, fetchCategoryValues, pagination.recordsPerPage]);

  // ✅ SIMPLIFIED: View change
  const handleViewChange = useCallback((view) => {
    console.log(`🔄 [Lab] VIEW CHANGE: ${currentView} -> ${view}`);
    setCurrentView(view);
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
    console.log('🔄 [Lab] Manual refresh');
    fetchStudies(searchFilters, pagination.currentPage, pagination.recordsPerPage);
    fetchCategoryValues(searchFilters);
  }, [fetchStudies, fetchCategoryValues, searchFilters, pagination.currentPage, pagination.recordsPerPage]);

  const handleUpdateStudyDetails = useCallback(async (formData) => {
    try {
      console.log('🔄 [Lab] Updating study details:', formData);

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
        fetchStudies(searchFilters, pagination.currentPage, pagination.recordsPerPage);
        fetchCategoryValues(searchFilters);
      }
    } catch (error) {
      console.error('Error updating study details:', error);
      toast.error(error.response?.data?.message || 'Failed to update study details');
      throw error;
    }
  }, [fetchStudies, searchFilters, fetchCategoryValues, pagination.currentPage, pagination.recordsPerPage]);

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

  // Check if user has lab access
  if (!currentUser?.lab) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Lab Access</h1>
          <p className="text-gray-600">You don't have access to any laboratory. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  const handleOpenManualStudy = () => setShowManualStudyModal(true);
  const handleCloseManualStudy = () => setShowManualStudyModal(false);
  const handleManualStudySuccess = (data) => {
    toast.success('Study created successfully!');
    setShowManualStudyModal(false);
    loadStudies();
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
      label: 'Billing',
      // icon: Receipt,
      onClick: () => navigate('/lab/billing'),
      variant: 'secondary',
      tooltip: 'View ongoing billing statements'
    },
    {
      label: 'Branding',
      icon: Palette,
      onClick: () => navigate('/lab/branding'),
      variant: 'secondary',
      tooltip: 'Configure report branding'
    }
  ];

  // ✅ CATEGORY TABS - removed inprogress
  const categoryTabs = [
    { key: 'all', label: 'All', count: categoryValues.all },
    { key: 'pending', label: 'Pending', count: categoryValues.pending },
    { key: 'completed', label: 'Completed', count: categoryValues.completed }
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Navbar
        title="Lab Dashboard"
        subtitle={`${currentUser.lab?.name || 'Lab'} • Study Management`}
        showOrganizationSelector={false}
        onRefresh={handleRefresh}
        additionalActions={additionalActions}
        notifications={0}
      />

      <Search
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        loading={loading}
        totalStudies={categoryValues.all}
        currentCategory={currentView}
        onRefresh={handleRefresh}

      />

      <div className="flex-1 min-h-0 p-0 px-0">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">

          <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Lab Worklist
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
              <ColumnConfigurator
                columnConfig={columnConfig}
                onColumnChange={handleColumnChange}
                onResetToDefault={handleResetColumns}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <UnifiedWorklistTable
              studies={studies}
              loading={loading}
              selectedStudies={selectedStudies}
              onSelectAll={handleSelectAll}
              onSelectStudy={handleSelectStudy}
              onPatienIdClick={(patientId, study) => console.log('Patient clicked:', patientId)}
              onUpdateStudyDetails={handleUpdateStudyDetails}
              pagination={pagination}
              onPageChange={handlePageChange}
              onRecordsPerPageChange={handleRecordsPerPageChange}
              // ✅ PASS RESOLVED COLUMNS
              visibleColumns={visibleColumns}
              columnConfig={columnConfig}
              userRole={currentUser?.primaryRole || currentUser?.role || 'lab_staff'}
              userRoles={currentUser?.accountRoles?.length > 0 ? currentUser?.accountRoles : [currentUser?.role || 'lab_staff']}
            />
          </div>
        </div>
      </div>

      <ManualStudyCreator
        isOpen={showManualStudyModal}
        onClose={handleCloseManualStudy}
        onSuccess={handleManualStudySuccess}
      />
    </div>
  );
};

export default LabDashboard;