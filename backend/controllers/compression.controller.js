// controllers/compression.controller.js
import Lab from '../models/labModel.js';
import crypto from 'crypto';

// 🔒 SECURITY: Protected API key verification
const COMPRESSION_API_KEY = process.env.COMPRESSION_API_KEY || 'secure_compression_key_2026';

/**
 * Verify the API key sent from frontend
 * @param {string} key - API key from request
 * @returns {boolean} - True if key is valid
 */
const verifyCompressionKey = (key) => {
    if (!key) return false;
    
    // Use constant-time comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(COMPRESSION_API_KEY);
    const providedBuffer = Buffer.from(key);
    
    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }
    
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

/**
 * ✅ SINGLE LAB: Toggle compression on/off for a single lab
 * POST /api/compression/toggle-single
 * Body: { labId, enable, apiKey }
 */
export const toggleSingleLabCompression = async (req, res) => {
    try {
        const { labId, enable, apiKey } = req.body;
        
        // 🔒 STEP 1: Verify API key
        if (!verifyCompressionKey(apiKey)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or missing API key. Unauthorized access.'
            });
        }
        
        // 🔍 STEP 2: Validate input
        if (!labId) {
            return res.status(400).json({
                success: false,
                message: 'Lab ID is required'
            });
        }
        
        if (typeof enable !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Enable flag must be a boolean value'
            });
        }
        
        // 🔍 STEP 3: Find the lab
        const lab = await Lab.findById(labId);
        
        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'Lab not found'
            });
        }
        
        // 🔄 STEP 4: Update compression setting
        const previousState = lab.settings.enableCompression;
        lab.settings.enableCompression = enable;
        
        if (enable) {
            lab.settings.compressionEnabledAt = new Date();
            lab.settings.compressionEnabledBy = req.user?._id || null;
        } else {
            lab.settings.compressionDisabledAt = new Date();
            lab.settings.compressionDisabledBy = req.user?._id || null;
        }
        
        await lab.save();
        
        // 📤 STEP 5: Return success response
        return res.status(200).json({
            success: true,
            message: `Compression ${enable ? 'enabled' : 'disabled'} successfully for lab: ${lab.name}`,
            data: {
                labId: lab._id,
                labName: lab.name,
                labIdentifier: lab.identifier,
                compressionEnabled: lab.settings.enableCompression,
                previousState,
                changedAt: enable ? lab.settings.compressionEnabledAt : lab.settings.compressionDisabledAt,
                changedBy: req.user?.fullName || 'System'
            }
        });
        
    } catch (error) {
        console.error('❌ Error toggling single lab compression:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to toggle compression',
            error: error.message
        });
    }
};

/**
 * ✅ BATCH LABS: Toggle compression on/off for multiple labs
 * POST /api/compression/toggle-batch
 * Body: { labIds: [], enable, apiKey }
 */
export const toggleBatchLabsCompression = async (req, res) => {
    try {
        const { labIds, enable, apiKey } = req.body;
        
        // 🔒 STEP 1: Verify API key
        if (!verifyCompressionKey(apiKey)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or missing API key. Unauthorized access.'
            });
        }
        
        // 🔍 STEP 2: Validate input
        if (!labIds || !Array.isArray(labIds) || labIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lab IDs array is required and must not be empty'
            });
        }
        
        if (typeof enable !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Enable flag must be a boolean value'
            });
        }
        
        // 🔍 STEP 3: Find all labs
        const labs = await Lab.find({ _id: { $in: labIds } });
        
        if (labs.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No labs found with the provided IDs'
            });
        }
        
        // 🔄 STEP 4: Update compression for all labs
        const results = {
            success: [],
            failed: [],
            total: labIds.length,
            processed: 0
        };
        
        for (const lab of labs) {
            try {
                const previousState = lab.settings.enableCompression;
                lab.settings.enableCompression = enable;
                
                if (enable) {
                    lab.settings.compressionEnabledAt = new Date();
                    lab.settings.compressionEnabledBy = req.user?._id || null;
                } else {
                    lab.settings.compressionDisabledAt = new Date();
                    lab.settings.compressionDisabledBy = req.user?._id || null;
                }
                
                await lab.save();
                
                results.success.push({
                    labId: lab._id,
                    labName: lab.name,
                    labIdentifier: lab.identifier,
                    previousState,
                    newState: enable
                });
                results.processed++;
                
            } catch (err) {
                results.failed.push({
                    labId: lab._id,
                    labName: lab.name,
                    error: err.message
                });
            }
        }
        
        // 📤 STEP 5: Return success response
        return res.status(200).json({
            success: true,
            message: `Batch compression update completed. ${results.success.length} successful, ${results.failed.length} failed.`,
            data: {
                compressionEnabled: enable,
                totalRequested: results.total,
                successCount: results.success.length,
                failedCount: results.failed.length,
                successfulLabs: results.success,
                failedLabs: results.failed,
                changedBy: req.user?.fullName || 'System',
                changedAt: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Error toggling batch labs compression:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to toggle batch compression',
            error: error.message
        });
    }
};

