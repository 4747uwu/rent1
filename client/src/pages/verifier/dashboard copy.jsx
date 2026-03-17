import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import Search from '../../components/common/Search/Search';
import WorklistTable from '../../components/common/WorklistTable/verifierWorklistTable'; // ✅ Use verifier-specific table
import ColumnConfigurator from '../../components/common/WorklistTable/ColumnConfigurator';
import api from '../../services/api';
import { 
  RefreshCw, 
  FileText, 
  CheckCircle, 
  XCircle,
  Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatStudiesForWorklist } from '../../utils/studyFormatter';

const VerifierDashboard = () => {
  const { currentUser, currentOrganizationContext } = useAuth();
  
  // State management
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilters, setSearchFilters] = useState({});
  const [currentView, setCurrentView] = useState('all');
  const [selectedStudies, setSelectedStudies] = useState([]);

  // ✅ SIMPLIFIED: Only 3 status categories
  const [apiValues, setApiValues] = useState({
    total: 0,
    verified: 0,
    rejected: 0
  });

  const intervalRef = useRef(null);

  // ✅ SIMPLIFIED: Only 3 tab counts
  const tabCounts = useMemo(() => ({
    all: apiValues.total,
    verified: apiValues.verified,
    rejected: apiValues.rejected
  }), [apiValues]);

  // ✅ SIMPLIFIED: Verifier-specific column configuration
  const getDefaultColumnConfig = () => ({
    checkbox: { visible: true, order: 1, label: 'Select' },
    workflowStatus: { visible: true, order: 2, label: 'Status' },
    patientId: { visible: true, order: 3, label: 'Patient ID' },
    patientName: { visible: true, order: 4, label: 'Patient Name' },
    ageGender: { visible: true, order: 5, label: 'Age/Sex' },
    modality: { visible: true, order: 6, label: 'Modality' },
    studyDate: { visible: true, order: 7, label: 'Study Date' },
    reportedDate: { visible: true, order: 8, label: 'Report Date' },
    reportedBy: { visible: true, order: 9, label: 'Reported By' },
    verifiedDate: { visible: true, order: 10, label: 'Verified Date' },
    verifiedBy: { visible: true, order: 11, label: 'Verified By' },
    verificationStatus: { visible: true, order: 12, label: 'Verification' },
    actions: { visible: true, order: 13, label: 'Actions' },
    // Hidden columns
    studyDescription: { visible: false, order: 14, label: 'Description' },
    seriesCount: { visible: false, order: 15, label: 'Series' },
    location: { visible: false, order: 16, label: 'Location' },
    uploadDate: { visible: false, order: 17, label: 'Upload Date' },
    accession: { visible: false, order: 18, label: 'Accession' },
    seenBy: { visible: false, order: 19, label: 'Seen By' },
    assignedDoctor: { visible: false, order: 20, label: 'Assignment' }
  });

  const [columnConfig, setColumnConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('verifierWorklistColumnConfig');
      if (saved) {
        const parsedConfig = JSON.parse(saved);
        return { ...getDefaultColumnConfig(), ...parsedConfig };
      }
    } catch (error) {
      console.warn('Error loading verifier column config:', error);
    }
    return getDefaultColumnConfig();
  });

  useEffect(() => {
    try {
      localStorage.setItem('verifierWorklistColumnConfig', JSON.stringify(columnConfig));
    } catch (error) {
      console.warn('Error saving verifier column config:', error);
    }
  }, [columnConfig]);

  // ✅ SIMPLIFIED: API endpoints for only 3 categories
  const getApiEndpoint = useCallback(() => {
    switch (currentView) {
      case 'verified': return '/verifier/studies/verified';
      case 'rejected': return '/verifier/studies/rejected';
      default: return '/verifier/studies';
    }
  }, [currentView]);

  const fetchStudies = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = getApiEndpoint();
      const params = { 
        ...filters, 
        category: currentView === 'all' ? undefined : currentView 
      };
      
      console.log('🔍 VERIFIER: Fetching studies from:', endpoint, 'with params:', params);
      
      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        const rawStudies = response.data.data || [];
        console.log('📦 VERIFIER: Raw studies received:', rawStudies.length);
        
        const formattedStudies = formatStudiesForWorklist(rawStudies);
        console.log('✨ VERIFIER: Formatted studies:', formattedStudies.length);
        console.log(rawStudies)
        
        setStudies(formattedStudies);
      }
    } catch (err) {
      console.error('❌ Error fetching verifier studies:', err);
      setError('Failed to fetch studies.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [getApiEndpoint, currentView]);

  // ✅ SIMPLIFIED: Fetch analytics for 3 categories
  const fetchAnalytics = useCallback(async (filters = {}) => {
    try {
      const params = Object.keys(filters).length > 0 ? filters : searchFilters;
      
      console.log('🔍 VERIFIER ANALYTICS: Fetching with params:', params);
      
      const response = await api.get('/verifier/values', { params });
      if (response.data.success) {
        setApiValues({
          total: response.data.total || 0,
          verified: response.data.verified || 0,
          rejected: response.data.rejected || 0
        });

        console.log('📊 VERIFIER API VALUES UPDATED:', {
          total: response.data.total,
          verified: response.data.verified,
          rejected: response.data.rejected
        });
      }
    } catch (error) {
      console.error('Error fetching verifier analytics:', error);
      setApiValues({ total: 0, verified: 0, rejected: 0 });
    }
  }, [searchFilters]);

  useEffect(() => {
    fetchStudies(searchFilters);
    fetchAnalytics(searchFilters);
  }, [fetchStudies, fetchAnalytics]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      console.log('🔄 Auto-refreshing verifier dashboard data...');
      fetchStudies(searchFilters);
      fetchAnalytics(searchFilters);
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStudies, fetchAnalytics, searchFilters]);

  const handleSearch = useCallback((searchParams) => {
    console.log('🔍 VERIFIER SEARCH: New search params:', searchParams);
    setSearchFilters(searchParams);
    fetchAnalytics(searchParams);
  }, [fetchAnalytics]);

  const handleFilterChange = useCallback((filters) => {
    console.log('🔍 VERIFIER FILTER CHANGE:', filters);
    setSearchFilters(filters);
    fetchAnalytics(filters);
  }, [fetchAnalytics]);
  
  const handleViewChange = useCallback((view) => {
    console.log(`📊 VERIFIER TAB CHANGE: ${currentView} -> ${view}`);
    setCurrentView(view);
    setSelectedStudies([]);
    
    setSearchFilters(prevFilters => {
      const preservedFilters = {
        dateFilter: prevFilters.dateFilter,
        dateType: prevFilters.dateType,
        customDateFrom: prevFilters.customDateFrom,
        customDateTo: prevFilters.customDateTo,
        modality: prevFilters.modality,
        labId: prevFilters.labId,
        priority: prevFilters.priority,
        radiologist: prevFilters.radiologist,
        limit: prevFilters.limit,
        category: view === 'all' ? undefined : view
      };
      
      const cleanedFilters = Object.fromEntries(
        Object.entries(preservedFilters).filter(([_, value]) => value !== undefined && value !== '')
      );
      
      fetchAnalytics(cleanedFilters);
      return cleanedFilters;
    });
  }, [currentView, fetchAnalytics]);

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
    console.log('🔄 VERIFIER MANUAL REFRESH');
    fetchStudies(searchFilters);
    fetchAnalytics(searchFilters);
  }, [fetchStudies, fetchAnalytics, searchFilters]);

  // ✅ NEW: Handle verification completion
  const handleVerifyComplete = useCallback(() => {
    // Refresh data after verification
    fetchStudies(searchFilters);
    fetchAnalytics(searchFilters);
    toast.success('Study verification completed');
  }, [fetchStudies, fetchAnalytics, searchFilters]);

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

  // ✅ SIMPLIFIED: Only basic actions needed for verification
  const additionalActions = [
    {
      label: 'View Reports',
      icon: FileText,
      onClick: () => {
        if (selectedStudies.length === 1) {
          const study = studies.find(s => s._id === selectedStudies[0]);
          // Open report modal or navigate to report view
          console.log('View report for study:', study);
        }
      },
      variant: 'secondary',
      tooltip: 'View report content',
      disabled: selectedStudies.length !== 1
    }
  ];

  console.log('🔍 VERIFIER DASHBOARD DEBUG:', {
    studies: studies.length,
    apiValues,
    tabCounts,
    currentView,
    searchFilters
  });

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <Navbar
        title="Verifier Dashboard"
        subtitle={`${currentOrganizationContext || 'Organization View'} • Report Verification`}
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-400 h-full flex flex-col">
          
          <div className="flex items-center justify-between px-4 py-1 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center space-x-3">
              <h2 className="text-sm font-bold text-black uppercase tracking-wide flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>VERIFICATION WORKLIST</span>
              </h2>
              <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded border">
                {studies.length} reports loaded
              </span>
              {selectedStudies.length > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  {selectedStudies.length} selected
                </span>
              )}
            </div>

            {/* ✅ SIMPLIFIED: Only 3 tabs */}
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-white">
              {[
                { key: 'all', label: 'All Reports', count: tabCounts.all, icon: FileText },
                { key: 'verified', label: 'Verified', count: tabCounts.verified, icon: CheckCircle },
                { key: 'rejected', label: 'Rejected', count: tabCounts.rejected, icon: XCircle }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleViewChange(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-r border-gray-300 last:border-r-0 transition-colors ${
                      currentView === tab.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label} ({tab.count})
                  </button>
                );
              })}
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
            <WorklistTable
              studies={studies}
              loading={loading}
              columnConfig={columnConfig}
              selectedStudies={selectedStudies}
              onSelectAll={handleSelectAll}
              onSelectStudy={handleSelectStudy}
              onPatienIdClick={(patientId, study) => console.log('Patient clicked:', patientId)}
              onVerifyComplete={handleVerifyComplete}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifierDashboard;