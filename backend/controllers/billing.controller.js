// controllers/billing.controller.js
import BillingModule from '../models/billingModuleModel.js';
import LabBillingConfig from '../models/labBillingConfigModel.js';
import DicomStudy from '../models/dicomStudyModel.js';
import Lab from '../models/labModel.js';

// ─────────────────────────────────────────────────────────────
//  BILLING MODULE CRUD (Admin)
// ─────────────────────────────────────────────────────────────

/** GET /billing/modules  — list all modules for this org */
export const getBillingModules = async (req, res) => {
    try {
        const { role, organizationIdentifier } = req.user;

        const query =
            role === 'super_admin'
                ? {}
                : { organizationIdentifier };

        const modules = await BillingModule.find(query)
            .populate('createdBy', 'fullName email')
            .sort({ modality: 1, name: 1 })
            .lean();

        res.json({ success: true, data: modules });
    } catch (err) {
        console.error('getBillingModules error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch billing modules' });
    }
};

/** POST /billing/modules */
export const createBillingModule = async (req, res) => {
    try {
        const { role, organizationIdentifier, organization, _id } = req.user;

        if (!['admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { name, code, description, modality, defaultPrice, currency } = req.body;

        if (!name || !modality) {
            return res.status(400).json({ success: false, message: 'name and modality are required' });
        }

        const module = new BillingModule({
            organization: role === 'super_admin' ? null : organization,
            organizationIdentifier: role === 'super_admin' ? null : organizationIdentifier,
            name: name.trim(),
            code: code ? code.trim().toUpperCase() : undefined,
            description,
            modality,
            defaultPrice: defaultPrice !== undefined && defaultPrice !== '' ? Number(defaultPrice) : null,
            currency: currency || 'INR',
            createdBy: _id,
        });

        await module.save();
        res.status(201).json({ success: true, data: module, message: 'Billing module created' });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'A module with this name already exists for this organization.' });
        }
        console.error('createBillingModule error:', err);
        res.status(500).json({ success: false, message: 'Failed to create billing module' });
    }
};

/** PUT /billing/modules/:moduleId */
export const updateBillingModule = async (req, res) => {
    try {
        const { role, organizationIdentifier } = req.user;
        if (!['admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const query =
            role === 'super_admin'
                ? { _id: req.params.moduleId }
                : { _id: req.params.moduleId, organizationIdentifier };

        const { name, code, description, modality, defaultPrice, currency, isActive } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (code !== undefined) updateData.code = code.trim().toUpperCase();
        if (description !== undefined) updateData.description = description;
        if (modality !== undefined) updateData.modality = modality;
        if (defaultPrice !== undefined) updateData.defaultPrice = defaultPrice !== '' ? Number(defaultPrice) : null;
        if (currency !== undefined) updateData.currency = currency;
        if (isActive !== undefined) updateData.isActive = isActive;

        const updated = await BillingModule.findOneAndUpdate(query, { $set: updateData }, { new: true, runValidators: true });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Billing module not found' });
        }

        res.json({ success: true, data: updated, message: 'Billing module updated' });
    } catch (err) {
        console.error('updateBillingModule error:', err);
        res.status(500).json({ success: false, message: 'Failed to update billing module' });
    }
};

/** DELETE /billing/modules/:moduleId */
export const deleteBillingModule = async (req, res) => {
    try {
        const { role, organizationIdentifier } = req.user;
        if (!['admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const query =
            role === 'super_admin'
                ? { _id: req.params.moduleId }
                : { _id: req.params.moduleId, organizationIdentifier };

        const deleted = await BillingModule.findOneAndDelete(query);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Billing module not found' });
        }

        res.json({ success: true, message: 'Billing module deleted' });
    } catch (err) {
        console.error('deleteBillingModule error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete billing module' });
    }
};

// ─────────────────────────────────────────────────────────────
//  LAB BILLING CONFIG (Admin)
// ─────────────────────────────────────────────────────────────

/** GET /billing/lab/:labId  — get billing config for a lab */
export const getLabBillingConfig = async (req, res) => {
    try {
        const { role, organizationIdentifier } = req.user;
        const { labId } = req.params;

        const query =
            role === 'super_admin'
                ? { lab: labId }
                : { lab: labId, organizationIdentifier };

        const config = await LabBillingConfig.findOne(query)
            .populate('billingItems.module', 'name code modality defaultPrice')
            .populate('createdBy', 'fullName email')
            .populate('updatedBy', 'fullName email')
            .lean();

        res.json({ success: true, data: config || null });
    } catch (err) {
        console.error('getLabBillingConfig error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch lab billing config' });
    }
};

