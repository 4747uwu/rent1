import Organization from '../models/organisation.js';

/**
 * Upload organisation navbar logo
 * POST /admin/org-logo/upload
 */
export const uploadOrgLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }

        const orgIdentifier = req.user.organizationIdentifier;
        if (!orgIdentifier) {
            return res.status(400).json({ success: false, message: 'No organization context found' });
        }

        const org = await Organization.findOne({ identifier: orgIdentifier });
        if (!org) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        org.navbarLogo = {
            data: req.file.buffer,
            contentType: req.file.mimetype,
            filename: req.file.originalname,
            uploadedAt: new Date()
        };

        await org.save();

        console.log(`✅ [OrgLogo] Logo uploaded for org: ${orgIdentifier} (${req.file.originalname}, ${(req.file.size / 1024).toFixed(1)}KB)`);

        res.json({
            success: true,
            message: 'Logo uploaded successfully',
            data: {
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                size: req.file.size,
                uploadedAt: org.navbarLogo.uploadedAt
            }
        });
    } catch (error) {
        console.error('❌ [OrgLogo] Upload error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload logo' });
    }
};

/**
 * Get organisation navbar logo (returns raw image)
 * GET /admin/org-logo
 */
export const getOrgLogo = async (req, res) => {
    try {
        const orgIdentifier = req.user.organizationIdentifier;
        if (!orgIdentifier) {
            return res.status(404).json({ success: false, message: 'No organization context' });
        }

        const org = await Organization.findOne(
            { identifier: orgIdentifier },
            { 'navbarLogo': 1 }
        );

        if (!org || !org.navbarLogo || !org.navbarLogo.data) {
            return res.status(404).json({ success: false, message: 'No logo found' });
        }

        res.set('Content-Type', org.navbarLogo.contentType);
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(org.navbarLogo.data);
    } catch (error) {
        console.error('❌ [OrgLogo] Fetch error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch logo' });
    }
};

/**
 * Delete organisation navbar logo
 * DELETE /admin/org-logo
 */
export const deleteOrgLogo = async (req, res) => {
    try {
        const orgIdentifier = req.user.organizationIdentifier;
        if (!orgIdentifier) {
            return res.status(400).json({ success: false, message: 'No organization context' });
        }

        const result = await Organization.updateOne(
            { identifier: orgIdentifier },
            { $unset: { navbarLogo: 1 } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Organization not found or no logo to delete' });
        }

        console.log(`✅ [OrgLogo] Logo deleted for org: ${orgIdentifier}`);
        res.json({ success: true, message: 'Logo deleted successfully' });
    } catch (error) {
        console.error('❌ [OrgLogo] Delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete logo' });
    }
};

/**
 * Get org query call number
 * GET /admin/org-settings/query-number
 */
export const getQueryCallNumber = async (req, res) => {
    try {
        const orgIdentifier = req.user.organizationIdentifier;
        if (!orgIdentifier) {
            return res.status(404).json({ success: false, message: 'No organization context' });
        }

        const org = await Organization.findOne(
            { identifier: orgIdentifier },
            { queryCallNumber: 1 }
        );

        res.json({
            success: true,
            queryCallNumber: org?.queryCallNumber || ''
        });
    } catch (error) {
        console.error('❌ [OrgSettings] Get query number error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch query number' });
    }
};

/**
 * Update org query call number
 * PUT /admin/org-settings/query-number
 */
export const updateQueryCallNumber = async (req, res) => {
    try {
        const orgIdentifier = req.user.organizationIdentifier;
        const { queryCallNumber } = req.body;

        if (!orgIdentifier) {
            return res.status(400).json({ success: false, message: 'No organization context' });
        }

        const result = await Organization.updateOne(
            { identifier: orgIdentifier },
            { $set: { queryCallNumber: queryCallNumber || '' } }
        );

        if (result.modifiedCount === 0 && result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }

        console.log(`✅ [OrgSettings] Query call number updated for ${orgIdentifier}: ${queryCallNumber}`);
        res.json({ success: true, message: 'Query call number updated', queryCallNumber });
    } catch (error) {
        console.error('❌ [OrgSettings] Update query number error:', error);
        res.status(500).json({ success: false, message: 'Failed to update query number' });
    }
};
