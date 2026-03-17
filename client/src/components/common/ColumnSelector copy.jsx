import React from 'react';
import { getAllColumns } from '../../constants/worklistColumns';
import { CheckSquare, Square } from 'lucide-react';

/**
 * Flat ColumnSelector - shows a simple checklist of all columns.
 */
const ColumnSelector = ({
  selectedColumns = [],
  onColumnToggle = () => {},
  onSelectAll = () => {},
  onClearAll = () => {}
}) => {
  const allColumns = getAllColumns();
  const allIds = allColumns.map(c => c.id);

  const isSelected = (id) => selectedColumns.includes(id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200">
        <div>
          <h3 className="font-semibold text-slate-800">Worklist Columns</h3>
          <p className="text-xs text-slate-600">Select columns to show in this user's worklist</p>
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

      <div className="max-h-96 overflow-y-auto border border-slate-200 rounded p-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {allColumns.map(col => (
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

      <div className="flex items-center justify-between p-3 bg-teal-50 rounded border border-teal-200">
        <div className="text-sm text-teal-900">
          <strong>{selectedColumns.length}</strong> of <strong>{allColumns.length}</strong> columns selected
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