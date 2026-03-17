import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import DoctorWorklistTable from '../../components/common/WorklistTable/doctorWorklistTable';
import api from '../../services/api';
import { RefreshCw, FileText, Eye, Clock, CheckCircle, AlertCircle, Edit, User, Keyboard } from 'lucide-react';import toast from 'react-hot-toast';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';

const TypistDashboard = () => {
  const { currentUser, currentOrganizationContext } = useAuth();
  const navigate = useNavigate();
  
  // ✅ PAGINATION STATE
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

  // ✅ API VALUES STATE - 2 categories
  const [apiValues, setApiValues] = useState({
    total: 0,
    pending: 0,
    typed: 0
  });

  const tabCounts = useMemo(() => ({
    all: apiValues.total,
    pending: apiValues.pending,
    typed: apiValues.typed
  }), [apiValues]);

  // ✅ API endpoints
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
      
      console.log('🔍 TYPIST: Fetching studies from:', endpoint, 'with params:', params);
      
      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        const rawStudies = response.data.data || [];
        const formattedStudies = formatStudiesForWorklist(rawStudies);
        setStudies(formattedStudies);
        
        // ✅ CRITICAL: Update pagination with our REQUESTED values
        if (response.data.pagination) {
          setPagination({
            currentPage: requestPage,
            totalPages: response.data.pagination.totalPages,
            totalRecords: response.data.pagination.totalRecords,
            recordsPerPage: requestLimit,
            hasNextPage: response.data.pagination.hasNextPage,
            hasPrevPage: response.data.pagination.hasPrevPage
          });
        }
      }
    } catch (err) {
      console.error('❌ Error fetching typist studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, searchFilters, currentView]);

  // ✅ FETCH ANALYTICS
  const fetchAnalytics = useCallback(async (filters = {}) => {
    try {
      const params = Object.keys(filters).length > 0 ? filters : searchFilters;
      
      console.log('🔍 TYPIST ANALYTICS: Fetching with params:', params);
      
      const response = await api.get('/typist/values', { params });
      if (response.data.success) {
        setApiValues({
          total: response.data.total || 0,
          pending: response.data.pending || 0,
          typed: response.data.typed || 0
        });

        console.log('📊 TYPIST API VALUES UPDATED:', {
          total: response.data.total,
          pending: response.data.pending,
          typed: response.data.typed
        });
      }
    } catch (error) {
      console.error('Error fetching typist analytics:', error);
      setApiValues({ total: 0, pending: 0, typed: 0 });
    }
  }, [searchFilters]);

  // ✅ INITIAL FETCH
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

  // ✅ FETCH WHEN VIEW CHANGES
  useEffect(() => {
    // Skip if this is the initial mount (filters are empty)
    if (Object.keys(searchFilters).length === 0) {
      return;
    }
    
    console.log(`🔄 [Typist] currentView changed to: ${currentView}`);
    fetchStudies(searchFilters, 1, pagination.recordsPerPage);
  }, [currentView]);

  const handlePageChange = useCallback((newPage) => {
    console.log(`📄 [Typist] Changing page: ${pagination.currentPage} -> ${newPage}`);
    fetchStudies(searchFilters, newPage, pagination.recordsPerPage);
  }, [fetchStudies, searchFilters, pagination.recordsPerPage]);

  const handleRecordsPerPageChange = useCallback((newLimit) => {
    console.log(`📊 [Typist] Changing limit: ${pagination.recordsPerPage} -> ${newLimit}`);
    fetchStudies(searchFilters, 1, newLimit);
  }, [fetchStudies, searchFilters]);

  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 [Typist] NEW SEARCH:', searchParams);
    setSearchFilters(searchParams);
    fetchStudies(searchParams, 1, pagination.recordsPerPage);
    fetchAnalytics(searchParams);
  }, [fetchStudies, fetchAnalytics, pagination.recordsPerPage]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 [Typist] FILTER CHANGE:', filters);
    setSearchFilters(filters);
    fetchStudies(filters, 1, pagination.recordsPerPage);
    fetchAnalytics(filters);
  }, [fetchStudies, fetchAnalytics, pagination.recordsPerPage]);
  
  const handleViewChange = useCallback((view) => {
    console.log(`🔄 [Typist] VIEW CHANGE: ${currentView} -> ${view}`);
    setCurrentView(view);
  }, [currentView]);

  const handleRefresh = useCallback(() => {
    console.log('🔄 [Typist] Manual refresh');
    fetchStudies(searchFilters, pagination.currentPage, pagination.recordsPerPage);
    fetchAnalytics(searchFilters);
  }, [fetchStudies, fetchAnalytics, searchFilters, pagination.currentPage, pagination.recordsPerPage]);

  // ✅ 2 CATEGORY TABS (Pending & Typed)
  const categoryTabs = [
    { key: 'all', label: 'All', count: tabCounts.all, icon: FileText },
    { key: 'pending', label: 'Pending', count: tabCounts.pending, icon: Clock },
    { key: 'typed', label: 'Typed', count: tabCounts.typed, icon: CheckCircle }
  ];

  return (
    <div className="h-screen bg-teal-50 flex flex-col">
      <Navbar
        title="Typist Dashboard"
        subtitle={`${currentOrganizationContext || 'Organization View'} • Supporting ${currentUser?.roleConfig?.linkedRadiologist ? 'Radiologist' : 'Doctor'}`}
        showOrganizationSelector={false}
        onRefresh={handleRefresh}
        additionalActions={[]}
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
                Typing Worklist
              </h2>
              <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                {studies.length} loaded
              </span>
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
          </div>

          <div className="flex-1 min-h-0">
            <DoctorWorklistTable
              studies={studies}
              loading={loading}
              onPatienIdClick={(patientId, study) => console.log('Patient clicked:', patientId)}
              onUpdateStudyDetails={() => {}}
              pagination={pagination}
              onPageChange={handlePageChange}
              onRecordsPerPageChange={handleRecordsPerPageChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypistDashboard;