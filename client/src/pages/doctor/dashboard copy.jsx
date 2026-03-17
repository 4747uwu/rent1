import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import UnifiedWorklistTable from '../../components/common/WorklistTable/UnifiedWorklistTable';
import ColumnConfigurator from '../../components/common/WorklistTable/ColumnConfigurator';
import CreateTypistModal from '../../components/doctor/CreateTypistModal';
import api from '../../services/api';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';
import { 
  FileText, 
  Clock, 
  CheckCircle2,
  UserPlus,
  CheckCircle,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// ✅ UTILITY: Resolve visible columns from user object
const resolveUserVisibleColumns = (user) => {
  if (!user) return [];
  
  // ✅ Primary source: visibleColumns array (from database)
  if (user.visibleColumns && Array.isArray(user.visibleColumns)) {
    return user.visibleColumns;
  }
  
  return [];
};

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

  // ✅ UPDATED: API VALUES STATE - 5 categories (pending, completed, accepted, rejected)
  const [apiValues, setApiValues] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    accepted: 0,
    rejected: 0
  });

  // ✅ UPDATED: USE API values for tab counts - 5 categories
  const tabCounts = useMemo(() => ({
    all: apiValues.total,
    pending: apiValues.pending,
    completed: apiValues.completed,
    accepted: apiValues.accepted,
    rejected: apiValues.rejected
  }), [apiValues]);

  // ✅ COMPUTE visible columns from user
  const visibleColumns = useMemo(() => {
    return resolveUserVisibleColumns(currentUser);
  }, [currentUser?.visibleColumns, currentUser?.accountRoles, currentUser?.primaryRole]);

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

  // ✅ OLD: Column configuration (no longer needed, but kept for reference)
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
      const saved = localStorage.getItem('doctorWorklistColumnConfig');
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
      localStorage.setItem('doctorWorklistColumnConfig', JSON.stringify(columnConfig));
    } catch (error) {
      console.warn('Error saving column config:', error);
    }
  }, [columnConfig]);

  // ✅ UPDATED: API endpoints - 5 categories
  const getApiEndpoint = useCallback(() => {
    switch (currentView) {
      case 'pending': return '/doctor/studies/pending';
      case 'completed': return '/doctor/studies/completed';
      case 'accepted': return '/doctor/studies/accepted';
      case 'rejected': return '/doctor/studies/rejected';
      default: return '/doctor/studies';
    }
  }, [currentView]);

  // ✅ FETCH STUDIES WITH PAGINATION AND FORMATTING
  const fetchStudies = useCallback(async (filters = {}, page = null, limit = null) => {
    setLoading(true);
    setError(null);
    
    const requestPage = page !== null ? page : pagination.currentPage;
    const requestLimit = limit !== null ? limit : pagination.recordsPerPage;
    
    try {
      const endpoint = getApiEndpoint();
      const params = { 
        ...filters,
        page: requestPage,
        limit: requestLimit
      };
      
      console.log('🔍 DOCTOR: Fetching studies from:', endpoint, 'with params:', params);
      
      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        const rawStudies = response.data.data || [];
        
        // ✅ FORMAT STUDIES BEFORE SETTING STATE (like admin dashboard)
        const formattedStudies = formatStudiesForWorklist(rawStudies);
        console.log('✅ DOCTOR: Formatted studies:', {
          raw: rawStudies.length,
          formatted: formattedStudies.length,
          sample: formattedStudies[0]
        });
        
        setStudies(formattedStudies);
        
        if (response.data.pagination) {
          setPagination({
            currentPage: response.data.pagination.currentPage,
            totalPages: response.data.pagination.totalPages,
            totalRecords: response.data.pagination.totalRecords,
            recordsPerPage: response.data.pagination.limit,
            hasNextPage: response.data.pagination.hasNextPage,
            hasPrevPage: response.data.pagination.hasPrevPage
          });
        }
      }
    } catch (err) {
      console.error('❌ Error fetching doctor studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, pagination.currentPage, pagination.recordsPerPage]);

  // ✅ UPDATED: FETCH ANALYTICS - 5 categories
  const fetchAnalytics = useCallback(async (filters = {}) => {
    try {
      const params = Object.keys(filters).length > 0 ? filters : searchFilters;
      
      console.log('🔍 DOCTOR ANALYTICS: Fetching with params:', params);
      
      const response = await api.get('/doctor/values', { params });
      if (response.data.success) {
        setApiValues({
          total: response.data.total || 0,
          pending: response.data.pending || 0,
          completed: response.data.completed || 0,
          accepted: response.data.accepted || 0,
          rejected: response.data.rejected || 0
        });

        console.log('📊 DOCTOR API VALUES UPDATED:', {
          total: response.data.total,
          pending: response.data.pending,
          completed: response.data.completed,
          accepted: response.data.accepted,
          rejected: response.data.rejected
        });
      }
    } catch (error) {
      console.error('Error fetching doctor analytics:', error);
      setApiValues({ total: 0, pending: 0, completed: 0, accepted: 0, rejected: 0 });
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
    fetchAnalytics(defaultFilters);
  }, []);

  // ✅ FETCH STUDIES WHEN CURRENT VIEW CHANGES
  useEffect(() => {
    console.log(`🔄 [Doctor] currentView changed to: ${currentView}`);
    fetchStudies(searchFilters, 1, pagination.recordsPerPage);
  }, [currentView]);

  // ✅ HANDLE PAGE CHANGE
  const handlePageChange = useCallback((newPage) => {
    console.log(`📄 [Doctor] Changing page: ${pagination.currentPage} -> ${newPage}`);
    fetchStudies(searchFilters, newPage, pagination.recordsPerPage);
  }, [fetchStudies, searchFilters, pagination.currentPage, pagination.recordsPerPage]);

  // ✅ HANDLE RECORDS PER PAGE CHANGE
  const handleRecordsPerPageChange = useCallback((newLimit) => {
    console.log(`📊 [Doctor] Changing limit: ${pagination.recordsPerPage} -> ${newLimit}`);
    fetchStudies(searchFilters, 1, newLimit);
  }, [fetchStudies, searchFilters]);

  // ✅ Handlers
  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 [Doctor] NEW SEARCH:', searchParams);
    setSearchFilters(searchParams);
    fetchStudies(searchParams, 1, pagination.recordsPerPage);
    fetchAnalytics(searchParams);
  }, [fetchStudies, fetchAnalytics, pagination.recordsPerPage]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 [Doctor] FILTER CHANGE:', filters);
    setSearchFilters(filters);
    fetchStudies(filters, 1, pagination.recordsPerPage);
    fetchAnalytics(filters);
  }, [fetchStudies, fetchAnalytics, pagination.recordsPerPage]);
  
  const handleViewChange = useCallback((view) => {
    console.log(`🔄 [Doctor] VIEW CHANGE: ${currentView} -> ${view}`);
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
    console.log('🔄 [Doctor] Manual refresh');
    fetchStudies(searchFilters, pagination.currentPage, pagination.recordsPerPage);
    fetchAnalytics(searchFilters);
  }, [fetchStudies, fetchAnalytics, searchFilters, pagination.currentPage, pagination.recordsPerPage]);

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
        fetchStudies(searchFilters, pagination.currentPage, pagination.recordsPerPage);
        fetchAnalytics(searchFilters);
      } else {
        toast.error('Failed to update study details');
      }
    } catch (error) {
      console.error('Error updating study details:', error);
      toast.error('Error updating study details');
    }
  }, [fetchStudies, searchFilters, fetchAnalytics, pagination.currentPage, pagination.recordsPerPage]);

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

  // ✅ UPDATED: 5 CATEGORY TABS (added accepted and rejected)
  const categoryTabs = [
    { key: 'all', label: 'All', count: tabCounts.all, icon: FileText },
    { key: 'pending', label: 'Pending', count: tabCounts.pending, icon: Clock },
    { key: 'completed', label: 'Completed', count: tabCounts.completed, icon: CheckCircle2 },
    { key: 'accepted', label: 'Accepted', count: tabCounts.accepted, icon: CheckCircle },
    { key: 'rejected', label: 'Rejected', count: tabCounts.rejected, icon: XCircle }
  ];

  return (
    <div className="h-screen bg-teal-50 flex flex-col">
      <Navbar
        title="Doctor Dashboard"
        subtitle={`${currentOrganizationContext || 'Organization View'} • My Cases`}
        showOrganizationSelector={false}
        onRefresh={handleRefresh}
        additionalActions={additionalActions}
        notifications={0}
      />
      
      <Search
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        loading={loading}
        totalStudies={tabCounts.all}
        currentCategory={currentView}
      />

      <div className="flex-1 min-h-0 p-0 px-0">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
          
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center space-x-3">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                My Worklist
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

            <div className="flex-1 mx-4 overflow-x-auto scrollbar-hide">
              <div className="flex items-center gap-1.5 min-w-max">
                {categoryTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleViewChange(tab.key)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                        ${currentView === tab.key
                          ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                          : 'bg-white text-slate-600 hover:bg-teal-50 border border-slate-200'
                        }
                      `}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                      <span className={`
                        ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold
                        ${currentView === tab.key
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-700'
                        }
                      `}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
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
              userRole={currentUser?.primaryRole || currentUser?.role || 'radiologist'}
              userRoles={userRoles}
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