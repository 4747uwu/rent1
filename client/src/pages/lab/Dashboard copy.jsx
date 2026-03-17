import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import WorklistTable from '../../components/common/WorklistTable/WorklistTable';
import api from '../../services/api';
import { RefreshCw, Building, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';
import { useNavigate } from 'react-router-dom';

const LabDashboard = () => {
  const { currentUser, currentOrganizationContext } = useAuth();
  const navigate = useNavigate();
  
  // State management
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilters, setSearchFilters] = useState({});
  const [currentView, setCurrentView] = useState('all');
  
  const [apiValues, setApiValues] = useState({
    total: 0,
    pending: 0,
    inprogress: 0,
    completed: 0
  });

  const statusCounts = useMemo(() => ({
    all: apiValues.total,
    pending: apiValues.pending,
    inprogress: apiValues.inprogress,
    completed: apiValues.completed
  }), [apiValues]);

  // ✅ LAB-SPECIFIC: Endpoints for lab staff
  const getApiEndpoint = useCallback(() => {
    switch (currentView) {
      case 'pending': return '/lab/studies/pending';
      case 'inprogress': return '/lab/studies/inprogress';
      case 'completed': return '/lab/studies/completed';
      default: return '/lab/studies';
    }
  }, [currentView]);

  const fetchStudies = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = getApiEndpoint();
      const activeFilters = Object.keys(filters).length > 0 ? filters : searchFilters;
      const params = { ...activeFilters };
      delete params.category;
      
      console.log('🔍 [Lab] Fetching studies with params:', {
        endpoint,
        params,
        currentView,
        labId: currentUser.lab
      });
      
      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        const rawStudies = response.data.data || [];
        const formattedStudies = formatStudiesForWorklist(rawStudies);
        setStudies(formattedStudies);
        
        console.log('✅ [Lab] Studies fetched:', {
          raw: rawStudies.length,
          formatted: formattedStudies.length,
          labId: currentUser.lab
        });
      }
    } catch (err) {
      console.error('❌ [Lab] Error fetching studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, searchFilters, currentUser.lab]);

  const fetchAnalytics = useCallback(async (filters = {}) => {
    try {
      const params = Object.keys(filters).length > 0 ? filters : searchFilters;
      
      const response = await api.get('/lab/values', { params });
      if (response.data.success) {
        setApiValues({
          total: response.data.total || 0,
          pending: response.data.pending || 0,
          inprogress: response.data.inprogress || 0,
          completed: response.data.completed || 0
        });
      }
    } catch (error) {
      console.error('Error fetching lab analytics:', error);
      setApiValues({ total: 0, pending: 0, inprogress: 0, completed: 0 });
    }
  }, [searchFilters]);

  // Initial data fetch
  useEffect(() => {
    const defaultFilters = {
      dateFilter: 'today',
      dateType: 'createdAt',
      modality: 'all',
      priority: 'all',
      limit: 50
    };
    
    setSearchFilters(defaultFilters);
    fetchStudies(defaultFilters);
    fetchAnalytics(defaultFilters);
  }, []);

  // Auto-fetch when view changes
  useEffect(() => {
    if (Object.keys(searchFilters).length > 0) {
      console.log(`🔄 [Lab] View changed to: ${currentView}, refetching studies...`);
      fetchStudies(searchFilters);
    }
  }, [currentView, fetchStudies]);

  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 [Lab] NEW SEARCH PARAMS:', searchParams);
    setSearchFilters(searchParams);
    fetchStudies(searchParams);
    fetchAnalytics(searchParams);
  }, [fetchStudies, fetchAnalytics]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 [Lab] FILTER CHANGE:', filters);
    setSearchFilters(filters);
    fetchStudies(filters);
    fetchAnalytics(filters);
  }, [fetchStudies, fetchAnalytics]);

  const handleViewChange = useCallback((view) => {
    console.log(`📊 [Lab] TAB CHANGE: ${currentView} -> ${view}`);
    setCurrentView(view);
    
    setSearchFilters(prevFilters => {
      const preservedFilters = {
        dateFilter: prevFilters.dateFilter,
        dateType: prevFilters.dateType,
        customDateFrom: prevFilters.customDateFrom,
        customDateTo: prevFilters.customDateTo,
        modality: prevFilters.modality,
        priority: prevFilters.priority,
        limit: prevFilters.limit,
      };
      
      const cleanedFilters = Object.fromEntries(
        Object.entries(preservedFilters).filter(([_, value]) => value !== undefined && value !== '')
      );
      
      fetchAnalytics(cleanedFilters);
      return cleanedFilters;
    });
  }, [currentView, fetchAnalytics]);

  const handleRefresh = useCallback(() => {
    console.log('🔄 [Lab] Manual refresh');
    fetchStudies(searchFilters);
    fetchAnalytics(searchFilters);
  }, [fetchStudies, fetchAnalytics, searchFilters]);

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

  return (
    <div className="h-screen bg-blue-50 flex flex-col">
      <Navbar
        title="Lab Dashboard"
        subtitle={`${currentUser.lab?.name || 'Lab'} • Study Management`}
        showOrganizationSelector={false}
        onRefresh={handleRefresh}
        theme="lab"
      />
      
      <Search
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        loading={loading}
        totalStudies={statusCounts.all}
        currentCategory={currentView}
        theme="lab"
      />

      <div className="flex-1 min-h-0 p-0 px-0">
        <div className="bg-white rounded-lg shadow-sm border border-blue-100 h-full flex flex-col">
          
          <div className="flex items-center justify-between px-4 py-1 border-b border-blue-200 bg-white rounded-t-lg">
            <div className="flex items-center space-x-3">
              <h2 className="text-sm font-bold text-blue-800 uppercase tracking-wide">
                LAB WORKLIST
              </h2>
              <span className="text-xs text-blue-700 bg-white px-2 py-1 rounded border border-blue-200">
                {studies.length} studies loaded
              </span>
            </div>

            <div className="flex items-center border border-blue-300 rounded-md overflow-hidden bg-white">
              {[
                { key: 'all', label: 'All', count: statusCounts.all },
                { key: 'pending', label: 'Pending', count: statusCounts.pending },
                { key: 'inprogress', label: 'In Progress', count: statusCounts.inprogress },
                { key: 'completed', label: 'Completed', count: statusCounts.completed }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleViewChange(tab.key)}
                  className={`px-3 py-1.5 text-xs font-medium border-r border-blue-300 last:border-r-0 transition-colors ${
                    currentView === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <WorklistTable
              studies={studies}
              loading={loading}
              theme="lab"
            />
          </div>
        </div>
      </div>

      {/* Add to the Navbar or create a settings button */}
      <button
        onClick={() => navigate('/lab/branding')}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Palette className="w-4 h-4" />
        Branding
      </button>
    </div>
  );
};

export default LabDashboard;