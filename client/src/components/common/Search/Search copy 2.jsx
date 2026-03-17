import React, { useState, useCallback } from 'react';
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
    Crown
} from 'lucide-react';

const Search = ({ 
    onSearch, 
    onFilterChange, 
    loading = false,
    totalStudies = 0,
    currentCategory = 'all',
    analytics = null,
    theme = 'default' // ✅ ADD THEME PROP
}) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    
    // State management
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({
        category: currentCategory,
        modality: 'all',
        labId: 'all',
        priority: 'all',
        assigneeRole: 'all',
        dateFilter: 'today',
        dateType: 'createdAt',
        customDateFrom: '',
        customDateTo: '',
        limit: 50
    });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);

    // ✅ THEME COLORS
    const isGreenTheme = theme === 'admin';
    const themeColors = {
        border: isGreenTheme ? 'border-gray-300' : 'border-teal-300',
        borderLight: isGreenTheme ? 'border-teal-200' : 'border-teal-200',
        bg: isGreenTheme ? 'bg-white' : 'bg-teal',
        bgSecondary: isGreenTheme ? 'bg-teal-100' : 'bg-teal-50',
        text: isGreenTheme ? 'text-teal-900' : 'text-gray-900',
        textSecondary: isGreenTheme ? 'text-teal-700' : 'text-gray-700',
        textMuted: isGreenTheme ? 'text-teal-600' : 'text-gray-500',
        focus: isGreenTheme ? 'focus:ring-teal-500 focus:border-teal-500' : 'focus:ring-black focus:border-black',
        accent: isGreenTheme ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-black text-white hover:bg-gray-800',
        accentSecondary: isGreenTheme ? 'bg-teal-500 hover:bg-teal-600' : 'bg-gray-600 hover:bg-gray-700'
    };

    // Check if user is admin or assignor
    const isAdmin = currentUser?.role === 'admin';
    const isAssignor = currentUser?.role === 'assignor';

    // Check user permissions for creating entities
    const canCreateDoctor = ['super_admin', 'admin', 'group_id'].includes(currentUser?.role);
    const canCreateLab = ['super_admin', 'admin'].includes(currentUser?.role);
    const canCreateUser = ['super_admin', 'admin', 'group_id'].includes(currentUser?.role);

    // Handle search input change with debouncing
    const handleSearchChange = useCallback((value) => {
        setSearchTerm(value);
        
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        const newTimeout = setTimeout(() => {
            handleSearch(value);
        }, 300);
        
        setSearchTimeout(newTimeout);
    }, [searchTimeout]);

    // Execute search
    const handleSearch = useCallback((term = searchTerm) => {
        const searchParams = {
            search: term.trim() || undefined,
            ...filters
        };
        
        Object.keys(searchParams).forEach(key => {
            if (searchParams[key] === '' || searchParams[key] === 'all' || searchParams[key] === undefined) {
                delete searchParams[key];
            }
        });
        
        onSearch?.(searchParams);
    }, [searchTerm, filters, onSearch]);

    // Handle filter changes
    const handleFilterChange = useCallback((key, value) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        
        const searchParams = {
            search: searchTerm.trim() || undefined,
            ...newFilters
        };
        
        Object.keys(searchParams).forEach(key => {
            if (searchParams[key] === '' || searchParams[key] === 'all' || searchParams[key] === undefined) {
                delete searchParams[key];
            }
        });
        
        onSearch?.(searchParams);
        onFilterChange?.(newFilters);
    }, [filters, searchTerm, onSearch, onFilterChange]);

    // Clear all filters
    const clearAllFilters = useCallback(() => {
        setSearchTerm('');
        const defaultFilters = {
            category: 'all',
            modality: 'all',
            labId: 'all',
            priority: 'all',
            assigneeRole: 'all',
            dateFilter: 'today',
            dateType: 'createdAt',
            customDateFrom: '',
            customDateTo: '',
            limit: 50
        };
        setFilters(defaultFilters);
        onSearch?.(defaultFilters);
        onFilterChange?.(defaultFilters);
    }, [onSearch, onFilterChange]);

    const handleRefresh = useCallback(() => {
        handleSearch();
    }, [handleSearch]);

    // ✅ ADMIN ACTION HANDLERS
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
    const modalityOptions = [
        { value: 'all', label: 'All' },
        { value: 'CT', label: 'CT' },
        { value: 'MR', label: 'MRI' },
        { value: 'CR', label: 'CR' },
        { value: 'DX', label: 'DX' },
        { value: 'PR', label: 'PR' }
    ];

    const priorityOptions = [
        { value: 'all', label: 'All' },
        { value: 'STAT', label: 'STAT' },
        { value: 'URGENT', label: 'Urgent' },
        { value: 'NORMAL', label: 'Normal' }
    ];

    // ✅ ENHANCED DATE OPTIONS
    const dateOptions = [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'last2days', label: 'Last 2 Days' },
        { value: 'last7days', label: 'Last 7 Days' },
        { value: 'last30days', label: 'Last 30 Days' },
        { value: 'thisWeek', label: 'This Week' },
        { value: 'lastWeek', label: 'Last Week' },
        { value: 'thisMonth', label: 'This Month' },
        { value: 'lastMonth', label: 'Last Month' },
        { value: 'thisYear', label: 'This Year' },
        { value: 'custom', label: 'Custom Range' }
    ];

    const hasActiveFilters = searchTerm || Object.values(filters).some(v => v !== 'all' && v !== 'today' && v !== 'createdAt' && v !== '' && v !== 50);

    return (
        <div className={`${themeColors.bg} border-b ${themeColors.border} px-3 py-2.5`}>
            {/* ✅ COMPACT MAIN SEARCH ROW */}
            <div className="flex items-center gap-2">
                
                {/* ✅ COMPACT SEARCH INPUT WITH GREEN THEME */}
                <div className="flex-1 relative max-w-md">
                    <SearchIcon className={`absolute left-2.5 top-1/2 transform -translate-y-1/2 ${themeColors.textMuted}`} size={14} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search patients, IDs..."
                        className={`w-full pl-8 pr-6 py-1.5 text-xs border ${themeColors.border} rounded ${themeColors.focus} transition-colors bg-white ${themeColors.text}`}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => handleSearchChange('')}
                            className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${themeColors.textMuted} hover:${themeColors.textSecondary} p-0.5`}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* ✅ COMPACT QUICK FILTERS WITH GREEN THEME */}
                <div className="flex items-center gap-1">
                    <select
                        value={filters.modality}
                        onChange={(e) => handleFilterChange('modality', e.target.value)}
                        className={`px-2 py-1.5 text-xs border ${themeColors.border} rounded bg-white ${themeColors.textSecondary} ${themeColors.focus} min-w-16`}
                    >
                        {modalityOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <select
                        value={filters.priority}
                        onChange={(e) => handleFilterChange('priority', e.target.value)}
                        className={`px-2 py-1.5 text-xs border ${themeColors.border} rounded bg-white ${themeColors.textSecondary} ${themeColors.focus} min-w-16`}
                    >
                        {priorityOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    {/* ✅ ASSIGNOR-SPECIFIC FILTER WITH GREEN THEME */}
                    {isAssignor && (
                        <select
                            value={filters.assigneeRole}
                            onChange={(e) => handleFilterChange('assigneeRole', e.target.value)}
                            className={`px-2 py-1.5 text-xs border ${themeColors.border} rounded bg-white ${themeColors.textSecondary} ${themeColors.focus} min-w-20`}
                        >
                            <option value="all">All Roles</option>
                            <option value="radiologist">Radiologist</option>
                            <option value="verifier">Verifier</option>
                        </select>
                    )}
                </div>

                {/* ✅ COMPACT TIME FILTERS WITH GREEN THEME */}
                <div className="flex items-center gap-1">
                    {/* Quick date buttons for most common options */}
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
                                onClick={() => {
                                    console.log(`🔍 [Search] QUICK DATE FILTER: ${period} -> ${value}`);
                                    handleFilterChange('dateFilter', value);
                                }}
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
                    
                    {/* ✅ UPDATED: More options dropdown with teal colors */}
                    <div className="relative">
                        <select
                            value={filters.dateFilter || 'today'}
                            onChange={(e) => {
                                console.log(`🔍 [Search] DROPDOWN DATE FILTER: ${e.target.value}`);
                                handleFilterChange('dateFilter', e.target.value);
                            }}
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

                {/* ✅ ENHANCED ADMIN BUTTONS WITH GREEN THEME */}
                {(canCreateDoctor || canCreateLab || canCreateUser) && (
                    <div className={`flex items-center gap-1 pl-2 border-l ${themeColors.borderLight}`}>
                        
                        {/* ✅ UPDATED: Manage Users Button with teal gradient */}
                        {isAdmin && (
                            <button
                                onClick={() => navigate('/admin/user-management')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${
                                    isGreenTheme 
                                        ? 'bg-gradient-to-r from-teal-600 to-green-600 text-white hover:from-teal-700 hover:to-green-700' 
                                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                                } text-xs font-medium rounded transition-colors`}
                                title="Manage Users"
                            >
                                <Shield size={12} />
                                <span className="hidden sm:inline">Manage</span>
                            </button>
                        )}
                        
                        {/* ✅ UPDATED: Create User Button with teal gradient */}
                        {canCreateUser && (
                            <button
                                onClick={handleCreateUser}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${
                                    isGreenTheme 
                                        ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700' 
                                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
                                } text-xs font-medium rounded transition-colors`}
                                title="Create New User"
                            >
                                <Users size={12} />
                                <span className="hidden sm:inline">User</span>
                            </button>
                        )}
                        
                        {/* ✅ UPDATED: Create Doctor Button with teal colors */}
                        {canCreateDoctor && (
                            <button
                                onClick={handleCreateDoctor}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${
                                    isGreenTheme 
                                        ? 'bg-teal-600 text-white hover:bg-teal-700' 
                                        : 'bg-black text-white hover:bg-gray-800'
                                } text-xs font-medium rounded transition-colors`}
                                title="Create Doctor Account"
                            >
                                <UserPlus size={12} />
                                <span className="hidden sm:inline">Doctor</span>
                            </button>
                        )}
                        
                        {/* ✅ UPDATED: Create Lab Button with teal colors */}
                        {canCreateLab && (
                            <button
                                onClick={handleCreateLab}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 ${
                                    isGreenTheme 
                                        ? 'bg-green-600 text-white hover:bg-green-700' 
                                        : 'bg-gray-700 text-white hover:bg-gray-800'
                                } text-xs font-medium rounded transition-colors`}
                                title="Create Lab"
                            >
                                <Building size={12} />
                                <span className="hidden sm:inline">Lab</span>
                            </button>
                        )}
                    </div>
                )}

                {/* ✅ ASSIGNOR ANALYTICS DISPLAY WITH GREEN THEME */}
                {isAssignor && analytics && (
                    <div className={`flex items-center gap-2 pl-2 border-l ${themeColors.borderLight}`}>
                        <div className="text-xs">
                            <span className={themeColors.textMuted}>Unassigned:</span>
                            <span className="font-bold text-red-600 ml-1">{analytics.overview?.totalUnassigned || 0}</span>
                        </div>
                        <div className="text-xs">
                            <span className={themeColors.textMuted}>Assigned:</span>
                            <span className={`font-bold ${isGreenTheme ? 'text-green-700' : 'text-green-600'} ml-1`}>{analytics.overview?.totalAssigned || 0}</span>
                        </div>
                        <div className="text-xs">
                            <span className={themeColors.textMuted}>Overdue:</span>
                            <span className="font-bold text-orange-600 ml-1">{analytics.overview?.overdueStudies || 0}</span>
                        </div>
                    </div>
                )}

                {/* ✅ COMPACT ACTION BUTTONS WITH GREEN THEME */}
                <div className="flex items-center gap-1">
                    {/* Advanced Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`px-2 py-1.5 text-xs font-medium rounded border transition-colors flex items-center gap-1 ${
                            showAdvanced 
                                ? themeColors.accent
                                : `bg-white ${themeColors.textSecondary} ${themeColors.border} hover:${themeColors.bgSecondary}`
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

                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className={`p-1.5 ${themeColors.textMuted} hover:${themeColors.textSecondary} hover:${themeColors.bgSecondary} rounded transition-colors disabled:opacity-50`}
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* ✅ COMPACT RESULTS COUNT WITH GREEN THEME */}
                <div className={`flex items-center gap-1 text-xs ${themeColors.textMuted} pl-2 border-l ${themeColors.borderLight}`}>
                    <span className={`font-bold ${themeColors.text}`}>{totalStudies.toLocaleString()}</span>
                    <span className="hidden sm:inline">studies</span>
                    {loading && <span className={`${isGreenTheme ? 'text-green-700' : 'text-green-600'} font-medium`}>• Live</span>}
                </div>
            </div>

            {/* ✅ COMPACT ADVANCED FILTERS PANEL WITH GREEN THEME */}
            {showAdvanced && (
                <div className={`mt-2.5 pt-2.5 border-t ${themeColors.borderLight}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        
                        {/* Date Range Selector */}
                        <div className="col-span-2">
                            <label className={`block text-xs font-medium ${themeColors.textSecondary} mb-1`}>
                                Date Range
                            </label>
                            <select
                                value={filters.dateFilter || 'today'}
                                onChange={(e) => handleFilterChange('dateFilter', e.target.value)}
                                className={`w-full px-2 py-1.5 text-xs border ${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value="">All Time</option>
                                {dateOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Type */}
                        <div>
                            <label className={`block text-xs font-medium ${themeColors.textSecondary} mb-1`}>
                                Date Type
                            </label>
                            <select
                                value={filters.dateType || 'createdAt'}
                                onChange={(e) => handleFilterChange('dateType', e.target.value)}
                                className={`w-full px-2 py-1.5 text-xs border ${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value="createdAt">Upload Date</option>
                                <option value="StudyDate">Study Date</option>
                            </select>
                        </div>

                        {/* Custom Date Range */}
                        {filters.dateFilter === 'custom' && (
                            <>
                                <div>
                                    <label className={`block text-xs font-medium ${themeColors.textSecondary} mb-1`}>
                                        From Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.customDateFrom || ''}
                                        onChange={(e) => handleFilterChange('customDateFrom', e.target.value)}
                                        className={`w-full px-2 py-1.5 text-xs border ${themeColors.border} rounded ${themeColors.focus} bg-white`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs font-medium ${themeColors.textSecondary} mb-1`}>
                                        To Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.customDateTo || ''}
                                        onChange={(e) => handleFilterChange('customDateTo', e.target.value)}
                                        className={`w-full px-2 py-1.5 text-xs border ${themeColors.border} rounded ${themeColors.focus} bg-white`}
                                    />
                                </div>
                            </>
                        )}

                        {/* Lab Selector */}
                        <div>
                            <label className={`block text-xs font-medium ${themeColors.textSecondary} mb-1`}>
                                Lab
                            </label>
                            <select
                                value={filters.labId || 'all'}
                                onChange={(e) => handleFilterChange('labId', e.target.value)}
                                className={`w-full px-2 py-1.5 text-xs border ${themeColors.border} rounded ${themeColors.focus} bg-white`}
                            >
                                <option value="all">All Labs</option>
                                {/* Add lab options dynamically */}
                            </select>
                        </div>

                        {/* Results Per Page */}
                        <div>
                            <label className={`block text-xs font-medium ${themeColors.textSecondary} mb-1`}>
                                Per Page
                            </label>
                            <select
                                value={filters.limit || 50}
                                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                                className={`w-full px-2 py-1.5 text-xs border ${themeColors.border} rounded ${themeColors.focus} bg-white`}
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