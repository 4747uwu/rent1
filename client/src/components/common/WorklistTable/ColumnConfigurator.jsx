import React, { useState, useRef, useEffect, useMemo } from 'react';


// ...existing code...

const DB_TO_CONFIG_KEY_MAP = {
  'checkbox'           : 'checkbox',
  'bharatPacsId'       : 'bharatPacsId',
  'centerName'         : 'centerName',
  'location'           : 'location',
  'timeline'           : 'timeline',
  'patientName'        : 'patientName',
  'patientId'          : 'patientId',
  'ageGender'          : 'ageGender',
  'modality'           : 'modality',
  'viewOnly'           : 'viewOnly',
  'reporting'          : 'reporting',
  'studySeriesImages'  : 'studySeriesImages',   // ✅ FIX: was 'seriesCount'
  'accessionNumber'    : 'accessionNumber',
  'referralDoctor'     : 'referralDoctor',
  'clinicalHistory'    : 'clinicalHistory',
  'studyDateTime'      : 'studyDateTime',        // ✅ FIX: was 'studyTime'
  'uploadDateTime'     : 'uploadDateTime',       // ✅ FIX: was 'uploadTime'
  'assignedRadiologist': 'assignedRadiologist',  // ✅ FIX: was 'radiologist'
  'studyLock'          : 'studyLock',
  'status'             : 'status',               // ✅ FIX: was 'caseStatus'
  'assignedVerifier'   : 'assignedVerifier',
  'verifiedDateTime'   : 'verifiedDateTime',
  'actions'            : 'actions',
  'rejectionReason'    : 'rejectionReason',
  'printCount'         : 'printCount',           // ✅ ADD: was missing entirely
  'selection'          : 'selection',            // ✅ ADD: was missing entirely
  'organization'       : 'organization',         // ✅ ADD: was missing entirely
};

// ...existing code...

const ColumnConfigurator = ({ columnConfig, onColumnChange, onResetToDefault, theme = 'default', visibleColumns = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleColumnToggle = (columnKey) => {
    onColumnChange(columnKey, !columnConfig[columnKey].visible);
  };

  // ✅ Convert DB visibleColumns keys → columnConfig keys
  const allowedConfigKeys = useMemo(() => {
    if (!visibleColumns || visibleColumns.length === 0) return null; // null = no restriction

    const mapped = visibleColumns
      .map(dbKey => DB_TO_CONFIG_KEY_MAP[dbKey] || dbKey) // map or use as-is
      .filter(Boolean);

    console.log('🎛️ [ColumnConfigurator] DB columns mapped to config keys:', mapped);
    return new Set(mapped);
  }, [visibleColumns]);

  // ✅ Filter columnConfig to only DB-allowed columns (using mapped keys)
  const filteredColumnConfig = useMemo(() => {
    if (!allowedConfigKeys) return columnConfig; // No DB restriction = show all
    
    return Object.fromEntries(
      Object.entries(columnConfig).filter(([key]) => allowedConfigKeys.has(key))
    );
  }, [columnConfig, allowedConfigKeys]);

  const visibleCount = Object.values(filteredColumnConfig).filter(c => c.visible).length;
  const totalCount = Object.keys(filteredColumnConfig).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* COMPACT COLUMN BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        title="Configure Columns"
      >
        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110 4m0-4v2m0-6V4" />
        </svg>
        <span className="hidden sm:inline">Columns ({visibleCount})</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50 max-h-80 overflow-hidden">
          <div className="px-2.5 py-1.5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-wide">Columns</h3>
              <button onClick={onResetToDefault} className="text-[11px] text-gray-600 hover:text-gray-900 font-medium transition-colors">
                Reset
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">{visibleCount} of {totalCount} visible</p>
          </div>

          <div className="max-h-56 overflow-y-auto">
            <div className="p-1.5 space-y-0">
              {Object.entries(filteredColumnConfig)
                .sort((a, b) => a[1].order - b[1].order)
                .map(([key, config]) => {
                  return (
                    <div key={key} className="flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`column-${key}`}
                          checked={config.visible}
                          onChange={() => handleColumnToggle(key)}
                          className="w-3 h-3 accent-gray-900 rounded border-gray-300"
                        />
                        <label htmlFor={`column-${key}`} className="text-[11px] cursor-pointer text-gray-700">
                          {config.label}
                        </label>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="px-2.5 py-1.5 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>Essential columns cannot be hidden</span>
              <button onClick={() => setIsOpen(false)} className="text-gray-700 hover:text-gray-900 font-medium transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnConfigurator;