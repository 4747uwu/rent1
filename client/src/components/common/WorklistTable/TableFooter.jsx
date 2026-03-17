import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const TableFooter = ({ 
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  recordsPerPage = 50,
  onPageChange,
  onRecordsPerPageChange,
  displayedRecords = 0,
  loading = false
}) => {
  
  // Calculate page range to display (max 5 page numbers for compactness)
  const getPageRange = () => {
    const maxButtons = 5;
    const pages = [];
    
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageRange = getPageRange();

  const handlePageClick = (page) => {
    if (page !== '...' && page !== currentPage && !loading) {
      onPageChange?.(page);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1 && !loading) {
      onPageChange?.(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && !loading) {
      onPageChange?.(currentPage + 1);
    }
  };

  const handleFirst = () => {
    if (currentPage !== 1 && !loading) {
      onPageChange?.(1);
    }
  };

  const handleLast = () => {
    if (currentPage !== totalPages && !loading) {
      onPageChange?.(totalPages);
    }
  };

  const handleRecordsChange = (e) => {
    const newLimit = parseInt(e.target.value);
    if (!loading && newLimit !== recordsPerPage) {
      onRecordsPerPageChange?.(newLimit);
    }
  };

  const startRecord = totalRecords === 0 ? 0 : ((currentPage - 1) * recordsPerPage) + 1;
  const endRecord = Math.min(currentPage * recordsPerPage, totalRecords);

  return (
    <div className="sticky bottom-0 bg-white border-t border-slate-200 px-3 py-1.5">
      <div className="flex items-center justify-between gap-2">
        
        {/* LEFT: Compact records info */}
        <div className="flex items-center gap-2 text-[10px] text-slate-600">
          <span>
            <span className="font-semibold text-slate-800">{startRecord}-{endRecord}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="font-semibold text-teal-600">{totalRecords.toLocaleString()}</span>
          </span>
          
          <div className="h-3 w-px bg-slate-300" />
          
          {/* Compact records per page */}
          <select
            value={recordsPerPage}
            onChange={handleRecordsChange}
            disabled={loading}
            className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-50 border border-slate-200 rounded hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* CENTER: Compact page navigation */}
        <div className="flex items-center gap-0.5">
          {/* First */}
          <button
            onClick={handleFirst}
            disabled={currentPage === 1 || loading}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="First"
          >
            <ChevronsLeft className="w-3 h-3 text-slate-600" />
          </button>

          {/* Previous */}
          <button
            onClick={handlePrevious}
            disabled={currentPage === 1 || loading}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous"
          >
            <ChevronLeft className="w-3 h-3 text-slate-600" />
          </button>

          {/* Page numbers */}
          {pageRange.map((page, index) => (
            page === '...' ? (
              <span key={`ellipsis-${index}`} className="px-1 text-[10px] text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => handlePageClick(page)}
                disabled={loading}
                className={`min-w-[24px] h-[24px] px-1 text-[10px] font-medium rounded transition-all ${
                  page === currentPage
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {page}
              </button>
            )
          ))}

          {/* Next */}
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages || loading}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next"
          >
            <ChevronRight className="w-3 h-3 text-slate-600" />
          </button>

          {/* Last */}
          <button
            onClick={handleLast}
            disabled={currentPage === totalPages || loading}
            className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Last"
          >
            <ChevronsRight className="w-3 h-3 text-slate-600" />
          </button>

          <div className="ml-4 flex items-center gap-0.5" >
            <span className="sr-only">FOR ANY QUERY</span>
            <span className="text-[10px] text-slate-400">?</span>
            <span className="text-[10px] text-slate-400">Call</span>
            <span className="text-[10px] text-slate-400">XXXXXXXX</span>


          </div>
        </div>

        {/* RIGHT: Compact page info */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <span>
            Page <span className="font-semibold text-slate-800">{currentPage}</span>
            <span className="text-slate-500 mx-0.5">/</span>
            <span className="font-semibold text-slate-800">{totalPages}</span>
          </span>
          
          {loading && (
            <div className="w-2.5 h-2.5 border border-teal-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
};

export default TableFooter;