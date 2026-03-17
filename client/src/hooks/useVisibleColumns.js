import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * ✅ Always fetches visibleColumns fresh from DB on mount.
 * Never reads from sessionStorage/localStorage.
 * Falls back to sessionUser.visibleColumns only if API fails.
 */
const useVisibleColumns = (currentUser) => {
    const [visibleColumns, setVisibleColumns] = useState([]);
    const [columnsLoading, setColumnsLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) {
            setColumnsLoading(false);
            return;
        }

        const fetchColumns = async () => {
            try {
                setColumnsLoading(true);
                const response = await api.get('/auth/my-columns');
                
                if (response.data.success) {
                    setVisibleColumns(response.data.visibleColumns || []);
                    console.log('✅ [useVisibleColumns] Fresh from DB:', response.data.visibleColumns?.length, 'columns');
                }
            } catch (error) {
                // ✅ Fallback to session user data if API fails (offline, etc.)
                console.warn('⚠️ [useVisibleColumns] API failed, using session fallback:', error.message);
                setVisibleColumns(currentUser?.visibleColumns || []);
            } finally {
                setColumnsLoading(false);
            }
        };

        fetchColumns();
    }, [currentUser?._id]); // ✅ Only re-fetch if USER changes (login/switch), not on every render

    return { visibleColumns, columnsLoading };
};

export default useVisibleColumns;