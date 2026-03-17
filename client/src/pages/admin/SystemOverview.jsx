import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  Database, 
  Users, 
  Building2, 
  Activity, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  BarChart3,
  PieChart,
  Calendar,
  Zap
} from 'lucide-react';
import api from '../../services/api';
import Navbar from '../../components/common/Navbar';

const SystemOverview = () => {
  const { currentUser, currentOrganizationContext } = useAuth();
  
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    setLoading(true);
    try {
      const [overviewResponse, healthResponse] = await Promise.all([
        api.get('/admin/system-overview'),
        api.get('/admin/system-health')
      ]);

      if (overviewResponse.data.success) {
        setOverview(overviewResponse.data.overview);
      }

      if (healthResponse.data.success) {
        setHealth(healthResponse.data.health);
      }
    } catch (err) {
      console.error('Failed to load system data:', err);
      setError('Failed to load system overview');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadSystemData();
  };

  // Helper function to format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  // Helper function to format time
  const formatTime = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'fair': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar title="System Overview" subtitle="Loading system metrics..." />
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2 text-gray-500">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading system overview...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ MINIMALIST NAVBAR */}
      <Navbar
        title="System Overview"
        subtitle={`${currentOrganizationContext === 'global' ? 'Global System' : currentOrganizationContext || 'Organization'} • Performance Analytics`}
        showOrganizationSelector={true}
        onRefresh={handleRefresh}
        notifications={health?.metrics?.errorStudies || 0}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ✅ SYSTEM HEALTH BAR */}
        {health && (
          <div className="bg-white border border-gray-200 rounded-lg mb-6 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                    health.score > 90 ? 'bg-green-100' : 
                    health.score > 70 ? 'bg-blue-100' : 
                    health.score > 50 ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    {health.score > 90 ? <CheckCircle className="h-5 w-5 text-green-600" /> :
                     health.score > 50 ? <Activity className="h-5 w-5 text-blue-600" /> :
                     <AlertTriangle className="h-5 w-5 text-red-600" />}
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{health.score}%</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">System Health</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">Status:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(health.status)}`}>
                      {health.status.toUpperCase()}
                    </span>
                  </div>
                  
                  {health.metrics.errorStudies > 0 && (
                    <div className="flex items-center space-x-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{health.metrics.errorStudies} errors</span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{health.metrics.activeUsers} active users</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ✅ MAIN METRICS GRID */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            
            {/* Studies Metric */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                    <Database className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{formatNumber(overview.studies.total)}</div>
                    <div className="text-sm text-gray-500">Total Studies</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Today</span>
                  <span className="font-medium text-gray-900">{overview.studies.today}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">This Week</span>
                  <span className="font-medium text-gray-900">{overview.studies.thisWeek}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">This Month</span>
                  <span className="font-medium text-gray-900">{overview.studies.thisMonth}</span>
                </div>
              </div>
            </div>

            {/* Users Metric */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{overview.users.total}</div>
                    <div className="text-sm text-gray-500">Total Users</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Active</span>
                  <span className="font-medium text-green-600">{overview.users.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Recent Logins</span>
                  <span className="font-medium text-gray-900">{overview.users.recentLogins}</span>
                </div>
                {overview.users.inactive > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Inactive</span>
                    <span className="font-medium text-red-600">{overview.users.inactive}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Labs Metric */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{overview.labs.total}</div>
                    <div className="text-sm text-gray-500">Connected Labs</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Active</span>
                  <span className="font-medium text-green-600">{overview.labs.active}</span>
                </div>
                {overview.labs.inactive > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Inactive</span>
                    <span className="font-medium text-red-600">{overview.labs.inactive}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Metric */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-lg">
                    <Zap className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{Math.round(overview.workflow.efficiency)}%</div>
                    <div className="text-sm text-gray-500">Efficiency</div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Avg TAT</span>
                  <span className="font-medium text-gray-900">{formatTime(overview.workflow.averageTAT)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Today Done</span>
                  <span className="font-medium text-green-600">{overview.performance.todayCompleted}</span>
                </div>
                {overview.workflow.overdueStudies > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Overdue</span>
                    <span className="font-medium text-red-600">{overview.workflow.overdueStudies}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ✅ DETAILED BREAKDOWN SECTIONS */}
        {overview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            
            {/* Workflow Status Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Workflow Status</h3>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  {overview.workflow.statusBreakdown.map((status, index) => (
                    <div key={status._id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          ['new_study_received', 'pending_assignment'].includes(status._id) ? 'bg-yellow-500' :
                          ['assigned_to_doctor', 'report_in_progress'].includes(status._id) ? 'bg-blue-500' :
                          ['report_finalized', 'report_verified'].includes(status._id) ? 'bg-green-500' :
                          'bg-gray-400'
                        }`}></div>
                        <span className="text-sm text-gray-600 capitalize">
                          {status._id.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">{status.count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gray-600 h-2 rounded-full"
                            style={{ 
                              width: `${(status.count / overview.studies.total * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modality Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <PieChart className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Modality Distribution</h3>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  {overview.studies.breakdown.modality.slice(0, 6).map((modality, index) => (
                    <div key={modality._id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          ['CT', 'MRI'].includes(modality._id) ? 'bg-blue-500' :
                          ['XR', 'CR', 'DX'].includes(modality._id) ? 'bg-green-500' :
                          'bg-purple-500'
                        }`}></div>
                        <span className="text-sm text-gray-600 font-mono">
                          {modality._id || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">{modality.count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gray-600 h-2 rounded-full"
                            style={{ 
                              width: `${(modality.count / overview.studies.total * 100)}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ RECENT ACTIVITY */}
        {overview?.recentActivity && (
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
                <span className="text-sm text-gray-500">{overview.recentActivity.length} recent studies</span>
              </div>
            </div>
            
            <div className="divide-y divide-gray-50">
              {overview.recentActivity.slice(0, 8).map((activity) => (
                <div key={activity._id} className="px-6 py-3 hover:bg-gray-25 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {activity.patientName} • {activity.modality}
                        </div>
                        <div className="text-xs text-gray-500">
                          {activity.accessionNumber} • {activity.labName} • {activity.assignedTo}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        activity.workflowStatus.includes('finalized') || activity.workflowStatus.includes('verified') 
                          ? 'bg-green-50 text-green-700' 
                          : activity.workflowStatus.includes('progress') 
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}>
                        {activity.workflowStatus.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(activity.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemOverview;