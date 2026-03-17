import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import StudyShare from '../models/studyShareModel.js';
import DicomStudy from '../models/dicomStudyModel.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const generateToken = () => crypto.randomBytes(32).toString('hex');

const EXPIRY_PRESETS = {
    '1h':   60 * 60 * 1000,
    '6h':   6  * 60 * 60 * 1000,
    '24h':  24 * 60 * 60 * 1000,
    '7d':   7  * 24 * 60 * 60 * 1000,
    '30d':  30 * 24 * 60 * 60 * 1000,
};

// ─── CREATE SHARE LINK ────────────────────────────────────────────────────────

export const createShareLink = async (req, res) => {
    try {
        const { studyId } = req.params;
        const {
            expiryPreset = '24h',
            accessType   = 'view_only',
            password     = null,
            maxUses      = null,
        } = req.body;

        const currentUser = req.user;
        if (!currentUser) return res.status(401).json({ success: false, message: 'Unauthorized' });

        if (!mongoose.Types.ObjectId.isValid(studyId)) {
            return res.status(400).json({ success: false, message: 'Invalid study ID' });
        }

        const study = await DicomStudy.findById(studyId).lean();
        if (!study) return res.status(404).json({ success: false, message: 'Study not found' });

        // ── ORG SCOPE CHECK ───────────────────────────────────────────────────
        if (
            currentUser.role !== 'super_admin' &&
            study.organizationIdentifier !== currentUser.organizationIdentifier
        ) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // ── EXPIRY ────────────────────────────────────────────────────────────
        const expiryMs = EXPIRY_PRESETS[expiryPreset] ?? EXPIRY_PRESETS['24h'];
        const expiresAt = new Date(Date.now() + expiryMs);

        // ── PASSWORD HASH ─────────────────────────────────────────────────────
        let passwordHash = null;
        let isPasswordProtected = false;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
            isPasswordProtected = true;
        }

        const shareToken = generateToken();

        const share = await StudyShare.create({
            shareToken,
            dicomStudy:             study._id,
            studyInstanceUID:       study.studyInstanceUID,
            orthancStudyID:         study.orthancStudyID,
            bharatPacsId:           study.bharatPacsId,
            organizationIdentifier: study.organizationIdentifier,
            createdBy:              currentUser._id,
            createdByName:          currentUser.fullName,
            createdByRole:          currentUser.role,
            expiresAt,
            accessType,
            passwordHash,
            isPasswordProtected,
            maxUses: maxUses ? parseInt(maxUses) : null,
            patientSnapshot: {
                patientName:     study.patientInfo?.patientName,
                patientID:       study.patientInfo?.patientID,
                modality:        study.modality,
                studyDate:       study.studyDate,
                examDescription: study.examDescription,
            },
        });

        const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/study/${shareToken}`;

        console.log(`🔗 [Share] Created share link for study ${study.bharatPacsId} by ${currentUser.fullName}`, {
            token:      shareToken.substring(0, 8) + '...',
            expiresAt,
            accessType,
            isPasswordProtected,
        });

        return res.status(201).json({
            success: true,
            message: 'Share link created successfully',
            data: {
                shareId:            share._id,
                shareUrl,
                shareToken,
                expiresAt,
                expiryPreset,
                accessType,
                isPasswordProtected,
                maxUses,
            },
        });

    } catch (error) {
        console.error('❌ [Share] Create error:', error);
        res.status(500).json({ success: false, message: 'Failed to create share link' });
    }
};

// ─── VALIDATE / ACCESS SHARED LINK ───────────────────────────────────────────

export const accessSharedStudy = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body ?? {};

        const share = await StudyShare.findOne({ shareToken: token });

        if (!share) {
            return res.status(404).json({ success: false, message: 'Share link not found' });
        }

        // ── VALIDITY CHECK ────────────────────────────────────────────────────
        const { valid, reason } = share.isValid();
        if (!valid) {
            return res.status(410).json({ success: false, message: reason });
        }

        // ── PASSWORD CHECK ────────────────────────────────────────────────────
        if (share.isPasswordProtected) {
            if (!password) {
                return res.status(401).json({
                    success: false,
                    message: 'Password required',
                    requiresPassword: true,
                });
            }
            const passwordMatch = await bcrypt.compare(password, share.passwordHash);
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: 'Incorrect password' });
            }
        }

        // ── LOG ACCESS ────────────────────────────────────────────────────────
        share.useCount += 1;
        share.accessLog.push({
            accessedAt: new Date(),
            ipAddress:  req.ip || req.headers['x-forwarded-for'] || 'unknown',
            userAgent:  req.headers['user-agent'] || 'unknown',
            accessedBy: req.user?.email || 'anonymous',
        });
        await share.save();

        // ── BUILD OHIF URL ─────────────────────────────────────────────────────
        const ohifBase = process.env.OHIF_URL || 'http://localhost:3000';
        const ohifUrl  = `${ohifBase}/viewer?StudyInstanceUIDs=${share.studyInstanceUID}`;

        console.log(`👁️ [Share] Access: token=${token.substring(0, 8)}... uses=${share.useCount}`);

        return res.status(200).json({
            success: true,
            data: {
                ohifUrl,
                studyInstanceUID: share.studyInstanceUID,
                orthancStudyID:   share.orthancStudyID,
                accessType:       share.accessType,
                expiresAt:        share.expiresAt,
                patientSnapshot:  share.patientSnapshot,
                remainingUses:    share.maxUses !== null ? share.maxUses - share.useCount : null,
            },
        });

    } catch (error) {
        console.error('❌ [Share] Access error:', error);
        res.status(500).json({ success: false, message: 'Failed to access shared study' });
    }
};

// ─── REVOKE SHARE LINK ────────────────────────────────────────────────────────

export const revokeShareLink = async (req, res) => {
    try {
        const { shareId } = req.params;
        const currentUser = req.user;

        const share = await StudyShare.findById(shareId);
        if (!share) return res.status(404).json({ success: false, message: 'Share not found' });

        // Only creator or admin can revoke
        const isOwner = share.createdBy.toString() === currentUser._id.toString();
        const isAdmin = ['admin', 'super_admin'].includes(currentUser.role);
        const isSameOrg = share.organizationIdentifier === currentUser.organizationIdentifier;

        if (!isOwner && !(isAdmin && isSameOrg)) {
            return res.status(403).json({ success: false, message: 'Not authorized to revoke this link' });
        }

        share.isRevoked  = true;
        share.revokedAt  = new Date();
        share.revokedBy  = currentUser._id;
        await share.save();

        console.log(`🚫 [Share] Revoked: ${shareId} by ${currentUser.fullName}`);

        return res.status(200).json({ success: true, message: 'Share link revoked successfully' });

    } catch (error) {
        console.error('❌ [Share] Revoke error:', error);
        res.status(500).json({ success: false, message: 'Failed to revoke share link' });
    }
};

// ─── GET MY SHARES (for a study) ─────────────────────────────────────────────

export const getStudyShares = async (req, res) => {
    try {
        const { studyId } = req.params;
        const currentUser = req.user;

        const query = {
            dicomStudy:             studyId,
            organizationIdentifier: currentUser.organizationIdentifier,
        };

        // Non-admins only see their own shares
        if (!['admin', 'super_admin'].includes(currentUser.role)) {
            query.createdBy = currentUser._id;
        }

        const shares = await StudyShare.find(query)
            .select('-passwordHash -accessLog')
            .sort({ createdAt: -1 })
            .lean();

        const enriched = shares.map(s => ({
            ...s,
            isExpired: new Date() > s.expiresAt,
            shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/study/${s.shareToken}`,
        }));

        return res.status(200).json({ success: true, data: enriched, count: enriched.length });

    } catch (error) {
        console.error('❌ [Share] Get shares error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch shares' });
    }
};

export default { createShareLink, accessSharedStudy, revokeShareLink, getStudyShares };