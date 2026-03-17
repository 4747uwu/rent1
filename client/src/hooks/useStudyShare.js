import { useState } from 'react';
import api from '../services/api.jsx';
import { toast } from 'react-toastify';

export const useStudyShare = () => {
    const [loading, setLoading] = useState(false);
    const [shareUrl, setShareUrl] = useState(null);

    const createShare = async (studyId, options = {}) => {
        const { expiryPreset = '24h', accessType = 'view_only', password = null, maxUses = null } = options;
        setLoading(true);
        try {
            const { data } = await api.post(`/studies/${studyId}/share`, {
                expiryPreset, accessType, password, maxUses,
            });
            setShareUrl(data.data.shareUrl);
            await navigator.clipboard.writeText(data.data.shareUrl);
            toast.success('Share link copied to clipboard!');
            return data.data;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create share link');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const revokeShare = async (shareId) => {
        try {
            await api.delete(`/shares/${shareId}/revoke`);
            toast.success('Share link revoked');
        } catch (err) {
            toast.error('Failed to revoke share link');
        }
    };

    return { createShare, revokeShare, shareUrl, loading };
};