// models/LabBillingConfig.model.js
import mongoose from 'mongoose';

/**
 * LabBillingConfig - Per-lab billing configuration
 * Maps billing modules to lab-specific prices.
 * One document per lab.
 */
const LabBillingItemSchema = new mongoose.Schema(
    {
        module: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BillingModule',
            required: true,
        },
        // Denormalized for fast reads
        moduleName: { type: String, required: true, trim: true },
        moduleCode: { type: String, trim: true, uppercase: true },
        modality: { type: String },

        // Lab-specific price (overrides module default)
        price: {
            type: Number,
            required: [true, 'Price is required for each billing item'],
            min: 0,
        },

        currency: {
            type: String,
            default: 'INR',
            uppercase: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        notes: { type: String, trim: true },
    },
    { _id: true }
);

const LabBillingConfigSchema = new mongoose.Schema(
    {
        lab: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lab',
            required: true,
            unique: true,   // one billing config per lab
            index: true,
        },
        labName: { type: String, trim: true },   // denormalized
        labIdentifier: { type: String, uppercase: true },

        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        organizationIdentifier: {
            type: String,
            required: true,
            uppercase: true,
            index: true,
        },

        // Billing items for this lab
        billingItems: [LabBillingItemSchema],

        // Default currency for this lab
        currency: {
            type: String,
            default: 'INR',
            uppercase: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

const LabBillingConfig = mongoose.model('LabBillingConfig', LabBillingConfigSchema);
export default LabBillingConfig;
