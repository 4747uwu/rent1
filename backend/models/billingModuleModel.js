// models/BillingModule.model.js
import mongoose from 'mongoose';

/**
 * BillingModule - Admin-defined billing service items
 * e.g. "CT Head", "MRI Brain", "Chest X-Ray"
 * Admin can optionally set a default price; labs can override per-lab.
 */
const BillingModuleSchema = new mongoose.Schema(
    {
        // Organization reference (super_admin modules have no org = global templates)
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            index: true,
        },
        organizationIdentifier: {
            type: String,
            uppercase: true,
            index: true,
        },

        name: {
            type: String,
            required: [true, 'Module name is required'],
            trim: true,
        },

        code: {
            type: String,
            trim: true,
            uppercase: true,
        },

        description: {
            type: String,
            trim: true,
        },

        modality: {
            type: String,
            enum: ['CT', 'MRI', 'MR', 'XR', 'CR', 'DX', 'US', 'MG', 'NM', 'PT', 'RF', 'OT', 'OTHER'],
            required: [true, 'Modality is required'],
        },

        // Optional global default price (labs can override)
        defaultPrice: {
            type: Number,
            min: 0,
            default: null,
        },

        currency: {
            type: String,
            default: 'INR',
            uppercase: true,
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true }
);

// Compound index to prevent duplicate module names per org
BillingModuleSchema.index({ organizationIdentifier: 1, name: 1 }, { unique: true, sparse: true });
BillingModuleSchema.index({ organizationIdentifier: 1, modality: 1 });

const BillingModule = mongoose.model('BillingModule', BillingModuleSchema);
export default BillingModule;
