import { getDefaultColumnsForUser, getAllColumns } from '../constants/unifiedWorklistColumns';

/**
 * ✅ RESOLVE VISIBLE COLUMNS WITH PRIORITY
 * Priority: visibleColumns > accountRoles defaults > primaryRole default
 */
export const resolveUserVisibleColumns = (user) => {
  // 1. If user has explicitly set visibleColumns, use them (highest priority)
  if (user.visibleColumns && user.visibleColumns.length > 0) {
    console.log('📌 Using user-specific visibleColumns:', user.visibleColumns.length);
    return user.visibleColumns;
  }

  // 2. If user has accountRoles, merge their defaults
  if (user.accountRoles && user.accountRoles.length > 0) {
    const mergedColumns = getDefaultColumnsForUser(user.accountRoles);
    console.log('📌 Using merged accountRoles columns:', mergedColumns.length, 'from roles:', user.accountRoles);
    return mergedColumns;
  }

  // 3. Fallback to primaryRole or role
  const fallbackRole = user.primaryRole || user.role;
  const fallbackColumns = getDefaultColumnsForUser([fallbackRole]);
  console.log('📌 Using fallback role columns:', fallbackColumns.length, 'from role:', fallbackRole);
  return fallbackColumns;
};

/**
 * ✅ CHECK IF COLUMN IS VISIBLE FOR USER
 */
export const isColumnVisibleForUser = (columnId, user) => {
  const visibleColumns = resolveUserVisibleColumns(user);
  return visibleColumns.includes(columnId);
};

/**
 * ✅ GET FILTERED COLUMNS ARRAY
 */
export const getFilteredColumns = (user) => {
  const allColumns = getAllColumns();
  const visibleColumnIds = resolveUserVisibleColumns(user);
  
  return allColumns.filter(col => visibleColumnIds.includes(col.id));
};