/** POST /billing/lab/:labId  — create or overwrite billing config for a lab */
export const saveLabBillingConfig = async (req, res) => {
    try {
        const { role, organizationIdentifier, organization, _id } = req.user;
        const { labId } = req.params;

        if (!['admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { billingItems, currency } = req.body;

        if (!Array.isArray(billingItems)) {
            return res.status(400).json({ success: false, message: 'billingItems must be an array' });
        }

        // Validate each item
        for (const item of billingItems) {
            if (!item.module) return res.status(400).json({ success: false, message: 'Each billing item must have a module reference.' });
            if (item.price === undefined || item.price === null || item.price === '') {
                return res.status(400).json({ success: false, message: `Price is required for each billing item (module: ${item.moduleName})` });
            }
        }

        // Get lab info for denormalization
        const lab = await Lab.findById(labId).lean();
        if (!lab) return res.status(404).json({ success: false, message: 'Lab not found' });

        const configData = {
            lab: labId,
            labName: lab.name,
            labIdentifier: lab.identifier,
            organization: organization || lab.organization,
            organizationIdentifier: organizationIdentifier || lab.organizationIdentifier,
            currency: currency || 'INR',
            billingItems: billingItems.map(item => ({
                module: item.module,
                moduleName: item.moduleName,
                moduleCode: item.moduleCode,
                modality: item.modality,
                price: Number(item.price),
                currency: item.currency || currency || 'INR',
                isActive: item.isActive !== false,
                notes: item.notes,
            })),
            updatedBy: _id,
        };

        const config = await LabBillingConfig.findOneAndUpdate(
            { lab: labId },
            { $set: configData, $setOnInsert: { createdBy: _id } },
            { new: true, upsert: true, runValidators: true }
        );

        res.json({ success: true, data: config, message: 'Lab billing config saved successfully' });
    } catch (err) {
        console.error('saveLabBillingConfig error:', err);
        res.status(500).json({ success: false, message: 'Failed to save lab billing config' });
    }
};

// ─────────────────────────────────────────────────────────────
//  STUDY BILLING (Verifier sets billing during verification)
// ─────────────────────────────────────────────────────────────

/**
 * GET /billing/study/:studyId/options
 * Returns the billing modules available for the lab this study belongs to.
 * Called when verifier opens a study for verification.
 */
export const getStudyBillingOptions = async (req, res) => {
    try {
        const { studyId } = req.params;

        const study = await DicomStudy.findById(studyId)
            .select('sourceLab organizationIdentifier billing')
            .lean();

        if (!study) return res.status(404).json({ success: false, message: 'Study not found' });

        // Fetch lab billing config
        const labConfig = study.sourceLab
            ? await LabBillingConfig.findOne({ lab: study.sourceLab, isActive: true })
                  .populate('billingItems.module', 'name code modality defaultPrice')
                  .lean()
            : null;

        res.json({
            success: true,
            data: {
                labConfig,
                currentBilling: study.billing,
            },
        });
    } catch (err) {
        console.error('getStudyBillingOptions error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch billing options' });
    }
};

/**
 * PUT /billing/study/:studyId
 * Verifier selects a billing module for the study.
 */
export const setStudyBilling = async (req, res) => {
    try {
        const { role, _id, fullName } = req.user;
        const { studyId } = req.params;

        if (!['verifier', 'admin', 'super_admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { billingItemId, labConfigId } = req.body;
        // billingItemId is the _id of the item inside LabBillingConfig.billingItems

        if (!billingItemId) {
            return res.status(400).json({ success: false, message: 'billingItemId is required' });
        }

        // Get the lab billing config
        const labConfig = await LabBillingConfig.findById(labConfigId)
            .populate('billingItems.module')
            .lean();

        if (!labConfig) {
            return res.status(404).json({ success: false, message: 'Lab billing config not found' });
        }

        const item = labConfig.billingItems.find(i => i._id.toString() === billingItemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Billing item not found in lab config' });
        }

        const billingUpdate = {
            'billing.billingModule': item.module._id || item.module,
            'billing.moduleName': item.moduleName,
            'billing.moduleCode': item.moduleCode,
            'billing.modality': item.modality,
            'billing.amount': item.price,
            'billing.currency': item.currency || labConfig?.currency || 'INR',
            'billing.billedAt': new Date(),
            'billing.billedBy': _id,
            'billing.billedByName': fullName,
            'billing.paymentStatus': 'pending',
            'billing.isBilled': true,
        };

        const study = await DicomStudy.findByIdAndUpdate(
            studyId,
            { $set: billingUpdate },
            { new: true }
        ).select('billing bharatPacsId patientInfo');

        if (!study) return res.status(404).json({ success: false, message: 'Study not found' });

        res.json({ success: true, data: study.billing, message: 'Study billing updated' });
    } catch (err) {
        console.error('setStudyBilling error:', err);
        res.status(500).json({ success: false, message: 'Failed to set study billing' });
    }
};

/**
 * GET /billing/reports/lab/:labId
 * Admin/billing role — get all billed studies for a lab.
 */
export const getLabBillingReport = async (req, res) => {
    try {
        const { role, organizationIdentifier } = req.user;
        const { labId } = req.params;
        const { from, to, paymentStatus, page = 1, limit = 50 } = req.query;

        if (!['admin', 'super_admin', 'billing', 'lab_staff'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const matchQuery = {
            'billing.isBilled': true,
        };

        if (role !== 'super_admin') {
            matchQuery.organizationIdentifier = organizationIdentifier;
        }

        if (role === 'lab_staff') {
            // Lab staff can only view their own lab's billing
            if (req.user.lab) {
                matchQuery.sourceLab = new (await import('mongoose')).default.Types.ObjectId(req.user.lab);
            } else {
                return res.status(403).json({ success: false, message: 'No lab associated with your account' });
            }
        } else if (labId && labId !== 'all') {
            matchQuery.sourceLab = new (await import('mongoose')).default.Types.ObjectId(labId);
        }

        if (paymentStatus) {
            matchQuery['billing.paymentStatus'] = paymentStatus;
        }

        if (from || to) {
            matchQuery['billing.billedAt'] = {};
            if (from) matchQuery['billing.billedAt'].$gte = new Date(from);
            if (to) matchQuery['billing.billedAt'].$lte = new Date(to);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [studies, totalCount] = await Promise.all([
            DicomStudy.find(matchQuery)
                .select('bharatPacsId patientInfo modality studyDate billing sourceLab workflowStatus')
                .populate('sourceLab', 'name identifier')
                .sort({ 'billing.billedAt': -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            DicomStudy.countDocuments(matchQuery),
        ]);

        // Aggregate totals
        const totalAmount = studies.reduce((sum, s) => sum + (s.billing?.amount || 0), 0);

        res.json({
            success: true,
            data: studies,
            totalAmount,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalCount / Number(limit)),
                totalRecords: totalCount,
            },
        });
    } catch (err) {
        console.error('getLabBillingReport error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch billing report' });
    }
};
