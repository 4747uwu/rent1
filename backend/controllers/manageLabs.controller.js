import Lab from '../models/labModel.js';
import User from '../models/userModel.js';

// ✅ GET ALL LABS WITH FULL DETAILS
export const getAllLabsForManagement = async (req, res) => {
    try {
        const { role, organizationIdentifier } = req.user;

        if (!['admin', 'super_admin', 'group_id'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const query = role === 'super_admin' 
            ? {} 
            : { organizationIdentifier };

        const labs = await Lab.find(query)
            .populate('organization', 'name displayName identifier')
            .populate('settings.verificationEnabledBy', 'fullName email')
            // ✅ select tempPassword so frontend can show it
            .populate('staffUsers.userId', 'fullName email role isActive username tempPassword')
            .sort({ createdAt: -1 })
            .lean();

        // ✅ Enrich with staff count per lab
        const enrichedLabs = labs.map(lab => ({
            ...lab,
            activeStaffCount: lab.staffUsers?.filter(s => s.isActive).length || 0,
            totalStaffCount: lab.staffUsers?.length || 0,
        }));

        res.json({ success: true, data: enrichedLabs, count: enrichedLabs.length });
    } catch (error) {
        console.error('❌ Get labs error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch labs' });
    }
};

// ✅ GET SINGLE LAB DETAILS
export const getLabDetails = async (req, res) => {
    try {
        const { labId } = req.params;
        const { role, organizationIdentifier } = req.user;

        const query = role === 'super_admin' 
            ? { _id: labId } 
            : { _id: labId, organizationIdentifier };

        const lab = await Lab.findOne(query)
            .populate('organization', 'name displayName identifier')
            .populate('staffUsers.userId', 'fullName email role username isActive tempPassword')
            .populate('settings.verificationEnabledBy', 'fullName email');

        if (!lab) {
            return res.status(404).json({ success: false, message: 'Lab not found' });
        }

        res.json({ success: true, data: lab });
    } catch (error) {
        console.error('❌ Get lab details error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch lab details' });
    }
};

// ✅ UPDATE LAB DETAILS
export const updateLabDetails = async (req, res) => {
    try {
        const { labId } = req.params;
        const { role, organizationIdentifier } = req.user;

        if (!['admin', 'super_admin', 'group_id'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const {
            name, contactPerson, contactEmail, contactPhone,
            address, notes,
            settings: {
                requireReportVerification,
                enableCompression,
                autoAssignStudies,
                defaultPriority,
                maxConcurrentStudies
            } = {}
        } = req.body;

        const query = role === 'super_admin'
            ? { _id: labId }
            : { _id: labId, organizationIdentifier };

        const lab = await Lab.findOne(query);
        if (!lab) {
            return res.status(404).json({ success: false, message: 'Lab not found' });
        }

        // ✅ Update basic info
        if (name) lab.name = name;
        if (contactPerson !== undefined) lab.contactPerson = contactPerson;
        if (contactEmail !== undefined) lab.contactEmail = contactEmail;
        if (contactPhone !== undefined) lab.contactPhone = contactPhone;
        if (address !== undefined) lab.address = { ...lab.address, ...address };
        if (notes !== undefined) lab.notes = notes;

        // ✅ Update settings
        if (!lab.settings) lab.settings = {};
        if (requireReportVerification !== undefined) {
            lab.settings.requireReportVerification = requireReportVerification;
            if (requireReportVerification) {
                lab.settings.verificationEnabledAt = new Date();
                lab.settings.verificationEnabledBy = req.user._id;
            }
        }
        if (enableCompression !== undefined) lab.settings.enableCompression = enableCompression;
        if (autoAssignStudies !== undefined) lab.settings.autoAssignStudies = autoAssignStudies;
        if (defaultPriority !== undefined) lab.settings.defaultPriority = defaultPriority;
        if (maxConcurrentStudies !== undefined) lab.settings.maxConcurrentStudies = maxConcurrentStudies;

        await lab.save();

        const updatedLab = await Lab.findById(labId)
            .populate('organization', 'name displayName identifier')
            .populate('staffUsers.userId', 'fullName email role isActive');

        console.log(`✅ Lab ${lab.name} updated by ${req.user.email}`);

        res.json({ success: true, message: 'Lab updated successfully', data: updatedLab });
    } catch (error) {
        console.error('❌ Update lab error:', error);
        res.status(500).json({ success: false, message: 'Failed to update lab' });
    }
};