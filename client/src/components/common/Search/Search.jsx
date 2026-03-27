import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { 
    Search as SearchIcon, 
    X, 
    RefreshCw,
    ChevronDown,
    Filter,
    Settings,
    Play,
    Pause
} from 'lucide-react';
import MultiSelect from '../MultiSelect';
import SettingsModal from '../SettingsModal';
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
    onRefresh
}) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // ✅ normalize role to avoid case/format mismatches (GROUP_ID vs group_id)
    const role = (currentUser?.role || '').toString().toLowerCase();

    // ✅ NEW: Settings modal state
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    
    // ✅ NEW: Auto-refresh state
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
        const saved = localStorage.getItem('autoRefreshEnabled');
        return saved !== null ? JSON.parse(saved) : true;
    });
    
    const REFRESH_INTERVAL_SECONDS = 30;
    
    const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
    const [timeUntilRefresh, setTimeUntilRefresh] = useState(REFRESH_INTERVAL_SECONDS);
    
    // State management
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        category: currentCategory,
        modality: 'all',
        modalities: [],
        labId: 'all',
        priority: 'all',
        priorities: [],           // ✅ NEW: Multi-select priorities
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

    useEffect(() => {
        if (initialFilters && Object.keys(initialFilters).length > 0) {
            console.log('🔄 [Search] Syncing with initial filters:', initialFilters);
            
            const filtersToSync = { ...initialFilters };
            delete filtersToSync.search;
            
            setFilters(prevFilters => ({
                ...prevFilters,
                ...filtersToSync
            }));
        }
    }, [initialFilters]);

    // ✅ NEW: Auto-refresh timer effect
    useEffect(() => {
        if (!autoRefreshEnabled) {
            setTimeUntilRefresh(REFRESH_INTERVAL_SECONDS);
            return;
        }

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - lastRefreshTime) / 1000);
            const remaining = REFRESH_INTERVAL_SECONDS - elapsed;
            
            if (remaining <= 0) {
                console.log('🔄 [Search] Auto-refresh triggered');
                setLastRefreshTime(Date.now());
                setTimeUntilRefresh(REFRESH_INTERVAL_SECONDS);
                onRefresh?.();
            } else {
                setTimeUntilRefresh(remaining);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [autoRefreshEnabled, lastRefreshTime, onRefresh]);

    // ✅ NEW: Save auto-refresh settings to localStorage
    useEffect(() => {
        localStorage.setItem('autoRefreshEnabled', JSON.stringify(autoRefreshEnabled));
    }, [autoRefreshEnabled]);

    // ✅ NEW: Format countdown timer
    const formatCountdown = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Check if user is admin or assignor
    const isAdmin = role === 'admin';
    const isAssignor = role === 'assignor';
    const isGreenTheme = theme === 'admin'; // ✅ fixed typo: was 'adminn'

    // Check user permissions for settings access
    const canCreateDoctor = ['admin', 'group_id'].includes(role);
    const canCreateLab = ['admin'].includes(role);
    const canCreateUser = ['admin', 'group_id'].includes(role);
    const hasSettingsAccess = canCreateDoctor || canCreateLab || canCreateUser || isAdmin;

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
                const val = searchParams[key];
                if (val === '' || val === 'all' || val === undefined) {
                    delete searchParams[key];
                }
                if (Array.isArray(val) && val.length === 0) {
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
    }, [filters, onSearch, onFilterChange]);

    // Execute search
    const handleSearch = useCallback((term = searchTerm) => {
        const searchParams = { ...filters };
        
        if (term && term.trim()) {
            searchParams.search = term.trim();
        }
        
        if (filters.modalities && filters.modalities.length > 0) {
            searchParams.modalities = filters.modalities;
        }
        
        // ✅ ADD THIS: Handle priorities multi-select
        if (filters.priorities && filters.priorities.length > 0) {
            searchParams.priorities = filters.priorities;
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

        if (key === 'dateFilter' && value === 'custom') {
            setShowAdvanced(true);
        }
        
        const searchParams = { ...newFilters };
        
        if (searchTerm && searchTerm.trim()) {
            searchParams.search = searchTerm.trim();
        } else {
            delete searchParams.search;
        }
        
        if (newFilters.modalities && newFilters.modalities.length > 0) {
            searchParams.modalities = newFilters.modalities;
        }
        
        // ✅ ADD THIS: Handle priorities multi-select
        if (newFilters.priorities && newFilters.priorities.length > 0) {
            searchParams.priorities = newFilters.priorities;
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
            modalities: [],
            labId: 'all',
            priority: 'all',
            priorities: [],           // ✅ ADD THIS
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
        setTimeUntilRefresh(REFRESH_INTERVAL_SECONDS);
        onRefresh?.();
    }, [onRefresh]);

    // ✅ NEW: Toggle auto-refresh
    const handleToggleAutoRefresh = useCallback(() => {
        const newState = !autoRefreshEnabled;
        setAutoRefreshEnabled(newState);
        if (newState) {
            setLastRefreshTime(Date.now());
            setTimeUntilRefresh(REFRESH_INTERVAL_SECONDS);
        }
    }, [autoRefreshEnabled]);

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
        { value: 'EMERGENCY', label: '🚨 Emergency' },
        { value: 'PRIORITY', label: '⭐ Priority' },
        { value: 'MLC',      label: '⚖️ MLC' },
        { value: 'NORMAL',   label: '🟢 Normal' },
        { value: 'STAT',     label: '⏱️ STAT' },
    ];

    const hasActiveFilters = searchTerm || Object.values(filters).some(v => v !== 'all' && v !== 'today' && v !== 'createdAt' && v !== '' && v !== 50);

    // Fetch filter options for radiologists and labs
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                // ✅ FIX: Use correct separate endpoints (matching filterOptions.controller.js routes)
                const [radResponse, labResponse] = await Promise.all([
                    api.get('/admin/filters/radiologists'),
                    api.get('/admin/filters/labs')
                ]);

                if (radResponse.data.success) {
                    // ✅ FIX: Controller already returns {value, label} — use data directly
                    setRadiologistOptions(radResponse.data.data);
                }

                if (labResponse.data.success) {
                    // ✅ FIX: Controller already returns {value, label} — use data directly
                    setLabOptions(labResponse.data.data);
                }
            } catch (error) {
                console.error('Error fetching filter options:', error);
            }
        };

        // ✅ Only fetch if user can access these filters
        if (['super_admin', 'admin', 'assignor'].includes(role)) {
            fetchFilterOptions();
        }
    }, [role]);

    const canAccessAdvancedFilters = ['super_admin', 'admin', 'assignor'].includes(role);

    return (
        <div className={`bg-white border-b ${themeColors.border} px-3 py-1.5`}>
            {/* MAIN SEARCH ROW */}
            <div className="flex flex-wrap items-center gap-1.5">
                
                {/* SEARCH INPUT */}
                <div className="relative w-full sm:w-36 md:w-40 lg:w-44 xl:w-48 flex-shrink-0 order-1">
                    <SearchIcon className={`absolute left-2 top-1/2 transform -translate-y-1/2 text-${themeColors.textSecondary}`} size={13} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search patients, IDs..."
                        className={`w-full pl-7 pr-6 py-1 text-xs border border-${themeColors.border} rounded ${themeColors.focus} transition-colors`}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => handleSearchChange('')}
                            className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-${themeColors.textSecondary} hover:text-${themeColors.text} p-0.5`}
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>

                {/* QUICK FILTERS */}
                <div className="flex flex-wrap items-center gap-1 order-2">
                    <MultiSelect
                        options={modalityMultiSelectOptions}
                        selected={filters.modalities}
                        onChange={(selected) => handleFilterChange('modalities', selected)}
                        placeholder="Modality"
                        className="w-20 sm:w-24"
                    />

                    <MultiSelect
                        options={priorityOptions}
                        selected={filters.priorities}
                        onChange={(selected) => handleFilterChange('priorities', selected)}
                        placeholder="Priority"
                        className="w-20 sm:w-24"
                    />

                    {canAccessAdvancedFilters && (
                        <MultiSelect
                            options={radiologistOptions}
                            selected={filters.radiologists}
                            onChange={(selected) => handleFilterChange('radiologists', selected)}
                            placeholder="Radiologist"
                            className="w-24 sm:w-28 lg:w-32"
                        />
                    )}

                    {canAccessAdvancedFilters && (
                        <MultiSelect
                            options={labOptions}
                            selected={filters.labs}
                            onChange={(selected) => handleFilterChange('labs', selected)}
                            placeholder="Center"
                            className="w-24 sm:w-28 lg:w-32"
                        />
                    )}

                    {isAssignor && (
                        <select
                            value={filters.assigneeRole}
                            onChange={(e) => handleFilterChange('assigneeRole', e.target.value)}
                            className={`px-2 py-1.5 text-xs border border-${themeColors.border} rounded bg-white text-${themeColors.text} ${themeColors.focus} min-w-16 sm:min-w-20`}
                        >
                            <option value="all">All Roles</option>
                            <option value="radiologist">Radiologist</option>
                            <option value="verifier">Verifier</option>
                        </select>
                    )}
                </div>

                {/* TIME FILTERS */}
                <div className="hidden md:flex items-center gap-0.5 order-3">
                    {['Today', 'Yesterday', '7 Days'].map((period) => {
                        const isActive = 
                            (period === 'Today' && filters.dateFilter === 'today') ||
                            (period === 'Yesterday' && filters.dateFilter === 'yesterday') ||
                            (period === '7 Days' && filters.dateFilter === 'last7days')
                        
                        const value = 
                            period === 'Today' ? 'today' :
                            period === 'Yesterday' ? 'yesterday' :
                            period === '7 Days' ? 'last7days' :
                            'last30days';

                        return (
                            <button
                                key={period}
                                onClick={() => handleFilterChange('dateFilter', value)}
                                className={`px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                                    isActive
                                        ? isGreenTheme 
                                            ? 'bg-teal-600 text-white hover:bg-teal-700' 
                                            : 'bg-gray-900 text-white hover:bg-gray-800'
                                        : isGreenTheme
                                            ? 'text-teal-600 hover:bg-teal-50 border border-teal-300'
                                            : 'text-gray-500 hover:bg-gray-100 border border-gray-200'
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
                            className={`px-1.5 py-0.5 text-[11px] border ${isGreenTheme ? 'border-teal-300' : 'border-gray-200'} rounded bg-white ${isGreenTheme ? 'text-teal-700 focus:ring-teal-500 focus:border-teal-500' : 'text-gray-600 focus:ring-black focus:border-black'} focus:outline-none focus:ring-1 min-w-20`}
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

                {/* Mobile date filter dropdown */}
                <div className="flex md:hidden items-center order-3">
                    <select
                        value={filters.dateFilter || 'today'}
                        onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
                        className={`px-2 py-1.5 text-xs border ${isGreenTheme ? 'border-teal-300' : 'border-gray-300'} rounded bg-white ${isGreenTheme ? 'text-teal-700' : 'text-gray-700'} focus:outline-none focus:ring-1 ${isGreenTheme ? 'focus:ring-teal-500' : 'focus:ring-black'}`}
                    >
                        <option value="">All Time</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="last7days">Last 7 Days</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>

                

                {/* ASSIGNOR ANALYTICS */}
                {isAssignor && analytics && (
                    <div className={`hidden lg:flex items-center gap-2 pl-2 border-l border-${themeColors.border} order-5`}>
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

                {/* AUTO-REFRESH CONTROLS */}
                <div className={`flex items-center gap-1 pl-1.5 border-l border-${themeColors.border} order-6`}>
                    <button
                        onClick={handleToggleAutoRefresh}
                        className={`flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border transition-colors ${
                            autoRefreshEnabled
                                ? isGreenTheme
                                    ? 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'
                                    : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                                : isGreenTheme
                                    ? 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                        title={autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
                    >
                        {autoRefreshEnabled ? <Play size={11} /> : <Pause size={11} />}
                        {autoRefreshEnabled && (
                            <span className="hidden sm:inline font-mono text-[10px]">
                                {formatCountdown(timeUntilRefresh)}
                            </span>
                        )}
                    </button>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center gap-0.5 order-7">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`px-1.5 py-1 text-[11px] font-medium rounded border transition-colors flex items-center gap-1 ${
                            showAdvanced 
                                ? isGreenTheme 
                                    ? `bg-teal-600 text-white border-teal-600` 
                                    : 'bg-gray-900 text-white border-gray-900'
                                : isGreenTheme
                                    ? `bg-white text-${themeColors.text} border-${themeColors.border} hover:bg-${themeColors.primaryLight}`
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Filter size={11} />
                        <span className="hidden sm:inline">Filters</span>
                        <ChevronDown size={9} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    </button>

                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="px-1.5 py-1 bg-red-50 text-red-600 text-[11px] font-medium rounded border border-red-200 hover:bg-red-100 transition-colors"
                        >
                            Clear
                        </button>
                    )}

                    <button
                        onClick={handleRefreshClick}
                        disabled={loading}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-all disabled:opacity-50 ${
                            loading ? 'cursor-wait' : 'cursor-pointer'
                        } ${
                            isGreenTheme
                                ? 'bg-teal-600 text-white border-teal-600 hover:bg-teal-700'
                                : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                        }`}
                        title="Manual refresh"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {/* ADVANCED FILTERS PANEL */}
            {(showAdvanced || filters.dateFilter === 'custom') && (
                <div className={`mt-1.5 pt-1.5 border-t border-${themeColors.borderLight}`}>
                    <div className="flex flex-wrap items-end gap-3">

                        <div className="flex flex-col min-w-[140px]">
                            <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                Date Range
                            </label>
                            <select
                                value={filters.dateFilter || 'today'}
                                onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
                                className={`px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value="">All Time</option>
                                {dateOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col min-w-[110px]">
                            <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                Date Type
                            </label>
                            <select
                                value={filters.dateType || 'createdAt'}
                                onChange={(e) => handleFilterChange('dateType', e.target.value)}
                                className={`px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value="createdAt">Upload Date</option>
                                <option value="StudyDate">Study Date</option>
                            </select>
                        </div>

                        {filters.dateFilter === 'custom' && (
                            <div className="flex flex-col min-w-[130px]">
                                <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                    From Date
                                </label>
                                <input
                                    type="date"
                                    value={filters.customDateFrom || ''}
                                    onChange={(e) => handleFilterChange('customDateFrom', e.target.value)}
                                    className={`px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                                />
                            </div>
                        )}

                        {filters.dateFilter === 'custom' && (
                            <div className="flex flex-col min-w-[130px]">
                                <label className={`block text-xs font-medium text-${themeColors.textSecondary} mb-1`}>
                                    To Date
                                </label>
                                <input
                                    type="date"
                                    value={filters.customDateTo || ''}
                                    onChange={(e) => handleFilterChange('customDateTo', e.target.value)}
                                    className={`px-2 py-1.5 text-xs border border-${themeColors.border} rounded ${themeColors.focus} bg-white`}
                                />
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* ✅ NEW: Settings Modal */}
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                onNavigate={navigate}
                theme={theme}
            />
  
        </div>
    );
};

export default Search;