/**
 * ✅ GET COMPRESSION STATUS: Get compression status for a lab or multiple labs
 * GET /api/compression/status/:labId?apiKey=xxx
 * GET /api/compression/status?labIds=id1,id2,id3&apiKey=xxx
 */
export const getCompressionStatus = async (req, res) => {
    try {
        const { labId } = req.params;
        const { labIds, apiKey } = req.query;
        
        // 🔒 STEP 1: Verify API key
        if (!verifyCompressionKey(apiKey)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or missing API key. Unauthorized access.'
            });
        }
        
        let labs;
        
        // Single lab query
        if (labId) {
            labs = await Lab.findById(labId).select('name identifier settings.enableCompression settings.compressionEnabledAt settings.compressionDisabledAt');
            
            if (!labs) {
                return res.status(404).json({
                    success: false,
                    message: 'Lab not found'
                });
            }
            
            return res.status(200).json({
                success: true,
                data: {
                    labId: labs._id,
                    labName: labs.name,
                    labIdentifier: labs.identifier,
                    compressionEnabled: labs.settings.enableCompression,
                    lastEnabledAt: labs.settings.compressionEnabledAt,
                    lastDisabledAt: labs.settings.compressionDisabledAt
                }
            });
        }
        
        // Multiple labs query
        if (labIds) {
            const labIdArray = labIds.split(',');
            labs = await Lab.find({ _id: { $in: labIdArray } })
                .select('name identifier settings.enableCompression settings.compressionEnabledAt settings.compressionDisabledAt');
            
            return res.status(200).json({
                success: true,
                data: labs.map(lab => ({
                    labId: lab._id,
                    labName: lab.name,
                    labIdentifier: lab.identifier,
                    compressionEnabled: lab.settings.enableCompression,
                    lastEnabledAt: lab.settings.compressionEnabledAt,
                    lastDisabledAt: lab.settings.compressionDisabledAt
                }))
            });
        }
        
        return res.status(400).json({
            success: false,
            message: 'Please provide either labId in params or labIds in query'
        });
        
    } catch (error) {
        console.error('❌ Error getting compression status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get compression status',
            error: error.message
        });
    }
};

/**
 * ✅ GET ALL LABS COMPRESSION STATUS (No API key required for read-only)
 * GET /api/compression/status-all?organizationId=xxx
 */
export const getAllLabsCompressionStatus = async (req, res) => {
    try {
        const { organizationId } = req.query;
        
        console.log('🔍 Fetching compression status for organization:', organizationId);
        
        // Build query
        const query = { isActive: true };
        if (organizationId) {
            query.organization = organizationId;
        }
        
        // Get all labs with compression status
        const labs = await Lab.find(query)
            .select('name identifier organizationIdentifier settings.enableCompression settings.compressionEnabledAt settings.compressionDisabledAt')
            .sort({ name: 1 });
        
        console.log(`✅ Found ${labs.length} labs`);
        
        const summary = {
            total: labs.length,
            compressionEnabled: labs.filter(lab => lab.settings.enableCompression).length,
            compressionDisabled: labs.filter(lab => !lab.settings.enableCompression).length
        };
        
        return res.status(200).json({
            success: true,
            summary,
            data: labs.map(lab => ({
                labId: lab._id,
                labName: lab.name,
                labIdentifier: lab.identifier,
                organizationIdentifier: lab.organizationIdentifier,
                compressionEnabled: lab.settings.enableCompression || false,
                lastEnabledAt: lab.settings.compressionEnabledAt,
                lastDisabledAt: lab.settings.compressionDisabledAt
            }))
        });
        
    } catch (error) {
        console.error('❌ Error getting all labs compression status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get compression status for all labs',
            error: error.message
        });
    }
};