import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle2, Edit3, RotateCcw, XCircle, UserPlus } from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import UnifiedWorklistTable from '../../components/common/WorklistTable/UnifiedWorklistTable';
import ColumnConfigurator from '../../components/common/WorklistTable/ColumnConfigurator';
import CreateTypistModal from '../../components/doctor/CreateTypistModal';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';
import useVisibleColumns from '../../hooks/useVisibleColumns';



const DoctorDashboard = () => {
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
  const [showTypistModal, setShowTypistModal] = useState(false);
  const [availableAssignees, setAvailableAssignees] = useState({ radiologists: [], verifiers: [] });

  // ✅ CATEGORY-BASED API VALUES (6 categories)
  const [categoryValues, setCategoryValues] = useState({
    all: 0,
    pending: 0,
    drafted: 0,
    completed: 0,
    reverted: 0,
    rejected: 0
  });
  // console.log(currentUser);

  // ✅ Always fresh from DB — never stale sessionStorage data
  const { visibleColumns, columnsLoading } = useVisibleColumns(currentUser);

  // ✅ GET USER ROLES for UnifiedWorklistTable
  const userRoles = useMemo(() => {
    if (!currentUser) return [];
    
    // Multi-role support: use accountRoles array if available
    if (currentUser.accountRoles && Array.isArray(currentUser.accountRoles)) {
      return currentUser.accountRoles;
    }
    
    // Fallback to single role
    if (currentUser.role) {
      return [currentUser.role];
    }
    
    return [];
  }, [currentUser?.accountRoles, currentUser?.role]);

  
  const getDefaultColumnConfig = () => ({
   
    checkbox:             { visible: false, order: 1,  label: 'Select' },
    bharatPacsId:         { visible: true,  order: 2,  label: 'BP ID' },           // DB: bharatPacsId
    centerName:           { visible: true,  order: 3,  label: 'Center' },           // DB: centerName
    location:             { visible: false, order: 4,  label: 'Location' },         // DB: location
    timeline:             { visible: true,  order: 5,  label: 'Timeline' },         // DB: timeline
    patientName:          { visible: true,  order: 6,  label: 'Patient Name' },     // DB: patientName
    patientId:            { visible: true,  order: 7,  label: 'Patient ID' },       // DB: patientId
    ageGender:            { visible: true,  order: 8,  label: 'Age/Sex' },          // DB: ageGender
    modality:             { visible: true,  order: 9,  label: 'Modality' },         // DB: modality
    viewOnly:             { visible: true,  order: 10, label: 'View' },             
    reporting:             { visible: true,  order: 24, label: 'reporting' },             
    seriesCount:          { visible: true,  order: 11, label: 'Series/Images' },    // DB: studySeriesImages
    accessionNumber:      { visible: false, order: 12, label: 'Acc. No.' },         // DB: accessionNumber
    referralDoctor:       { visible: false, order: 13, label: 'Referral Dr.' },     // DB: referralDoctor
    clinicalHistory:      { visible: true,  order: 14, label: 'History' },          // DB: clinicalHistory
    studyTime:            { visible: true,  order: 15, label: 'Study Date/Time' },  // DB: studyDateTime
    uploadTime:           { visible: true,  order: 16, label: 'Upload Date/Time' }, // DB: uploadDateTime
    radiologist:          { visible: false, order: 17, label: 'Radiologist' },      // DB: assignedRadiologist
    studyLock:            { visible: true,  order: 18, label: 'Lock/Unlock' },      // DB: studyLock
    caseStatus:           { visible: true,  order: 19, label: 'Status' },           // DB: status
    assignedVerifier:     { visible: true,  order: 20, label: 'Finalised By' },     // DB: assignedVerifier
    verifiedDateTime:     { visible: true,  order: 21, label: 'Finalised Date' },   // DB: verifiedDateTime
    actions:              { visible: true,  order: 22, label: 'Actions' },          // DB: actions
    rejectionReason:      { visible: true,  order: 23, label: 'Rejection Reason' }, // DB: rejectionReason
  });


  // ✅ No localStorage — always fresh from defaults, DB gates what's visible
  const [columnConfig, setColumnConfig] = useState(getDefaultColumnConfig);
  // useEffect(() => {
  //   try {
  //     localStorage.setItem('doctorWorklistColumnConfig', JSON.stringify(columnConfig));
  //   } catch (error) {
  //     console.warn('Error saving column config:', error);
  //   }
  // }, [columnConfig]);

  // ✅ CATEGORY-BASED ENDPOINT MAPPING (6 categories)
  const getApiEndpoint = useCallback(() => {
    switch (currentView) {
      case 'pending': return '/doctor/studies/pending';
      case 'drafted': return '/doctor/studies/drafted';
      case 'completed': return '/doctor/studies/completed';
      case 'reverted': return '/doctor/studies/reverted';
      // case 'rejected': return '/doctor/studies/rejected';
      default: return '/doctor/studies';
    }
  }, [currentView]);

  // ✅ FETCH STUDIES WITH PAGINATION (lines 137-184)
  const fetchStudies = useCallback(async (filters = {}, page = null, limit = null) => {
    setLoading(true);
    setError(null);
    
    // ✅ CRITICAL: Use parameters if provided, otherwise use current state
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
      
      console.log('🔍 DOCTOR: Fetching studies from:', endpoint, 'with params:', params);
      
      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        const rawStudies = response.data.data || [];
        
        const formattedStudies = formatStudiesForWorklist(rawStudies);
        console.log('✅ DOCTOR: Formatted studies:', {
          raw: rawStudies.length,
          formatted: formattedStudies.length,
          sample: formattedStudies[0]
        });
        
        setStudies(formattedStudies);
        
        // ✅ CRITICAL: Update pagination with our REQUESTED values
        setPagination({
          currentPage: requestPage, // Use what we REQUESTED
          totalPages: response.data.pagination?.totalPages || 1,
          totalRecords: response.data.pagination?.totalRecords || 0,
          recordsPerPage: requestLimit, // Use what we REQUESTED
          hasNextPage: response.data.pagination?.hasNextPage || false,
          hasPrevPage: response.data.pagination?.hasPrevPage || false
        });
      }
    } catch (err) {
      console.error('❌ Error fetching doctor studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, searchFilters, currentView]); // ✅ KEEP searchFilters and currentView

  // ✅ FETCH CATEGORY VALUES (6 categories)
  const fetchCategoryValues = useCallback(async (filters = {}) => {
    try {
      const params = filters && Object.keys(filters).length > 0 ? filters : searchFilters;      
      console.log('🔍 DOCTOR ANALYTICS: Fetching with params:', params);
      
      const response = await api.get('/doctor/values', { params });
      if (response.data.success) {
        setCategoryValues({
          all: response.data.all || 0,
          pending: response.data.pending || 0,
          drafted: response.data.drafted || 0,
          completed: response.data.completed || 0,
          reverted: response.data.reverted || 0,
          rejected: response.data.rejected || 0
        });
        
        console.log('✅ DOCTOR ANALYTICS:', {
          all: response.data.all,
          pending: response.data.pending,
          drafted: response.data.drafted,
          completed: response.data.completed,
          reverted: response.data.reverted,
          rejected: response.data.rejected
        });
      }
    } catch (error) {
      console.error('Error fetching doctor analytics:', error);
      setCategoryValues({ all: 0, pending: 0, drafted: 0, completed: 0, reverted: 0, rejected: 0 });
    }
  }, [searchFilters]);

  // ✅ INITIAL DATA FETCH - Load saved filters or use defaults
  useEffect(() => {
    const savedFilters = localStorage.getItem('doctorSearchFilters');
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

  // ✅ Save filters whenever they change (exclude search term)
  useEffect(() => {
    if (Object.keys(searchFilters).length > 0) {
      try {
        const filtersToSave = { ...searchFilters };
        delete filtersToSave.search; // ✅ Don't persist search term
        localStorage.setItem('doctorSearchFilters', JSON.stringify(filtersToSave));
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

  // ✅ FETCH STUDIES WHEN CURRENT VIEW CHANGES (lines 249-253)
  useEffect(() => {
    // Skip if this is the initial mount (filters are empty)
    if (Object.keys(searchFilters).length === 0) {
      return;
    }
    
    console.log(`🔄 [Doctor] currentView changed to: ${currentView}`);
    // ✅ Reset to page 1, keep current limit
    fetchStudies(searchFilters, 1, pagination.recordsPerPage);
  }, [currentView]); // ✅ Only depend on currentView, NOT fetchStudies

  // ✅ HANDLE PAGE CHANGE (lines 256-260)
  const handlePageChange = useCallback((newPage) => {
    console.log(`📄 [Doctor] Changing page: ${pagination.currentPage} -> ${newPage}`);
    
    // ✅ Just fetch with new page, keeping current limit
    fetchStudies(searchFilters, newPage, pagination.recordsPerPage);
  }, [fetchStudies, searchFilters, pagination.recordsPerPage]);

  // ✅ HANDLE RECORDS PER PAGE CHANGE (lines 263-267)
  const handleRecordsPerPageChange = useCallback((newLimit) => {
    console.log(`📊 [Doctor] Changing limit: ${pagination.recordsPerPage} -> ${newLimit}`);
    
    // ✅ Fetch with new limit, reset to page 1
    fetchStudies(searchFilters, 1, newLimit);
  }, [fetchStudies, searchFilters]);

  // ✅ Handlers
  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 [Doctor] NEW SEARCH:', searchParams);
    setSearchFilters(searchParams);
    fetchStudies(searchParams, 1, 50); // Pass explicit filters
    fetchCategoryValues(searchParams);
  }, [fetchStudies, fetchCategoryValues]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 [Doctor] FILTER CHANGE:', filters);
    setSearchFilters(filters);
    fetchStudies(filters, 1, 50); // Pass explicit filters
    fetchCategoryValues(filters);
  }, [fetchStudies, fetchCategoryValues]);

  const handleViewChange = useCallback((view) => {
    console.log(`🔄 [Doctor] VIEW CHANGE: ${currentView} -> ${view}`);
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
    console.log('🔄 [Doctor] Manual refresh');
    fetchStudies(null, pagination.currentPage, pagination.recordsPerPage); // null = use latest
  }, [fetchStudies, pagination.currentPage, pagination.recordsPerPage]);

  const handleCreateTypist = useCallback(() => {
    console.log('👥 Opening create typist modal');
    setShowTypistModal(true);
  }, []);

  const handleTypistCreated = useCallback((newTypist) => {
    console.log('✅ Typist created successfully:', newTypist);
    toast.success(`Typist ${newTypist.fullName} created and linked to your account`);
  }, []);

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
    },
    {
      label: 'Create Typist',
      icon: UserPlus,
      onClick: handleCreateTypist,
      variant: 'secondary',
      tooltip: 'Create a typist to assist with report typing'
    }
  ];

  // ✅ CATEGORY TABS - 6 categories matching admin style
  const categoryTabs = [
    { key: 'all', label: 'All', count: categoryValues.all },
    { key: 'pending', label: 'Pending', count: categoryValues.pending },
    { key: 'drafted', label: 'Drafted', count: categoryValues.drafted },
    { key: 'completed', label: 'Completed', count: categoryValues.completed },
    { key: 'reverted', label: 'Reverted', count: categoryValues.reverted },
    // { key: 'rejected', label: 'Rejected', count: categoryValues.rejected }
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Navbar
        title="Doctor Dashboard"
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
                Doctor Worklist
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
                visibleColumns={visibleColumns}
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
              onUpdateStudyDetails={handleUpdateStudyDetails}
              pagination={pagination}
              onPageChange={handlePageChange}
              onRecordsPerPageChange={handleRecordsPerPageChange}
              // ✅ MULTI-ROLE PROPS
              visibleColumns={visibleColumns}
              columnConfig={columnConfig}  // ✅ ADD THIS

              userRole={currentUser?.primaryRole || currentUser?.role || 'radiologist'}
              userRoles={userRoles}
              theme="doctor"
            />
          </div>
        </div>
      </div>

      <CreateTypistModal
        isOpen={showTypistModal}
        onClose={() => setShowTypistModal(false)}
        onSuccess={handleTypistCreated}
        doctorInfo={currentUser}
      />
    </div>
  );
};

export default DoctorDashboard;