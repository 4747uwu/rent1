import mongoose from 'mongoose';

const StudyShareSchema = new mongoose.Schema({
    // ── CORE ──────────────────────────────────────────────────────────────────
    shareToken: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    // ── STUDY REFERENCE ───────────────────────────────────────────────────────
    dicomStudy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DicomStudy',
        required: true,
    },
    studyInstanceUID: { type: String, required: true },
    orthancStudyID:   { type: String },
    bharatPacsId:     { type: String },
    organizationIdentifier: { type: String, required: true },

    // ── CREATED BY ────────────────────────────────────────────────────────────
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdByName: { type: String },
    createdByRole: { type: String },

    // ── SHARE SETTINGS ────────────────────────────────────────────────────────
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 }, // TTL auto-delete
    },

    accessType: {
        type: String,
        enum: ['view_only', 'view_and_report'],
        default: 'view_only',
    },

    // Optional password protection
    passwordHash: { type: String, default: null },
    isPasswordProtected: { type: Boolean, default: false },

    // Max uses (null = unlimited)
    maxUses: { type: Number, default: null },
    useCount: { type: Number, default: 0 },

    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── ACCESS LOG ────────────────────────────────────────────────────────────
    accessLog: [{
        accessedAt:   { type: Date, default: Date.now },
        ipAddress:    { type: String },
        userAgent:    { type: String },
        accessedBy:   { type: String }, // email or 'anonymous'
    }],

    // ── PATIENT INFO SNAPSHOT (for display without full study access) ─────────
    patientSnapshot: {
        patientName: String,
        patientID:   String,
        modality:    String,
        studyDate:   Date,
        examDescription: String,
    },

}, {
    timestamps: true,
    collection: 'studyshares',
});

StudyShareSchema.index({ dicomStudy: 1, isRevoked: 1 });
StudyShareSchema.index({ organizationIdentifier: 1, createdAt: -1 });
StudyShareSchema.index({ createdBy: 1, createdAt: -1 });

StudyShareSchema.methods.isValid = function () {
    if (this.isRevoked) return { valid: false, reason: 'Link has been revoked' };
    if (new Date() > this.expiresAt) return { valid: false, reason: 'Link has expired' };
    if (this.maxUses !== null && this.useCount >= this.maxUses)
        return { valid: false, reason: 'Maximum uses reached' };
    return { valid: true };
};

export default mongoose.model('StudyShare', StudyShareSchema);