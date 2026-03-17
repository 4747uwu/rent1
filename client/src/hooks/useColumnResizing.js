import { useState, useCallback, useEffect } from 'react';
import { UNIFIED_WORKLIST_COLUMNS } from '../constants/unifiedWorklistColumns';

/**
 * Custom hook for managing resizable table columns
 * @param {string} storageKey - localStorage key for persisting column widths
 * @param {array} visibleColumns - Array of visible column IDs
 * @returns {object} - Column widths and resize handlers
 */
export const useColumnResizing = (storageKey, visibleColumns = []) => {
  // Initialize column widths from localStorage or defaults
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Error loading column widths:', error);
    }

    // Initialize with default widths
    const defaultWidths = {};
    Object.values(UNIFIED_WORKLIST_COLUMNS).forEach(col => {
      defaultWidths[col.id] = col.defaultWidth || 120;
    });
    return defaultWidths;
  });

  // Save to localStorage whenever widths change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths));
    } catch (error) {
      console.warn('Error saving column widths:', error);
    }
  }, [columnWidths, storageKey]);

  // Handle column resize
  const handleColumnResize = useCallback((columnId, newWidth) => {
    const column = Object.values(UNIFIED_WORKLIST_COLUMNS).find(col => col.id === columnId);
    if (!column) return;

    // Clamp width between min and max
    const minWidth = column.minWidth || 50;
    const maxWidth = column.maxWidth || 800;
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    setColumnWidths(prev => ({
      ...prev,
      [columnId]: clampedWidth
    }));
  }, []);

  // Reset column widths to defaults
  const resetColumnWidths = useCallback(() => {
    const defaultWidths = {};
    Object.values(UNIFIED_WORKLIST_COLUMNS).forEach(col => {
      defaultWidths[col.id] = col.defaultWidth || 120;
    });
    setColumnWidths(defaultWidths);
  }, []);

  // Get width for specific column
  const getColumnWidth = useCallback((columnId) => {
    return columnWidths[columnId] || UNIFIED_WORKLIST_COLUMNS[columnId]?.defaultWidth || 120;
  }, [columnWidths]);

  return {
    columnWidths,
    getColumnWidth,
    handleColumnResize,
    resetColumnWidths
  };
};

export default useColumnResizing;
