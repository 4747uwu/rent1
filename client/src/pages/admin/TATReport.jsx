import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import Navbar from '../../components/common/Navbar';
import api from '../../services/api';

const getTatBadgeClass = (value) => {
    if (!value || value === '-') return 'bg-gray-100 text-gray-600';

    const minutes = Number.parseInt(String(value).replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(minutes)) return 'bg-gray-100 text-gray-600';

    if (minutes <= 60) return 'bg-green-100 text-green-700';
    if (minutes <= 240) return 'bg-blue-100 text-blue-700';
    if (minutes <= 480) return 'bg-yellow-100 text-yellow-700';
    if (minutes <= 1440) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
};

const initialFilters = {
    dateType: 'uploadDate',
    fromDate: '',
    toDate: '',
    location: '',
    selectedDoctor: '',
    status: ''
};

const TATReport = () => {
    const [filters, setFilters] = useState(initialFilters);
    const [locations, setLocations] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [studies, setStudies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [recordsPerPage, setRecordsPerPage] = useState(100);

    const fetchOptions = useCallback(async () => {
        try {
            const [locRes, docRes] = await Promise.all([
                api.get('/tat/locations'),
                api.get('/tat/doctors')
            ]);

            if (locRes.data?.success) setLocations(locRes.data.locations || []);
            if (docRes.data?.success) setDoctors(docRes.data.doctors || []);
        } catch (error) {
            toast.error('Failed to load TAT filters');
        }
    }, []);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    const fetchReport = useCallback(async () => {
        if (!filters.fromDate || !filters.toDate) {
            toast.error('Select from and to dates');
            return;
        }

        setLoading(true);
        try {
            const params = {
                dateType: filters.dateType,
                fromDate: filters.fromDate,
                toDate: filters.toDate
            };

            if (filters.location) params.location = filters.location;
            if (filters.selectedDoctor) params.selectedDoctor = filters.selectedDoctor;
            if (filters.status) params.status = filters.status;

            const res = await api.get('/tat/report', { params });
            if (res.data?.success) {
                setStudies(res.data.studies || []);
                setCurrentPage(1);
            } else {
                setStudies([]);
                toast.error('No TAT data found');
            }
        } catch (error) {
            setStudies([]);
            toast.error('Failed to load TAT report');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const exportReport = useCallback(async () => {
        if (!filters.fromDate || !filters.toDate) {
            toast.error('Select from and to dates before export');
            return;
        }

        setLoading(true);
        try {
            const params = {
                dateType: filters.dateType,
                fromDate: filters.fromDate,
                toDate: filters.toDate
            };

            if (filters.location) params.location = filters.location;
            if (filters.selectedDoctor) params.selectedDoctor = filters.selectedDoctor;
            if (filters.status) params.status = filters.status;

            const response = await api.get('/tat/report/export', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([
                response.data
            ], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `TAT_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            toast.success('TAT report exported');
        } catch (error) {
            toast.error('Export failed');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const filteredStudies = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return studies;

        return studies.filter((s) => {
            return (
                (s.patientName || '').toLowerCase().includes(term) ||
                (s.patientId || '').toLowerCase().includes(term) ||
                (s.accessionNumber || '').toLowerCase().includes(term) ||
                (s.studyDescription || '').toLowerCase().includes(term) ||
                (s.institutionName || '').toLowerCase().includes(term)
            );
        });
    }, [search, studies]);

    const totalPages = Math.max(1, Math.ceil(filteredStudies.length / recordsPerPage));
    const pageStart = (currentPage - 1) * recordsPerPage;
    const pageRows = filteredStudies.slice(pageStart, pageStart + recordsPerPage);

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar title="TAT Report" subtitle="Status history based" />

            <div className="p-3 space-y-3">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-1 md:grid-cols-8 gap-2">
                        <select
                            className="border border-gray-300 rounded px-2 py-2 text-sm"
                            value={filters.dateType}
                            onChange={(e) => setFilters((p) => ({ ...p, dateType: e.target.value }))}
                        >
                            <option value="uploadDate">Upload Date</option>
                            <option value="studyDate">Study Date</option>
                            <option value="assignedDate">Assigned Date</option>
                            <option value="reportDate">Report Date</option>
                        </select>

                        <input
                            type="date"
                            className="border border-gray-300 rounded px-2 py-2 text-sm"
                            value={filters.fromDate}
                            onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
                        />

                        <input
                            type="date"
                            className="border border-gray-300 rounded px-2 py-2 text-sm"
                            value={filters.toDate}
                            onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
                        />

                        <select
                            className="border border-gray-300 rounded px-2 py-2 text-sm"
                            value={filters.location}
                            onChange={(e) => setFilters((p) => ({ ...p, location: e.target.value }))}
                        >
                            <option value="">All Locations</option>
                            {locations.map((loc) => (
                                <option key={loc.value} value={loc.value}>{loc.label}</option>
                            ))}
                        </select>

                        <select
                            className="border border-gray-300 rounded px-2 py-2 text-sm"
                            value={filters.selectedDoctor}
                            onChange={(e) => setFilters((p) => ({ ...p, selectedDoctor: e.target.value }))}
                        >
                            <option value="">All Uploaders</option>
                            {doctors.map((doc) => (
                                <option key={doc.value} value={doc.value}>{doc.label}</option>
                            ))}
                        </select>

                        <input
                            type="text"
                            className="border border-gray-300 rounded px-2 py-2 text-sm"
                            placeholder="Search in result..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 text-sm disabled:opacity-60"
                            onClick={fetchReport}
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Generate'}
                        </button>

                        <button
                            className="bg-green-600 hover:bg-green-700 text-white rounded px-3 py-2 text-sm disabled:opacity-60"
                            onClick={exportReport}
                            disabled={loading || studies.length === 0}
                        >
                            Export
                        </button>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-auto">
                        <table className="min-w-full text-xs">
                            <thead className="bg-gray-900 text-white">
                                <tr>
                                    <th className="px-2 py-2 text-left">Status</th>
                                    <th className="px-2 py-2 text-left">Patient</th>
                                    <th className="px-2 py-2 text-left">Accession</th>
                                    <th className="px-2 py-2 text-left">Location</th>
                                    <th className="px-2 py-2 text-left">Upload</th>
                                    <th className="px-2 py-2 text-left">Assigned</th>
                                    <th className="px-2 py-2 text-left">Report Completed</th>
                                    <th className="px-2 py-2 text-center">Upload to Assigned</th>
                                    <th className="px-2 py-2 text-center">Upload to Report</th>
                                    <th className="px-2 py-2 text-center">Assigned to Report</th>
                                    <th className="px-2 py-2 text-center">Upload to Download</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.length === 0 ? (
                                    <tr>
                                        <td className="px-2 py-8 text-center text-gray-500" colSpan={11}>No records</td>
                                    </tr>
                                ) : (
                                    pageRows.map((study) => (
                                        <tr key={study._id} className="border-t border-gray-200 hover:bg-gray-50">
                                            <td className="px-2 py-2">{study.studyStatus || '-'}</td>
                                            <td className="px-2 py-2">{study.patientName || '-'}</td>
                                            <td className="px-2 py-2">{study.accessionNumber || '-'}</td>
                                            <td className="px-2 py-2">{study.institutionName || '-'}</td>
                                            <td className="px-2 py-2">{study.uploadDate || '-'}</td>
                                            <td className="px-2 py-2">{study.assignedDate || '-'}</td>
                                            <td className="px-2 py-2">{study.reportDate || '-'}</td>
                                            <td className="px-2 py-2 text-center">
                                                <span className={`inline-block px-2 py-1 rounded ${getTatBadgeClass(study.statusTatMetrics?.uploadToAssignedLatestFormatted)}`}>
                                                    {study.statusTatMetrics?.uploadToAssignedLatestFormatted || '-'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <span className={`inline-block px-2 py-1 rounded ${getTatBadgeClass(study.statusTatMetrics?.uploadToReportCompletedFormatted)}`}>
                                                    {study.statusTatMetrics?.uploadToReportCompletedFormatted || '-'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <span className={`inline-block px-2 py-1 rounded ${getTatBadgeClass(study.statusTatMetrics?.assignedToReportCompletedFormatted)}`}>
                                                    {study.statusTatMetrics?.assignedToReportCompletedFormatted || '-'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <span className={`inline-block px-2 py-1 rounded ${getTatBadgeClass(study.statusTatMetrics?.uploadToFinalDownloadFormatted)}`}>
                                                    {study.statusTatMetrics?.uploadToFinalDownloadFormatted || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 text-xs bg-gray-50">
                        <div>Showing {pageRows.length} of {filteredStudies.length}</div>
                        <div className="flex items-center gap-2">
                            <select
                                className="border border-gray-300 rounded px-2 py-1"
                                value={recordsPerPage}
                                onChange={(e) => {
                                    setRecordsPerPage(Number.parseInt(e.target.value, 10));
                                    setCurrentPage(1);
                                }}
                            >
                                {[25, 50, 100, 250].map((n) => (
                                    <option key={n} value={n}>{n}/page</option>
                                ))}
                            </select>
                            <button
                                className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >Prev</button>
                            <span>Page {currentPage} / {totalPages}</span>
                            <button
                                className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TATReport;
