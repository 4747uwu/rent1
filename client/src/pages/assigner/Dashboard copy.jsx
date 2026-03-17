import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import UnifiedWorklistTable from '../../components/common/WorklistTable/UnifiedWorklistTable.jsx';
import ColumnConfigurator from '../../components/common/WorklistTable/ColumnConfigurator';
import api from '../../services/api';
import { RefreshCw, UserCheck, Users2, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';
import { resolveUserVisibleColumns } from '../../utils/columnResolver';
import useVisibleColumns from '../../hooks/useVisibleColumns';

const AssignerDashboard = () => {
  const { currentUser, currentOrganizationContext } = useAuth();
  
  // ✅ RESOLVE VISIBLE COLUMNS ONCE
  // const visibleColumns = useMemo(() => {
  //   return resolveUserVisibleColumns(currentUser);
  // }, [currentUser?.visibleColumns, currentUser?.accountRoles, currentUser?.primaryRole]);

  const { visibleColumns, columnsLoading } = useVisibleColumns(currentUser);

  console.log('🎯 Dashboard Visible Columns:', {
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
  const [selectedStudies, setSelectedStudies] = useState([]);
  const [availableAssignees, setAvailableAssignees] = useState({ radiologists: [], verifiers: [] });

  // ✅ UPDATED: CATEGORY-BASED API VALUES (ADD REVERTED)
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
    reverted: 0  // ✅ ADD THIS
  });

  // ...existing code...
  // ...existing code...
  const getDefaultColumnConfig = () => ({
    checkbox:          { visible: false, order: 1,  label: 'Select' },
    bharatPacsId:      { visible: true,  order: 2,  label: 'BP ID' },
    centerName:        { visible: true,  order: 3,  label: 'Center' },
    timeline:          { visible: true,  order: 4,  label: 'Timeline' },      // ✅ ADD
    patientName:       { visible: true,  order: 5,  label: 'Patient Name' },
    patientId:         { visible: true,  order: 6,  label: 'Patient ID' },
    ageGender:         { visible: true,  order: 7,  label: 'Age/Sex' },
    modality:          { visible: true,  order: 8,  label: 'Modality' },
    viewOnly:          { visible: true,  order: 9,  label: 'View' },          // ✅ ADD
    seriesCount:       { visible: true,  order: 10, label: 'Series/Images' }, // ← was missing 'studySeriesImages' mapping
    accessionNumber:   { visible: false, order: 11, label: 'Acc. No.' },
    referralDoctor:    { visible: true,  order: 12, label: 'Referral Dr.' },
    clinicalHistory:   { visible: true,  order: 13, label: 'History' },
    studyTime:         { visible: true,  order: 14, label: 'Study Time' },    // maps ← studyDateTime
    uploadTime:        { visible: true,  order: 15, label: 'Upload Time' },   // maps ← uploadDateTime
    radiologist:       { visible: false, order: 16, label: 'Radiologist' },   // maps ← assignedRadiologist
    studyLock:         { visible: true,  order: 17, label: 'Lock/Unlock' },   // ✅ ADD
    caseStatus:        { visible: true,  order: 18, label: 'Status' },        // maps ← status
    assignedVerifier:  { visible: true,  order: 19, label: 'Finalised By' },  // ✅ ADD
    verifiedDateTime:  { visible: true,  order: 20, label: 'Finalised Date' },// ✅ ADD
    actions:           { visible: true,  order: 21, label: 'Actions' },
    rejectionReason:   { visible: true,  order: 22, label: 'Rejection' },     // ✅ ADD
  });
// ...existing code...

  const [columnConfig, setColumnConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('assignerWorklistColumnConfig');
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        // ✅ FORCE RESET if stale 'checkbox' key exists
        if ('checkbox' in parsedConfig) {
          console.warn('🔄 Migrating stale column config — resetting');
          localStorage.removeItem('assignerWorklistColumnConfig');
          return getDefaultColumnConfig();
        }
        return { ...getDefaultColumnConfig(), ...parsedConfig };
      }
    } catch (error) {
      console.warn('Error loading assignor column config:', error);
    }
    return getDefaultColumnConfig();
  });


  useEffect(() => {
    try {
      localStorage.setItem('assignerWorklistColumnConfig', JSON.stringify(columnConfig));
    } catch (error) {
      console.warn('Error saving assignor column config:', error);
    }
  }, [columnConfig]);

  // ✅ UPDATED: CATEGORY-BASED ENDPOINT MAPPING (same as admin)
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

  // ✅ FETCH STUDIES WITH PAGINATION (EXACT SAME AS ADMIN)
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
      
      console.log('🔍 [Assignor] Fetching studies:', {
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
        
        console.log('✅ [Assignor] Studies loaded:', {
          count: formattedStudies.length,
          page: requestPage,
          limit: requestLimit,
          total: response.data.pagination?.totalRecords
        });
      }
    } catch (err) {
      console.error('❌ [Assignor] Error fetching studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, searchFilters, currentView]); // ✅ REMOVED pagination from dependencies

  // ✅ UPDATED: FETCH CATEGORY VALUES (same as admin)
  const fetchCategoryValues = useCallback(async (filters = {}) => {
    try {
      const params = Object.keys(filters).length > 0 ? filters : searchFilters;
      
      console.log('🔍 [Assignor] Fetching category values with params:', params);
      
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

        console.log('📊 [Assignor] CATEGORY VALUES UPDATED:', response.data);
      }
    } catch (error) {
      console.error('Error fetching assignor category values:', error);
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
      if (response.data.success) {
        setAvailableAssignees(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching assignees:', error);
    }
  }, []);

  // ✅ INITIAL DATA FETCH WITH TODAY AS DEFAULT
  useEffect(() => {
    const defaultFilters = {
      dateFilter: 'today',
      dateType: 'createdAt',
      modality: 'all',
      labId: 'all',
      priority: 'all'
    };
    
    setSearchFilters(defaultFilters);
    fetchStudies(defaultFilters, 1, 50);
    fetchCategoryValues(defaultFilters);
    fetchAvailableAssignees();
  }, []); // ✅ Empty deps - only run once on mount

  // ✅ FETCH STUDIES WHEN CURRENT VIEW CHANGES
  useEffect(() => {
    console.log(`🔄 [Assignor] currentView changed to: ${currentView}`);
    // ✅ Reset to page 1, keep current limit
    fetchStudies(searchFilters, 1, pagination.recordsPerPage);
  }, [currentView]); // ✅ Only depend on currentView, NOT fetchStudies

  // ✅ SIMPLIFIED: Handle page change
  const handlePageChange = useCallback((newPage) => {
    console.log(`📄 [Assignor] Changing page: ${pagination.currentPage} -> ${newPage}`);
    
    // ✅ Just fetch with new page, keeping current limit
    fetchStudies(searchFilters, newPage, pagination.recordsPerPage);
  }, [fetchStudies, searchFilters, pagination.recordsPerPage]);

  // ✅ SIMPLIFIED: Handle records per page change
  const handleRecordsPerPageChange = useCallback((newLimit) => {
    console.log(`📊 [Assignor] Changing limit: ${pagination.recordsPerPage} -> ${newLimit}`);
    
    // ✅ Fetch with new limit, reset to page 1
    fetchStudies(searchFilters, 1, newLimit);
  }, [fetchStudies, searchFilters]);

  // Handlers
const handleSearch = useCallback((searchParams) => {
  console.log('🔍 [Assignor] NEW SEARCH:', searchParams);
  setSearchFilters(searchParams);
  
  // ✅ Save filters (excluding live search term)
  try {
    const toSave = { ...searchParams };
    delete toSave.search;
    localStorage.setItem('assignerDashboardFilters', JSON.stringify(toSave));
  } catch (e) {}
  
  fetchStudies(searchParams, 1, pagination.recordsPerPage);
  fetchCategoryValues(searchParams);
}, [fetchStudies, fetchCategoryValues, pagination.recordsPerPage]);

const handleFilterChange = useCallback((filters) => {
  console.log('🔍 [Assignor] FILTER CHANGE:', filters);
  setSearchFilters(filters);
  
  // ✅ Save filters (excluding live search term)
  try {
    const toSave = { ...filters };
    delete toSave.search;
    localStorage.setItem('assignerDashboardFilters', JSON.stringify(toSave));
  } catch (e) {}
  
  fetchStudies(filters, 1, pagination.recordsPerPage);
  fetchCategoryValues(filters);
}, [fetchStudies, fetchCategoryValues, pagination.recordsPerPage]);
  
  // ✅ SIMPLIFIED: View change
  const handleViewChange = useCallback((view) => {
    console.log(`🔄 [Assignor] VIEW CHANGE: ${currentView} -> ${view}`);
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
    console.log('🔄 [Assignor] Manual refresh');
    fetchStudies(searchFilters, pagination.currentPage, pagination.recordsPerPage);
    fetchCategoryValues(searchFilters);
    fetchAvailableAssignees();
  }, [fetchStudies, fetchCategoryValues, fetchAvailableAssignees, searchFilters, pagination.currentPage, pagination.recordsPerPage]);

  const handleAssignmentSubmit = useCallback(async (assignmentData) => {
    try {
      const { study, assignedToIds, assigneeRole, priority, notes, dueDate } = assignmentData;
      
      console.log('🔄 [Assignor] Submitting assignment:', {
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
        fetchStudies(searchFilters, pagination.currentPage, pagination.recordsPerPage);
        fetchCategoryValues(searchFilters);
      }
    } catch (error) {
      console.error('Assignor assignment error:', error);
      toast.error(error.response?.data?.message || 'Failed to update assignments');
    }
  }, [fetchStudies, searchFilters, fetchCategoryValues, pagination.currentPage, pagination.recordsPerPage]);

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

  const additionalActions = [
    {
      label: 'Analytics',
      icon: BarChart3,
      onClick: () => console.log('Open analytics'),
      variant: 'secondary',
      tooltip: 'View assignment analytics'
    },
    {
      label: 'Bulk Assign',
      icon: Users2,
      onClick: () => {
        if (selectedStudies.length > 0) {
          console.log('Bulk assign:', selectedStudies);
        } else {
          toast.error('Please select studies to assign');
        }
      },
      variant: 'primary',
      tooltip: 'Assign multiple studies',
      disabled: selectedStudies.length === 0
    }
  ];

  // ✅ UPDATED: CATEGORY TABS (same as admin dashboard)
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

  return (
    <div className="h-screen bg-teal-50 flex flex-col">
      <Navbar
        title="Assignor Dashboard"
        subtitle={`${currentOrganizationContext || 'Organization View'} • Assignment Management`}
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
      />

      <div className="flex-1 min-h-0 p-0 px-0">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
          
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center space-x-3">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assignment Worklist
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

            {/* ✅ UPDATED: COMPACT MODERN CATEGORY TABS (same as admin) */}
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
                    
                    {currentView === tab.key && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-white rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
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
              loading={loading || columnsLoading} // ✅ wait for columns before rendering
              selectedStudies={selectedStudies}
              onSelectAll={handleSelectAll}
              onSelectStudy={handleSelectStudy}
              onPatienIdClick={(patientId, study) => console.log('Patient clicked:', patientId)}
              availableAssignees={availableAssignees}
              onAssignmentSubmit={handleAssignmentSubmit}
               onUpdateStudyDetails={handleUpdateStudyDetails}
              // userRole={currentUser?.role || 'assignor'}
              pagination={pagination}
              onPageChange={handlePageChange}
              onRecordsPerPageChange={handleRecordsPerPageChange}
                             onRefreshStudies={handleRefresh}  // ✅ PASS THIS

              // ✅ PASS RESOLVED COLUMNS
              visibleColumns={visibleColumns}
              columnConfig={columnConfig} 
              userRole={currentUser?.primaryRole || currentUser?.role || 'assignor'}
              userRoles={currentUser?.accountRoles?.length > 0 ? currentUser?.accountRoles : [currentUser?.role || 'assignor']}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignerDashboard;