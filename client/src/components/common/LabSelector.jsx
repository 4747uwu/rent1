import React, { useState } from 'react';
import { Building2, CheckSquare, Square, Search, MapPin, Users } from 'lucide-react';

/**
 * LabSelector Component — Compact version
 * Allows admins/assignors to select which labs/centers they should have access to
 */
const LabSelector = ({
  selectedLabs = [],
  onLabToggle,
  onSelectAll,
  onClearAll,
  availableLabs = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleLabToggle = (labId) => {
    onLabToggle(labId);
  };

  const isLabSelected = (labId) => {
    return selectedLabs.includes(labId);
  };

  const filteredLabs = availableLabs.filter(lab => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      lab.name?.toLowerCase().includes(searchLower) ||
      lab.identifier?.toLowerCase().includes(searchLower) ||
      lab.address?.city?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-2">
      {/* Header row — compact */}
      <div className="flex items-center justify-between px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-xs font-semibold text-gray-700">Lab Access</span>
          <span className="text-[10px] text-gray-400 font-medium">
            {selectedLabs.length}/{availableLabs.length}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onSelectAll(availableLabs.map(lab => lab._id))}
            className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-medium rounded-md transition-colors"
          >
            All
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-600 text-[10px] font-medium rounded-md transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search labs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      {/* Labs list — compact rows */}
      {filteredLabs.length === 0 ? (
        <div className="p-4 text-center border border-dashed border-gray-200 rounded-lg">
          <Building2 className="w-6 h-6 text-gray-300 mx-auto mb-1" />
          <p className="text-xs text-gray-400">
            {searchTerm ? 'No labs match search' : 'No labs available'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
          {filteredLabs.map(lab => {
            const isSelected = isLabSelected(lab._id);

            return (
              <label
                key={lab._id}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleLabToggle(lab._id)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-gray-800 truncate">{lab.name}</p>
                    {!lab.isActive && (
                      <span className="px-1 py-0.5 bg-red-100 text-red-600 text-[9px] font-medium rounded flex-shrink-0">OFF</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-teal-600 font-mono">{lab.identifier}</span>
                    {lab.address?.city && (
                      <span className="text-[10px] text-gray-400 truncate">· {lab.address.city}</span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <CheckSquare className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LabSelector;
