import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/common/Navbar';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
    Receipt,
    Calendar,
    Search,
    Download,
    Eye,
    ChevronLeft,
    ChevronRight,
    Filter,
    ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';

const LabBilling = () => {
    const { currentUser } = useAuth();
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalAmount, setTotalAmount] = useState(0);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,
        recordsPerPage: 50
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    useEffect(() => {
        fetchBillingData();
    }, [pagination.currentPage, paymentStatus, dateRange]);

    const fetchBillingData = async () => {
        try {
            setLoading(true);
            const params = {
                page: pagination.currentPage,
                limit: pagination.recordsPerPage,
                ...(paymentStatus && { paymentStatus }),
                ...(dateRange.from && { from: dateRange.from }),
                ...(dateRange.to && { to: dateRange.to })
            };

            const response = await api.get(`/billing/reports/lab/${currentUser.lab?._id || 'all'}`, { params });

            if (response.data.success) {
                setStudies(response.data.data);
                setTotalAmount(response.data.totalAmount);
                setPagination(prev => ({
                    ...prev,
                    totalPages: response.data.pagination.totalPages,
                    totalRecords: response.data.pagination.totalRecords
                }));
            }
        } catch (error) {
            console.error('Error fetching billing data:', error);
            toast.error('Failed to load billing data');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        // Implement local search on the fetched data, or debounce and search server-side
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, currentPage: newPage }));
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'failed': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    // Filter studies locally based on search term (since text search isn't in this specific endpoint yet for lab)
    const filteredStudies = studies.filter(study =>
        !searchTerm ||
        study.bharatPacsId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        study.patientInfo?.patientName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <Navbar
                title="Lab Billing"
                subtitle={`${currentUser.lab?.name || 'Lab'} • Ongoing Statements`}
                onRefresh={fetchBillingData}
            />

            <div className="flex-1 p-6 max-w-[1600px] w-full mx-auto">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Receipt className="w-16 h-16 text-sky-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Billed Amount</h3>
                        <div className="text-3xl font-extrabold text-gray-900">
                            ₹{totalAmount.toLocaleString()}
                        </div>
                        <p className="text-xs text-gray-400 mt-2 font-medium">All time processed value</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Activity className="w-16 h-16 text-emerald-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Billed Studies</h3>
                        <div className="text-3xl font-extrabold text-gray-900">
                            {pagination.totalRecords}
                        </div>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Total studies processed</p>
                    </div>

                    <div className="bg-sky-900 rounded-xl shadow-sm p-6 flex flex-col justify-center relative overflow-hidden text-white">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-800 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
                        <h3 className="text-sm font-semibold text-sky-200 uppercase tracking-wider mb-2 relative z-10">Current Status</h3>
                        <div className="text-xl font-bold relative z-10 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"></span>
                            Active Billing Cycle
                        </div>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="bg-white rounded-t-xl border border-gray-200 border-b-0 p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by BP ID or Patient..."
                                value={searchTerm}
                                onChange={handleSearch}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium placeholder-gray-400"
                            />
                        </div>

                        <select
                            value={paymentStatus}
                            onChange={(e) => setPaymentStatus(e.target.value)}
                            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-gray-700"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateRange.from}
                                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                className="bg-transparent text-sm text-gray-700 focus:outline-none font-medium"
                            />
                            <span className="text-gray-400 text-xs">to</span>
                            <input
                                type="date"
                                value={dateRange.to}
                                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                className="bg-transparent text-sm text-gray-700 focus:outline-none font-medium"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold transition-colors shadow-sm whitespace-nowrap">
                            <Download className="w-4 h-4 text-gray-500" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white border text-sm border-gray-200 rounded-b-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="overflow-x-auto flex-1 h-[500px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#f8fafc] sticky top-0 z-10 shadow-[0_1px_0_#e2e8f0]">
                                <tr>
                                    <th className="py-3 px-4 text-xs font-bold tracking-wider text-gray-500 uppercase border-b border-gray-200 group cursor-pointer hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-1">BP ID <ArrowUpDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600" /></div>
                                    </th>
                                    <th className="py-3 px-4 text-xs font-bold tracking-wider text-gray-500 uppercase border-b border-gray-200">Patient Details</th>
                                    <th className="py-3 px-4 text-xs font-bold tracking-wider text-gray-500 uppercase border-b border-gray-200">Modality</th>
                                    <th className="py-3 px-4 text-xs font-bold tracking-wider text-gray-500 uppercase border-b border-gray-200">Service / Module</th>
                                    <th className="py-3 px-4 text-xs font-bold tracking-wider text-gray-500 uppercase border-b border-gray-200">Billed Date</th>
                                    <th className="py-3 px-4 text-xs font-bold tracking-wider text-gray-500 uppercase border-b border-gray-200 text-right">Amount</th>
                                    <th className="py-3 px-4 text-xs font-bold tracking-wider text-gray-500 uppercase border-b border-gray-200 text-center">Status</th>
                                    <th className="py-3 px-4 text-xs font-bold tracking-wider text-gray-500 uppercase border-b border-gray-200"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" className="py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600 mb-3"></div>
                                                <p className="font-medium text-sm">Loading billing records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredStudies.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="py-16 text-center text-gray-500">
                                            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-900 font-semibold mb-1">No records found</p>
                                            <p className="text-xs text-gray-500">Try adjusting your filters or date range.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudies.map((study, idx) => (
                                        <tr key={study._id} className="hover:bg-sky-50/30 transition-colors">
                                            <td className="py-2.5 px-4 font-mono text-xs text-slate-800 font-semibold align-middle whitespace-nowrap">
                                                {study.bharatPacsId}
                                            </td>
                                            <td className="py-2.5 px-4 align-middle">
                                                <div className="font-bold text-slate-900 truncate max-w-[180px]">{study.patientInfo?.patientName || 'Unknown'}</div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">{study.patientInfo?.age || '--'} / {study.patientInfo?.gender || '--'}</div>
                                            </td>
                                            <td className="py-2.5 px-4 align-middle">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                                    {study.modality || study.billing?.modality || '--'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 align-middle text-sm text-slate-700 font-medium">
                                                <div className="truncate max-w-[200px]" title={study.billing?.moduleName}>
                                                    {study.billing?.moduleName || '--'}
                                                </div>
                                                {study.billing?.moduleCode && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{study.billing?.moduleCode}</div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-4 align-middle text-sm text-slate-600 font-medium">
                                                {study.billing?.billedAt ? format(new Date(study.billing.billedAt), 'MMM dd, yyyy') : '--'}
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {study.billing?.billedAt ? format(new Date(study.billing.billedAt), 'HH:mm a') : ''}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 align-middle text-right">
                                                <div className="font-bold text-slate-900 font-mono tracking-tight">
                                                    ₹{(study.billing?.amount || 0).toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 align-middle text-center relative max-w-[120px]">
                                                <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider w-full truncate ${getStatusColor(study.billing?.paymentStatus)}`}>
                                                    {study.billing?.paymentStatus || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 align-middle text-right">
                                                <button className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors inline-block" title="View details">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between shadow-[0_-1px_0_#e2e8f0]">
                        <div className="text-xs text-gray-500 font-medium">
                            Showing <span className="font-bold text-gray-900">{(pagination.currentPage - 1) * pagination.recordsPerPage + (studies.length > 0 ? 1 : 0)}</span> to <span className="font-bold text-gray-900">{Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)}</span> of <span className="font-bold text-gray-900">{pagination.totalRecords}</span> entries
                        </div>
                        <div className="flex gap-1.5 border border-gray-200 rounded-lg p-0.5 bg-white">
                            <button
                                onClick={() => handlePageChange(pagination.currentPage - 1)}
                                disabled={pagination.currentPage === 1}
                                className="px-2 py-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-3 py-1 bg-sky-50 text-sky-700 font-bold text-sm rounded border border-sky-100">
                                {pagination.currentPage}
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.currentPage + 1)}
                                disabled={pagination.currentPage >= pagination.totalPages}
                                className="px-2 py-1 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabBilling;
