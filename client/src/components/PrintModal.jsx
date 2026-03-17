import { useState, useEffect, useRef } from 'react';
import { X, Printer, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const PrintModal = ({ report, reports: multiReports, onClose }) => {
    // ✅ Support both single report and multiple reports
    const allReports = multiReports?.length ? multiReports : (report ? [report] : []);
    const [activeIndex, setActiveIndex] = useState(0);
    const [pdfUrls, setPdfUrls] = useState({}); // { reportId: blobUrl }
    const [loadingStates, setLoadingStates] = useState({}); // { reportId: true/false }
    const [errorStates, setErrorStates] = useState({}); // { reportId: 'error msg' }
    const fetchedRef = useRef({});

    const activeReport = allReports[activeIndex];

    // ✅ Fetch PDF for a specific report
    const fetchPDF = async (rep) => {
        if (!rep?._id || fetchedRef.current[rep._id]) return;
        fetchedRef.current[rep._id] = true;

        setLoadingStates(prev => ({ ...prev, [rep._id]: true }));
        setErrorStates(prev => ({ ...prev, [rep._id]: null }));

        try {
            console.log(`🖨️ [PrintModal] Fetching PDF for report: ${rep._id}`);

            const response = await api.get(`/reports/reports/${rep._id}/print`, {
                responseType: 'blob',
                timeout: 60000,
            });

            if (response.data.type === 'application/json') {
                const text = await response.data.text();
                const json = JSON.parse(text);
                throw new Error(json.message || 'Server error');
            }

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrls(prev => ({ ...prev, [rep._id]: url }));

        } catch (err) {
            console.error(`❌ [PrintModal] Error fetching PDF for ${rep._id}:`, err);
            fetchedRef.current[rep._id] = false; // Allow retry

            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const json = JSON.parse(text);
                    setErrorStates(prev => ({ ...prev, [rep._id]: json.message || 'Failed to generate print PDF' }));
                } catch {
                    setErrorStates(prev => ({ ...prev, [rep._id]: 'Failed to generate print PDF.' }));
                }
            } else {
                setErrorStates(prev => ({ ...prev, [rep._id]: err.message || 'Failed to generate print PDF.' }));
            }
        } finally {
            setLoadingStates(prev => ({ ...prev, [rep._id]: false }));
        }
    };

    // ✅ Fetch the first report immediately on open
    useEffect(() => {
        if (allReports.length > 0) {
            fetchPDF(allReports[0]);
        }
        return () => {
            // Cleanup all blob URLs on unmount
            Object.values(pdfUrls).forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    // ✅ Fetch PDF when switching tabs if not already fetched
    useEffect(() => {
        if (activeReport) {
            fetchPDF(activeReport);
        }
    }, [activeIndex]);

    const handlePrint = async (rep, url) => {
        if (!url) return;
        try {
            await api.post(`/reports/${rep._id}/track-print`);
        } catch (err) {
            console.warn('⚠️ Failed to track print');
        }
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
            printWindow.onload = () => printWindow.print();
        } else {
            toast.error('Please allow pop-ups to print');
        }
    };

    const handleDirectPrint = async (rep, url) => {
        if (!url) return;
        try {
            await api.post(`/reports/${rep._id}/track-print`);
        } catch (err) {
            console.warn('⚠️ Failed to track print');
        }
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        };
    };

    const handlePrintAll = async () => {
        for (let i = 0; i < allReports.length; i++) {
            const rep = allReports[i];
            const url = pdfUrls[rep._id];
            if (url) {
                await handleDirectPrint(rep, url);
                if (i < allReports.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } else {
                toast.error(`Report ${i + 1} not loaded yet`);
            }
        }
    };

    if (!allReports.length) return null;

    const activeUrl = activeReport ? pdfUrls[activeReport._id] : null;
    const activeLoading = activeReport ? loadingStates[activeReport._id] : false;
    const activeError = activeReport ? errorStates[activeReport._id] : null;
    const totalReports = allReports.length;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] p-2 sm:p-4 backdrop-blur-md bg-white/10">
            <div className="bg-white rounded-md w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                {/* ✅ HEADER */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
                    <div>
                        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                            <Printer className="w-4 h-4 text-blue-600" />
                            Print Report{totalReports > 1 ? `s (${totalReports})` : ''}
                        </h2>
                        <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[250px] sm:max-w-full">
                            {activeReport?.reportId || activeReport?._id} | {activeReport?.patientInfo?.fullName || activeReport?.patientName}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {totalReports > 1 && (
                            <button
                                onClick={handlePrintAll}
                                className="px-2.5 py-1.5 text-[10px] bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1 font-medium"
                                title="Print all reports"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                Print All ({totalReports})
                            </button>
                        )}
                        <button 
                            onClick={onClose} 
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Close"
                        >
                            <X className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* ✅ TABS — only show if multiple reports */}
                {totalReports > 1 && (
                    <div className="flex items-center border-b bg-gray-50 flex-shrink-0 px-2 pt-1 gap-1 overflow-x-auto">
                        {allReports.map((rep, i) => (
                            <button
                                key={rep._id}
                                onClick={() => setActiveIndex(i)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-t border-b-2 whitespace-nowrap transition-all ${
                                    activeIndex === i
                                        ? 'border-blue-600 text-blue-700 bg-white'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {/* Loading indicator per tab */}
                                {loadingStates[rep._id] ? (
                                    <Loader className="w-3 h-3 animate-spin text-blue-500" />
                                ) : errorStates[rep._id] ? (
                                    <X className="w-3 h-3 text-red-500" />
                                ) : pdfUrls[rep._id] ? (
                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                ) : (
                                    <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                                )}
                                Report {i + 1}
                                {rep.doctorId?.fullName && (
                                    <span className="text-[9px] text-gray-400 hidden sm:inline">
                                        · {rep.doctorId.fullName}
                                    </span>
                                )}
                            </button>
                        ))}

                        {/* Tab navigation arrows for overflow */}
                        <div className="ml-auto flex items-center gap-1 flex-shrink-0 pb-1">
                            <button
                                onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                                disabled={activeIndex === 0}
                                className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-gray-500">{activeIndex + 1}/{totalReports}</span>
                            <button
                                onClick={() => setActiveIndex(i => Math.min(totalReports - 1, i + 1))}
                                disabled={activeIndex === totalReports - 1}
                                className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ✅ PDF CONTENT AREA */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeLoading && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                                <p className="text-xs text-gray-600 font-medium">Loading PDF...</p>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    {totalReports > 1 ? `Report ${activeIndex + 1} of ${totalReports}` : 'Preparing report for printing'}
                                </p>
                            </div>
                        </div>
                    )}

                    {activeError && !activeLoading && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-xs px-4">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                    <X className="w-5 h-5 text-red-600" />
                                </div>
                                <p className="text-xs text-red-600 font-medium mb-1">Error Loading PDF</p>
                                <p className="text-[10px] text-gray-600">{activeError}</p>
                                <button
                                    onClick={() => {
                                        fetchedRef.current[activeReport._id] = false;
                                        fetchPDF(activeReport);
                                    }}
                                    className="mt-2 px-3 py-1 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )}

                    {activeUrl && !activeLoading && !activeError && (
                        <>
                            <div className="flex-1 overflow-hidden bg-gray-100">
                                <iframe
                                    key={activeReport._id}
                                    src={activeUrl}
                                    className="w-full h-full border-0"
                                    title={`Report ${activeIndex + 1} Preview`}
                                />
                            </div>

                            {/* ✅ FOOTER */}
                            <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
                                <div className="text-[10px] text-gray-600 hidden sm:block">
                                    <p className="font-medium">
                                        {totalReports > 1 ? `Viewing Report ${activeIndex + 1} of ${totalReports}` : 'Ready to print'}
                                    </p>
                                    <p className="text-[9px] mt-0.5">Print count tracks automatically</p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button
                                        onClick={() => handleDirectPrint(activeReport, activeUrl)}
                                        className="px-2.5 py-1.5 text-[10px] bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 flex items-center gap-1.5 flex-1 sm:flex-none justify-center"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        Print (Direct)
                                    </button>
                                    <button
                                        onClick={() => handlePrint(activeReport, activeUrl)}
                                        className="px-3 py-1.5 text-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded hover:from-blue-700 hover:to-indigo-700 flex items-center gap-1.5 font-medium flex-1 sm:flex-none justify-center"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        Print Dialog
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrintModal;