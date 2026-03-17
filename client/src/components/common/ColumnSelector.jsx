import React, { useEffect, useMemo, useCallback } from 'react';
import { CheckSquare, Square, Sparkles, Info } from 'lucide-react';
import { getDefaultColumnsForUser, getAllColumns, MULTI_ROLE_DEFAULTS } from '../../constants/unifiedWorklistColumns';

/**
 * Flat ColumnSelector - shows a simple checklist of all columns.
 */
const ColumnSelector = ({
  selectedColumns = [],
  onColumnToggle = () => {},
  onSelectAll = () => {},
  onClearAll = () => {},
  userRoles = [], // ✅ NEW: Pass user's account roles to filter relevant columns
  formData = {}, // ✅ FIXED: Add default empty object
  setFormData = () => {}, // ✅ FIXED: Add default no-op function
  useMultiRole = false
}) => {
  const allColumns = getAllColumns();
  
  // ✅ Filter columns relevant to user's roles
  const relevantColumns = userRoles.length > 0
    ? allColumns.filter(col => 
        col.tables.some(table => userRoles.includes(table)) || col.alwaysVisible
      )
    : allColumns;

  const allIds = relevantColumns.map(c => c.id);
  const isSelected = (id) => selectedColumns.includes(id);

  // ✅ Check if current selection matches a predefined combination
  const matchedCombination = useMemo(() => {
    if (!useMultiRole || !formData.accountRoles || formData.accountRoles.length <= 1) {
      return null;
    }

    const roleKey = formData.accountRoles.sort().join('+');
    return MULTI_ROLE_DEFAULTS[roleKey] ? roleKey : null;
  }, [useMultiRole, formData.accountRoles]);

  // ✅ FIXED: Add null checks for formData
  useEffect(() => {
    if (formData?.role || (formData?.accountRoles && formData.accountRoles.length > 0)) {
      const defaultCols = getDefaultColumnsForUser(
        useMultiRole && formData.accountRoles?.length > 0
          ? formData.accountRoles 
          : [formData.role]
      );
      setFormData(prev => ({ ...prev, visibleColumns: defaultCols }));
    }
  }, [formData?.role, formData?.accountRoles, useMultiRole, setFormData]);

  // ✅ Load predefined combination
  const loadPreset = (combinationKey) => {
    const presetColumns = MULTI_ROLE_DEFAULTS[combinationKey];
    if (presetColumns) {
      setFormData(prev => ({ ...prev, visibleColumns: presetColumns }));
    }
  };



  return (
    <div className="space-y-4">
      {/* Preset Combinations Banner */}
      {matchedCombination && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-green-900 mb-1">Optimized Preset Loaded!</h4>
              <p className="text-xs text-green-700">
                We've preselected the most relevant columns for <strong>{matchedCombination.replace(/\+/g, ' + ')}</strong> combination.
                You can customize this selection below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadPreset(matchedCombination)}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
            >
              Reset to Preset
            </button>
          </div>
        </div>
      )}

      {/* Column Selection Header */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
        <div>
          <h3 className="font-semibold text-slate-800">Worklist Columns</h3>
          <p className="text-xs text-slate-600">
            {useMultiRole && formData.accountRoles?.length > 0 
              ? `Showing columns for: ${formData.accountRoles.join(', ')}`
              : 'Select columns to show in this user\'s worklist'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSelectAll(allIds)}
            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded transition-colors"
          >
            <CheckSquare className="inline w-4 h-4 mr-1" /> Select All
          </button>
          <button
            type="button"
            onClick={() => onClearAll()}
            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm rounded transition-colors"
          >
            <Square className="inline w-4 h-4 mr-1" /> Clear
          </button>
        </div>
      </div>

      {/* Column Grid */}
      <div className="max-h-96 overflow-y-auto border border-slate-200 rounded p-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {relevantColumns.map(col => (
            <label 
              key={col.id} 
              className={`flex items-start gap-2 p-2 border rounded cursor-pointer transition-colors ${
                isSelected(col.id) 
                  ? 'bg-teal-50 border-teal-300 hover:bg-teal-100' 
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected(col.id)}
                onChange={() => onColumnToggle(col.id)}
                className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                // disabled={col.alwaysVisible}
              />
              <div className="text-sm flex-1">
                <div className="font-medium text-slate-800">{col.label}</div>
                {col.description && (
                  <div className="text-xs text-slate-500 mt-0.5">{col.description}</div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Selection Summary */}
      <div className="flex items-center justify-between p-3 bg-teal-50 rounded border border-teal-200">
        <div className="text-sm text-teal-900">
          <strong>{selectedColumns.length}</strong> of <strong>{relevantColumns.length}</strong> columns selected
        </div>
        {selectedColumns.length === 0 && (
          <div className="text-xs text-orange-600 font-medium">
            ⚠️ No columns selected - user won't see any data!
          </div>
        )}
      </div>
    </div>
  );
};

export default ColumnSelector;