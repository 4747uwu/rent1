import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { 
    Search as SearchIcon, 
    X, 
    RefreshCw,
    ChevronDown,
    Filter,
    UserPlus,
    Building,
    Users,
    Shield,
    Crown,
    Clock,
    Play,
    Pause
} from 'lucide-react';
import MultiSelect from '../MultiSelect';
import api from '../../../services/api';

const Search = ({ 
    onSearch, 
    onFilterChange, 
    loading = false,
    totalStudies = 0,
    currentCategory = 'all',
    analytics = null,
    theme = 'default',
    initialFilters = null,
    onRefresh // ✅ NEW: Callback for manual refresh
}) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // ✅ NEW: Auto-refresh state
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
        const saved = localStorage.getItem('autoRefreshEnabled');
        return saved ? JSON.parse(saved) : false;
    });
    
    const [refreshInterval, setRefreshInterval] = useState(() => {
        const saved = localStorage.getItem('refreshInterval');
        return saved ? parseInt(saved) : 5;
    });
    
    const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
    const [timeUntilRefresh, setTimeUntilRefresh] = useState(refreshInterval * 60);
    
    // State management
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        category: currentCategory,
        modality: 'all',
        modalities: [], // ✅ NEW: Multi-select modalities
        labId: 'all',
        priority: 'all',
        assigneeRole: 'all',
        dateFilter: 'today',
        dateType: 'createdAt',
        customDateFrom: '',
        customDateTo: '',
        limit: 50,
        radiologists: [],
        labs: []
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const [radiologistOptions, setRadiologistOptions] = useState([]);
    const [labOptions, setLabOptions] = useState([]);

    // ✅ Sync filters when initialFilters prop changes
    useEffect(() => {
        if (initialFilters && Object.keys(initialFilters).length > 0) {
            console.log('🔄 [Search] Syncing with initial filters:', initialFilters);
            
            setFilters(prevFilters => ({
                ...prevFilters,
                ...initialFilters
            }));
            
            if (initialFilters.search) {
                setSearchTerm(initialFilters.search);
            } else {
                setSearchTerm('');
            }
        }
    }, [initialFilters]);

    // ✅ NEW: Auto-refresh timer effect
    useEffect(() => {
        if (!autoRefreshEnabled) {
            setTimeUntilRefresh(refreshInterval * 60);
            return;
        }

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - lastRefreshTime) / 1000);
            const remaining = (refreshInterval * 60) - elapsed;
            
            if (remaining <= 0) {
                console.log('🔄 [Search] Auto-refresh triggered');
                setLastRefreshTime(Date.now());
                setTimeUntilRefresh(refreshInterval * 60);
                onRefresh?.();
            } else {
                setTimeUntilRefresh(remaining);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [autoRefreshEnabled, refreshInterval, lastRefreshTime, onRefresh]);

    // ✅ NEW: Save auto-refresh settings to localStorage
    useEffect(() => {
        localStorage.setItem('autoRefreshEnabled', JSON.stringify(autoRefreshEnabled));
    }, [autoRefreshEnabled]);

    useEffect(() => {
        localStorage.setItem('refreshInterval', refreshInterval.toString());
    }, [refreshInterval]);

    // ✅ NEW: Format countdown timer
    const formatCountdown = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ✅ NEW: Refresh interval options
    const refreshIntervalOptions = [
        { value: 2, label: '2 min' },
        { value: 3, label: '3 min' },
        { value: 5, label: '5 min' },
        { value: 10, label: '10 min' },
        { value: 15, label: '15 min' }
    ];

    // Check if user is admin or assignor
    const isAdmin = currentUser?.role === 'admin';
    const isAssignor = currentUser?.role === 'assignor';
    const isGreenTheme = theme === 'adminn';

    // Check user permissions for creating entities
    const canCreateDoctor = ['super_admin', 'admin', 'group_id'].includes(currentUser?.role);
    const canCreateLab = ['super_admin', 'admin'].includes(currentUser?.role);
    const canCreateUser = ['super_admin', 'admin', 'group_id'].includes(currentUser?.role);

    const dateOptions = [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'tomorrow', label: 'Tomorrow' },
        { value: 'last2days', label: 'Last 2 Days' },
        { value: 'last7days', label: 'Last 7 Days' },
        { value: 'last30days', label: 'Last 30 Days' },
        { value: 'thisWeek', label: 'This Week' },
        { value: 'lastWeek', label: 'Last Week' },
        { value: 'thisMonth', label: 'This Month' },
        { value: 'lastMonth', label: 'Last Month' },
        { value: 'last3months', label: 'Last 3 Months' },
        { value: 'last6months', label: 'Last 6 Months' },
        { value: 'thisYear', label: 'This Year' },
        { value: 'lastYear', label: 'Last Year' },
        { value: 'custom', label: 'Custom Range' }
    ];

    const themeColors = isGreenTheme ? {
        primary: 'teal-600',
        primaryHover: 'teal-700',
        primaryLight: 'teal-50',
        border: 'teal-300',
        borderLight: 'teal-200',
        text: 'teal-700',
        textSecondary: 'teal-600',
        background: 'teal-50',
        focus: 'focus:ring-teal-500 focus:border-teal-500'
    } : {
        primary: 'black',
        primaryHover: 'gray-800',
        primaryLight: 'gray-50',
        border: 'gray-300',
        borderLight: 'gray-200',
        text: 'gray-700',
        textSecondary: 'gray-600',
        background: 'gray-50',
        focus: 'focus:ring-black focus:border-black'
    };

    // Handle search input change with debouncing
    const handleSearchChange = useCallback((value) => {
        setSearchTerm(value);
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (value === '' || value.trim() === '') {
            const searchParams = { ...filters };
            delete searchParams.search;
            
            Object.keys(searchParams).forEach(key => {
                if (searchParams[key] === '' || searchParams[key] === 'all' || searchParams[key] === undefined) {
                    delete searchParams[key];
                }
            });
            
            console.log('🗑️ [Search] CLEARING SEARCH TERM:', searchParams);
            onSearch?.(searchParams);
            onFilterChange?.(searchParams);
            return;
        }
        
        const newTimeout = setTimeout(() => {
            handleSearch(value);
        }, 300);
        
        setSearchTimeout(newTimeout);
    }, [searchTimeout, filters, onSearch, onFilterChange]);

    // Execute search
    const handleSearch = useCallback((term = searchTerm) => {
        const searchParams = { ...filters };
        
        if (term && term.trim()) {
            searchParams.search = term.trim();
        }
        
        // ✅ NEW: Handle modalities multi-select
        if (filters.modalities && filters.modalities.length > 0) {
            searchParams.modalities = filters.modalities;
        }
        
        if (filters.radiologists && filters.radiologists.length > 0) {
            searchParams.radiologists = filters.radiologists;
        }
        
        if (filters.labs && filters.labs.length > 0) {
            searchParams.labs = filters.labs;
        }
        
        Object.keys(searchParams).forEach(key => {
            const value = searchParams[key];
            if (value === '' || value === 'all' || value === undefined) {
                delete searchParams[key];
            }
            if (Array.isArray(value) && value.length === 0) {
                delete searchParams[key];
            }
        });
        
        console.log('🔍 [Search] Executing search with params:', searchParams);
        onSearch?.(searchParams);
    }, [searchTerm, filters, onSearch]);

    // Handle filter changes
    const handleFilterChange = useCallback((key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        
        const searchParams = { ...newFilters };
        
        if (searchTerm && searchTerm.trim()) {
            searchParams.search = searchTerm.trim();
        }
        
        // ✅ NEW: Handle modalities multi-select
        if (newFilters.modalities && newFilters.modalities.length > 0) {
            searchParams.modalities = newFilters.modalities;
        }
        
        if (newFilters.radiologists && newFilters.radiologists.length > 0) {
            searchParams.radiologists = newFilters.radiologists;
        }
        
        if (newFilters.labs && newFilters.labs.length > 0) {
            searchParams.labs = newFilters.labs;
        }
        
        Object.keys(searchParams).forEach(key => {
            const value = searchParams[key];
            if (value === '' || value === 'all' || value === undefined) {
                delete searchParams[key];
            }
            if (Array.isArray(value) && value.length === 0) {
                delete searchParams[key];
            }
        });
        
        console.log('🔍 [Search] Filter changed:', { key, value, params: searchParams });
        onSearch?.(searchParams);
        onFilterChange?.(searchParams);
    }, [filters, searchTerm, onSearch, onFilterChange]);

    // Clear all filters
    const clearAllFilters = useCallback(() => {
        console.log('🗑️ [Search] CLEARING ALL FILTERS');
        
        setSearchTerm('');
        const defaultFilters = {
            modality: 'all',
            modalities: [], // ✅ NEW: Reset modalities
            labId: 'all',
            priority: 'all',
            assigneeRole: 'all',
            dateFilter: 'today',
            dateType: 'createdAt',
            customDateFrom: '',
            customDateTo: '',
            limit: 50,
            radiologists: [],
            labs: []
        };
        setFilters(defaultFilters);
        
        const cleanFilters = { ...defaultFilters };
        delete cleanFilters.search;
        
        onSearch?.(cleanFilters);
        onFilterChange?.(cleanFilters);
    }, [onSearch, onFilterChange]);

    const handleRefreshClick = useCallback(() => {
        setLastRefreshTime(Date.now());
        setTimeUntilRefresh(refreshInterval * 60);
        onRefresh?.();
    }, [onRefresh, refreshInterval]);

    // ✅ NEW: Toggle auto-refresh
    const handleToggleAutoRefresh = useCallback(() => {
        const newState = !autoRefreshEnabled;
        setAutoRefreshEnabled(newState);
        if (newState) {
            setLastRefreshTime(Date.now());
            setTimeUntilRefresh(refreshInterval * 60);
        }
    }, [autoRefreshEnabled, refreshInterval]);

    // ✅ NEW: Change refresh interval
    const handleRefreshIntervalChange = useCallback((newInterval) => {
        setRefreshInterval(newInterval);
        setLastRefreshTime(Date.now());
        setTimeUntilRefresh(newInterval * 60);
    }, []);

    // Admin action handlers
    const handleCreateDoctor = useCallback(() => {
        navigate('/admin/create-doctor');
    }, [navigate]);

    const handleCreateLab = useCallback(() => {
        navigate('/admin/create-lab');
    }, [navigate]);

    const handleCreateUser = useCallback(() => {
        navigate('/admin/create-user');
    }, [navigate]);

    // Options
    const modalityMultiSelectOptions = [
        { value: 'CT', label: 'CT' },
        { value: 'MR', label: 'MRI' },
        { value: 'CR', label: 'CR' },
        { value: 'DX', label: 'DX' },
        { value: 'PR', label: 'PR' },
        { value: 'US', label: 'US' },
        { value: 'XA', label: 'XA' },
        { value: 'MG', label: 'MG' },
        { value: 'NM', label: 'NM' },
        { value: 'PT', label: 'PET' },
        { value: 'RF', label: 'RF' },
        { value: 'OT', label: 'Other' }
    ];

    const priorityOptions = [
        { value: 'all', label: 'All' },
        { value: 'STAT', label: 'STAT' },
        { value: 'URGENT', label: 'Urgent' },
        { value: 'NORMAL', label: 'Normal' }
    ];

    const hasActiveFilters = searchTerm || Object.values(filters).some(v => v !== 'all' && v !== 'today' && v !== 'createdAt' && v !== '' && v !== 50);

    // Fetch filter options for radiologists and labs
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const radResponse = await api.get('/admin/filters/radiologists');
                if (radResponse.data.success) {
                    setRadiologistOptions(radResponse.data.data);
                }

                const labResponse = await api.get('/admin/filters/labs');
                if (labResponse.data.success) {
                    setLabOptions(labResponse.data.data);
                }
            } catch (error) {
                console.error('Error fetching filter options:', error);
            }
        };

        fetchFilterOptions();
    }, []);

    // ✅ NEW: Check if user can access radiologist and lab filters
    const canAccessAdvancedFilters = ['super_admin', 'admin', 'assignor'].includes(currentUser?.role);

    return (
        <div className={`bg-white border-b ${themeColors.border} px-3 py-2.5`}>
            {/* MAIN SEARCH ROW */}
            <div className="flex items-center gap-2">
                
                {/* SEARCH INPUT */}
                <div className="relative w-88 flex-shrink-0">
                    <SearchIcon className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 text-${themeColors.textSecondary}`} size={14} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search patients, IDs..."
                        className={`w-full pl-8 pr-6 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} transition-colors`}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => handleSearchChange('')}
                            className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-${themeColors.textSecondary} hover:text-${themeColors.text} p-0.5`}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* QUICK FILTERS */}
                <div className="flex items-center gap-1">
                    {/* ✅ UPDATED: Modality Multi-Select */}
                    <MultiSelect
                        options={modalityMultiSelectOptions}
                        selected={filters.modalities}
                        onChange={(selected) => handleFilterChange('modalities', selected)}
                        placeholder="Modality"
                        className="w-24"
                    />

                    <select
                        value={filters.priority}
                        onChange={(e) => handleFilterChange('priority', e.target.value)}
                        className={`px-2 py-1.5 text-xs border border-${themeColors.border} rounded bg-white text-${themeColors.text} ${themeColors.focus} min-w-16`}
                    >
                        {priorityOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    {/* ✅ RESTRICTED: Radiologist filter - only for admin, super_admin, assignor */}
                    {canAccessAdvancedFilters && (
                        <MultiSelect
                            options={radiologistOptions}
                            selected={filters.radiologists}
                            onChange={(selected) => handleFilterChange('radiologists', selected)}
                            placeholder="Radiologist"
                            className="w-32"
                        />
                    )}

                    {/* ✅ RESTRICTED: Lab/Center filter - only for admin, super_admin, assignor */}
                    {canAccessAdvancedFilters && (
                        <MultiSelect
                            options={labOptions}
                            selected={filters.labs}
                            onChange={(selected) => handleFilterChange('labs', selected)}
                            placeholder="Center"
                            className="w-32"
                        />
                    )}

                    {isAssignor && (
                        <select
                            value={filters.assigneeRole}
                            onChange={(e) => handleFilterChange('assigneeRole', e.target.value)}
                            className={`px-2 py-1.5 text-xs border border-${themeColors.border} rounded bg-white text-${themeColors.text} ${themeColors.focus} min-w-20`}
                        >
                            <option value="all">All Roles</option>
                            <option value="radiologist">Radiologist</option>
                            <option value="verifier">Verifier</option>
                        </select>
                    )}
                </div>

                {/* TIME FILTERS */}
                <div className="flex items-center gap-1">
                    {['Today', 'Yesterday', '7 Days', '30 Days'].map((period) => {
                        const isActive = 
                            (period === 'Today' && filters.dateFilter === 'today') ||
                            (period === 'Yesterday' && filters.dateFilter === 'yesterday') ||
                            (period === '7 Days' && filters.dateFilter === 'last7days') ||
                            (period === '30 Days' && filters.dateFilter === 'last30days');
                        
                        const value = 
                            period === 'Today' ? 'today' :
                            period === 'Yesterday' ? 'yesterday' :
                            period === '7 Days' ? 'last7days' :
                            'last30days';

                        return (
                            <button
                                key={period}
                                onClick={() => handleFilterChange('dateFilter', value)}
                                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                                    isActive
                                        ? isGreenTheme 
                                            ? 'bg-teal-600 text-white hover:bg-teal-700' 
                                            : 'bg-black text-white hover:bg-gray-800'
                                        : isGreenTheme
                                            ? 'text-teal-600 hover:bg-teal-50 border border-teal-300'
                                            : 'text-gray-600 hover:bg-gray-100 border border-gray-300'
                                }`}
                            >
                                {period}
                            </button>
                        );
                    })}
                    
                    <div className="relative">
                        <select
                            value={filters.dateFilter || 'today'}
                            onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
                            className={`px-2 py-1 text-xs border ${isGreenTheme ? 'border-teal-300' : 'border-gray-300'} rounded bg-white ${isGreenTheme ? 'text-teal-700 focus:ring-teal-500 focus:border-teal-500' : 'text-gray-700 focus:ring-black focus:border-black'} focus:outline-none focus:ring-1 min-w-20`}
                        >
                            <option value="">All Time</option>
                            {dateOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ADMIN BUTTONS */}
                {(canCreateDoctor || canCreateLab || canCreateUser) && (
                    <div className={`flex items-center gap-1 pl-2 border-l border-${themeColors.border}`}>
                        {isAdmin && (
                            <button
                                onClick={() => navigate('/admin/user-management')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${isGreenTheme ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'} text-white text-xs font-medium rounded transition-colors`}
                                title="Manage Users"
                            >
                                <Shield size={12} />
                                <span className="hidden sm:inline">Manage</span>
                            </button>
                        )}
                        
                        {canCreateUser && (
                            <button
                                onClick={handleCreateUser}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${isGreenTheme ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'} text-white text-xs font-medium rounded transition-colors`}
                                title="Create New User"
                            >
                                <Users size={12} />
                                <span className="hidden sm:inline">User</span>
                            </button>
                        )}
                        
                        {canCreateDoctor && (
                            <button
                                onClick={handleCreateDoctor}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${isGreenTheme ? 'bg-teal-700 hover:bg-teal-800' : 'bg-black hover:bg-gray-800'} text-white text-xs font-medium rounded transition-colors`}
                                title="Create Doctor Account"
                            >
                                <UserPlus size={12} />
                                <span className="hidden sm:inline">Doctor</span>
                            </button>
                        )}
                        
                        {canCreateLab && (
                            <button
                                onClick={handleCreateLab}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${isGreenTheme ? 'bg-slate-600 hover:bg-slate-700' : 'bg-gray-700 hover:bg-gray-800'} text-white text-xs font-medium rounded transition-colors`}
                                title="Create Lab"
                            >
                                <Building size={12} />
                                <span className="hidden sm:inline">Lab</span>
                            </button>
                        )}
                    </div>
                )}

                {/* ASSIGNOR ANALYTICS */}
                {isAssignor && analytics && (
                    <div className={`flex items-center gap-2 pl-2 border-l border-${themeColors.border}`}>
                        <div className="text-xs">
                            <span className={`text-${themeColors.textSecondary}`}>Unassigned:</span>
                            <span className="font-bold text-red-600 ml-1">{analytics.overview?.totalUnassigned || 0}</span>
                        </div>
                        <div className="text-xs">
                            <span className={`text-${themeColors.textSecondary}`}>Assigned:</span>
                            <span className="font-bold text-green-600 ml-1">{analytics.overview?.totalAssigned || 0}</span>
                        </div>
                        <div className="text-xs">
                            <span className={`text-${themeColors.textSecondary}`}>Overdue:</span>
                            <span className="font-bold text-orange-600 ml-1">{analytics.overview?.overdueStudies || 0}</span>
                        </div>
                    </div>
                )}

                {/* ✅ NEW: AUTO-REFRESH CONTROLS */}
                <div className={`flex items-center gap-1 pl-2 border-l border-${themeColors.border}`}>
                    {/* Refresh interval selector */}
                    <select
                        value={refreshInterval}
                        onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
                        className={`px-2 py-1 text-xs border ${isGreenTheme ? 'border-teal-300' : 'border-gray-300'} rounded bg-white ${isGreenTheme ? 'text-teal-700' : 'text-gray-700'} focus:outline-none focus:ring-1 ${isGreenTheme ? 'focus:ring-teal-500' : 'focus:ring-gray-500'}`}
                        title="Auto-refresh interval"
                    >
                        {refreshIntervalOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    {/* Auto-refresh toggle */}
                    <button
                        onClick={handleToggleAutoRefresh}
                        className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${
                            autoRefreshEnabled
                                ? isGreenTheme
                                    ? 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'
                                    : 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                                : isGreenTheme
                                    ? 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                        title={autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
                    >
                        {autoRefreshEnabled ? <Play size={12} /> : <Pause size={12} />}
                        {autoRefreshEnabled && (
                            <span className="font-mono text-[10px]">
                                {formatCountdown(timeUntilRefresh)}
                            </span>
                        )}
                    </button>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center gap-1">
                    {/* Advanced Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`px-2 py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-1 ${
                            showAdvanced 
                                ? isGreenTheme 
                                    ? `bg-teal-600 text-white border-teal-600` 
                                    : 'bg-black text-white border-black'
                                : isGreenTheme
                                    ? `bg-white text-${themeColors.text} border-${themeColors.border} hover:bg-${themeColors.primaryLight}`
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <Filter size={12} />
                        <span className="hidden sm:inline">Filters</span>
                        <ChevronDown size={10} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Clear Button */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="px-2 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded border border-red-200 hover:bg-red-100 transition-colors"
                        >
                            Clear
                        </button>
                    )}

                    {/* Manual Refresh Button */}
                    <button
                        onClick={handleRefreshClick}
                        disabled={loading}
                        className={`p-1.5 text-${themeColors.textSecondary} hover:text-${themeColors.text} hover:bg-${themeColors.primaryLight} rounded transition-colors disabled:opacity-50`}
                        title="Manual refresh"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* RESULTS COUNT */}
                <div className={`flex items-center gap-1 text-xs text-${themeColors.textSecondary} pl-2 border-l border-${themeColors.border}`}>
                    <span className={`font-bold text-${themeColors.primary}`}>{totalStudies.toLocaleString()}</span>
                    <span className="hidden sm:inline">studies</span>
                    {loading && <span className={`text-${isGreenTheme ? 'teal-600' : 'green-600'} font-medium`}>• Live</span>}
                </div>
            </div>

            {/* ADVANCED FILTERS PANEL */}
            {showAdvanced && (
                <div className={`mt-2.5 pt-2.5 border-t border-${themeColors.borderLight}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        
                        <div className="col-span-2">
                            <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                Date Range
                            </label>
                            <select
                                value={filters.dateFilter || 'today'}
                                onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
                                className={`w-full px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value="">All Time</option>
                                {dateOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                Date Type
                            </label>
                            <select
                                value={filters.dateType || 'createdAt'}
                                onChange={(e) => handleFilterChange('dateType', e.target.value)}
                                className={`w-full px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value="createdAt">Upload Date</option>
                                <option value="StudyDate">Study Date</option>
                            </select>
                        </div>

                        {filters.dateFilter === 'custom' && (
                            <>
                                <div>
                                    <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                        From Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.customDateFrom || ''}
                                        onChange={(e) => handleFilterChange('customDateFrom', e.target.value)}
                                        className={`w-full px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                        To Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.customDateTo || ''}
                                        onChange={(e) => handleFilterChange('customDateTo', e.target.value)}
                                        className={`w-full px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                Lab
                            </label>
                            <select
                                value={filters.labId || 'all'}
                                onChange={(e) => handleFilterChange('labId', e.target.value)}
                                className={`w-full px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value="all">All Labs</option>
                            </select>
                        </div>

                        <div>
                            <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                Per Page
                            </label>
                            <select
                                value={filters.limit}
                                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                                className={`w-full px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Search;