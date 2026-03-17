import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle2, Edit3, RotateCcw, XCircle, UserPlus } from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import UnifiedWorklistTable from '../../components/common/WorklistTable/UnifiedWorklistTable';
import ColumnConfigurator from '../../components/common/WorklistTable/ColumnConfigurator';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';

// ✅ UTILITY: Resolve visible columns from user object
const resolveUserVisibleColumns = (user) => {
  if (!user) return [];
  if (user.visibleColumns && Array.isArray(user.visibleColumns)) {
    return user.visibleColumns;
  }
  return [];
};

const TypistDashboard = () => {
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

  // ✅ CATEGORY-BASED API VALUES (3 categories for typist)
  const [categoryValues, setCategoryValues] = useState({
    all: 0,
    pending: 0,
    typed: 0
  });

  // ✅ COMPUTE visible columns from user
  const visibleColumns = useMemo(() => {
    return resolveUserVisibleColumns(currentUser);
  }, [currentUser?.visibleColumns, currentUser?.accountRoles, currentUser?.primaryRole]);

  // ✅ GET USER ROLES for UnifiedWorklistTable
  const userRoles = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.accountRoles && Array.isArray(currentUser.accountRoles)) {
      return currentUser.accountRoles;
    }
    if (currentUser.role) {
      return [currentUser.role];
    }
    return [];
  }, [currentUser?.accountRoles, currentUser?.role]);

  // ✅ COLUMN CONFIGURATION
  const getDefaultColumnConfig = () => ({
    checkbox: { visible: false, order: 1, label: 'Select' },
    bharatPacsId: { visible: true, order: 2, label: 'BP ID' },
    centerName: { visible: true, order: 3, label: 'Center' },
    patientName: { visible: true, order: 4, label: 'Patient Name' },
    patientId: { visible: true, order: 5, label: 'Patient ID' },
    ageGender: { visible: true, order: 6, label: 'Age/Sex' },
    modality: { visible: true, order: 7, label: 'Modality' },
    seriesCount: { visible: true, order: 8, label: 'Series' },
    accessionNumber: { visible: false, order: 9, label: 'Acc. No.' },
    referralDoctor: { visible: true, order: 10, label: 'Referral Dr.' },
    clinicalHistory: { visible: true, order: 11, label: 'History' },
    studyTime: { visible: true, order: 12, label: 'Study Time' },
    uploadTime: { visible: true, order: 13, label: 'Upload Time' },
    radiologist: { visible: false, order: 14, label: 'Radiologist' },
    caseStatus: { visible: true, order: 15, label: 'Status' },
    actions: { visible: true, order: 16, label: 'Actions' }
  });

  const [columnConfig, setColumnConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('typistWorklistColumnConfig');
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        return { ...getDefaultColumnConfig(), ...parsedConfig };
      }
    } catch (error) {
      console.warn('Error loading column config:', error);
    }
    return getDefaultColumnConfig();
  });

  useEffect(() => {
    try {
      localStorage.setItem('typistWorklistColumnConfig', JSON.stringify(columnConfig));
    } catch (error) {
      console.warn('Error saving column config:', error);
    }
  }, [columnConfig]);

  // ✅ CATEGORY-BASED ENDPOINT MAPPING
  const getApiEndpoint = useCallback(() => {
    switch (currentView) {
      case 'pending': return '/typist/studies/pending';
      case 'typed': return '/typist/studies/typed';
      default: return '/typist/studies';
    }
  }, [currentView]);

  // ✅ FETCH STUDIES WITH PAGINATION
  const fetchStudies = useCallback(async (filters = {}, page = null, limit = null) => {
    setLoading(true);
    setError(null);

    const requestPage = page !== null ? page : pagination.currentPage;
    const requestLimit = limit !== null ? limit : pagination.recordsPerPage;

    try {
      const endpoint = getApiEndpoint();
      const activeFilters = filters && Object.keys(filters).length > 0 ? filters : searchFilters;

      const params = {
        ...activeFilters,
        page: requestPage,
        limit: requestLimit
      };

      console.log('🔍 TYPIST: Fetching studies from:', endpoint, 'with params:', params);

      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        const rawStudies = response.data.data || [];
        const formattedStudies = formatStudiesForWorklist(rawStudies);
        console.log('✅ TYPIST: Formatted studies:', {
          raw: rawStudies.length,
          formatted: formattedStudies.length,
          sample: formattedStudies[0]
        });

        setStudies(formattedStudies);

        setPagination({
          currentPage: requestPage,
          totalPages: response.data.pagination?.totalPages || 1,
          totalRecords: response.data.pagination?.totalRecords || 0,
          recordsPerPage: requestLimit,
          hasNextPage: response.data.pagination?.hasNextPage || false,
          hasPrevPage: response.data.pagination?.hasPrevPage || false
        });
      }
    } catch (err) {
      console.error('❌ Error fetching typist studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, searchFilters, currentView]);

  // ✅ FETCH CATEGORY VALUES
  const fetchCategoryValues = useCallback(async (filters = {}) => {
    try {
      const params = filters && Object.keys(filters).length > 0 ? filters : searchFilters;
      console.log('🔍 TYPIST ANALYTICS: Fetching with params:', params);

      const response = await api.get('/typist/values', { params });
      if (response.data.success) {
        setCategoryValues({
          all: response.data.total || 0,
          pending: response.data.pending || 0,
          typed: response.data.typed || 0
        });

        console.log('✅ TYPIST ANALYTICS:', {
          all: response.data.total,
          pending: response.data.pending,
          typed: response.data.typed
        });
      }
    } catch (error) {
      console.error('Error fetching typist analytics:', error);
      setCategoryValues({ all: 0, pending: 0, typed: 0 });
    }
  }, [searchFilters]);

  // ✅ INITIAL DATA FETCH - Load saved filters or use defaults
  useEffect(() => {
    const savedFilters = localStorage.getItem('typistSearchFilters');
    const defaultFilters = savedFilters
      ? JSON.parse(savedFilters)
      : {
          dateFilter: 'today',
          dateType: 'createdAt',
          modality: 'all',
          priority: 'all'
        };

    setSearchFilters(defaultFilters);
    fetchStudies(defaultFilters, 1, 50);
    fetchCategoryValues(defaultFilters);
  }, []);

  // ✅ Save filters whenever they change
  useEffect(() => {
    if (Object.keys(searchFilters).length > 0) {
      try {
        const filtersToSave = { ...searchFilters };
        delete filtersToSave.search;
        localStorage.setItem('typistSearchFilters', JSON.stringify(filtersToSave));
      } catch (error) {
        console.warn('Error saving filters:', error);
      }
    }
  }, [searchFilters]);

  // Update ref whenever searchFilters changes
  const searchFiltersRef = useRef(searchFilters);
  useEffect(() => {
    searchFiltersRef.current = searchFilters;
  }, [searchFilters]);

  // ✅ FETCH STUDIES WHEN CURRENT VIEW CHANGES
  useEffect(() => {
    if (Object.keys(searchFilters).length === 0) {
      return;
    }
    console.log(`🔄 [Typist] currentView changed to: ${currentView}`);
    fetchStudies(searchFilters, 1, pagination.recordsPerPage);
  }, [currentView]);

  // ✅ HANDLE PAGE CHANGE
  const handlePageChange = useCallback((newPage) => {
    console.log(`📄 [Typist] Changing page: ${pagination.currentPage} -> ${newPage}`);
    fetchStudies(searchFilters, newPage, pagination.recordsPerPage);
  }, [fetchStudies, searchFilters, pagination.recordsPerPage]);

  // ✅ HANDLE RECORDS PER PAGE CHANGE
  const handleRecordsPerPageChange = useCallback((newLimit) => {
    console.log(`📊 [Typist] Changing limit: ${pagination.recordsPerPage} -> ${newLimit}`);
    fetchStudies(searchFilters, 1, newLimit);
  }, [fetchStudies, searchFilters]);

  // ✅ Handlers
  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 [Typist] NEW SEARCH:', searchParams);
    setSearchFilters(searchParams);
    fetchStudies(searchParams, 1, 50);
    fetchCategoryValues(searchParams);
  }, [fetchStudies, fetchCategoryValues]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 [Typist] FILTER CHANGE:', filters);
    setSearchFilters(filters);
    fetchStudies(filters, 1, 50);
    fetchCategoryValues(filters);
  }, [fetchStudies, fetchCategoryValues]);

  const handleViewChange = useCallback((view) => {
    console.log(`🔄 [Typist] VIEW CHANGE: ${currentView} -> ${view}`);
    if (currentView !== view) {
      setCurrentView(view);
    }
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
    console.log('🔄 [Typist] Manual refresh');
    fetchStudies(null, pagination.currentPage, pagination.recordsPerPage);
  }, [fetchStudies, pagination.currentPage, pagination.recordsPerPage]);

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
      const response = await api.put(`/admin/studies/${formData.studyId}/update-details`, formData);
      if (response.data.success) {
        toast.success('Study details updated successfully');
        handleRefresh();
      } else {
        toast.error(response.data.message || 'Failed to update study details');
      }
    } catch (error) {
      console.error('Error updating study details:', error);
      toast.error('Error updating study details');
    }
  }, [fetchStudies, searchFilters, fetchCategoryValues, pagination.currentPage, pagination.recordsPerPage]);

  // Additional actions for navbar
  const additionalActions = [
    {
      label: 'Templates',
      icon: FileText,
      onClick: () => navigate('/doctor/templates'),
      variant: 'secondary',
      tooltip: 'Manage report templates'
    }
  ];

  // ✅ CATEGORY TABS - 3 categories for typist
  const categoryTabs = [
    { key: 'all', label: 'All', count: categoryValues.all },
    { key: 'pending', label: 'Pending', count: categoryValues.pending },
    { key: 'typed', label: 'Typed', count: categoryValues.typed }
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Navbar
        title="Typist Dashboard"
        subtitle={`${currentOrganizationContext || 'Organization View'} • My Cases`}
        showOrganizationSelector={false}
        onRefresh={handleRefresh}
        additionalActions={additionalActions}
        notifications={0}
        theme="doctor"
      />

      <Search
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        loading={loading}
        totalStudies={categoryValues.all}
        currentCategory={currentView}
        theme="doctor"
        initialFilters={searchFilters}
        onRefresh={handleRefresh}
      />

      <div className="flex-1 min-h-0 p-0 px-0">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">

          {/* COMPACT B&W HEADER BAR */}
          <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Typist Worklist
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
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all ${
                      currentView === tab.key
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{tab.label}</span>
                      <span className={`min-w-[16px] h-[16px] flex items-center justify-center rounded-full text-[8px] font-bold ${
                        currentView === tab.key 
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
                theme="doctor"
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
              availableAssignees={availableAssignees}
              onUpdateStudyDetails={handleUpdateStudyDetails}
              pagination={pagination}
              onPageChange={handlePageChange}
              onRecordsPerPageChange={handleRecordsPerPageChange}
              // ✅ MULTI-ROLE PROPS
              visibleColumns={visibleColumns}
              columnConfig={columnConfig}
              userRole={currentUser?.primaryRole || currentUser?.role || 'typist'}
              userRoles={userRoles}
              theme="doctor"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypistDashboard;