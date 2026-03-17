import DicomStudy from '../models/dicomStudyModel.js';
import axios from 'axios';

const ORTHANC_BASE_URL = 'http://206.189.133.52:8042';
const ORTHANC_USERNAME = process.env.ORTHANC_USERNAME || 'alice';
const ORTHANC_PASSWORD = process.env.ORTHANC_PASSWORD || 'alicePassword';
const orthancAuth = 'Basic ' + Buffer.from(ORTHANC_USERNAME + ':' + ORTHANC_PASSWORD).toString('base64');

// ✅ Cloudflare download (already frontend-based)
export const getCloudflareZipUrl = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('preProcessedDownload bharatPacsId orthancStudyID');

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        if (study.preProcessedDownload?.zipStatus !== 'completed' || !study.preProcessedDownload?.zipUrl) {
            return res.status(404).json({
                success: false,
                message: 'ZIP file not available. Please create it first.',
                zipStatus: study.preProcessedDownload?.zipStatus || 'not_created'
            });
        }

        await DicomStudy.updateOne(
            { _id: studyId },
            {
                $inc: { 'preProcessedDownload.downloadCount': 1 },
                $set: { 'preProcessedDownload.lastDownloaded': new Date() }
            }
        );

        res.json({
            success: true,
            data: {
                zipUrl: study.preProcessedDownload.zipUrl,
                zipSizeMB: study.preProcessedDownload.zipSizeMB,
                createdAt: study.preProcessedDownload.zipCreatedAt,
                expiresAt: study.preProcessedDownload.zipExpiresAt
            }
        });

    } catch (error) {
        console.error('❌ Error getting Cloudflare ZIP URL:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get download URL',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ NEW: Proxy anonymized study download (stream through backend)
export const downloadAnonymizedStudy = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        console.log(`📥 Anonymized download request - Study: ${studyId}, User Org: ${user?.organizationIdentifier}`);

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('orthancStudyID bharatPacsId');

        console.log(`🔍 Study lookup result:`, study);

        if (!study) {
            console.warn(`⚠️ Study not found: ${studyId} for org ${user.organizationIdentifier}`);
            return res.status(404).json({
                success: false,
                message: 'Study not found or access denied',
                debug: { studyId, userOrg: user.organizationIdentifier }
            });
        }

        if (!study.orthancStudyID) {
            console.warn(`⚠️ Study found but orthancStudyID missing: ${studyId}`);
            return res.status(404).json({
                success: false,
                message: 'Study not associated with Orthanc',
                debug: { studyId, orthancStudyID: study.orthancStudyID }
            });
        }

        console.log(`🔐 Creating and downloading anonymized study for: ${study.orthancStudyID}`);

        // Create anonymization job
        const anonymizeResponse = await axios.post(
            `${ORTHANC_BASE_URL}/studies/${study.orthancStudyID}/anonymize`,
            {
                Replace: {
                    PatientName: 'ANONYMIZED',
                    PatientID: study.bharatPacsId || 'ANON_PATIENT'
                },
                Keep: ['StudyDescription', 'Modality'],
                KeepPrivateTags: false,
                Force: true,
                Synchronous: false
            },
            {
                headers: { 
                    'Authorization': orthancAuth,
                    'Content-Type': 'application/json'
                },
                timeout: 60000
            }
        );

        const jobId = anonymizeResponse.data.ID;
        console.log(`🔄 Anonymization job created: ${jobId}`);

        // Wait for job completion
        let anonymizedStudyId = null;
        let attempts = 0;
        const maxAttempts = 120;

        while (attempts < maxAttempts) {
            const jobStatus = await axios.get(
                `${ORTHANC_BASE_URL}/jobs/${jobId}`,
                { headers: { 'Authorization': orthancAuth } }
            );

            if (jobStatus.data.State === 'Success') {
                anonymizedStudyId = jobStatus.data.Content?.ID;
                console.log(`✅ Anonymization completed: ${anonymizedStudyId}`);
                break;
            } else if (jobStatus.data.State === 'Failure') {
                throw new Error(`Anonymization failed: ${jobStatus.data.ErrorDetails || 'Unknown'}`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        if (!anonymizedStudyId) {
            throw new Error('Anonymization timeout after 2 minutes');
        }

        // ✅ FIX: Get the archive as a stream with proper headers
        const archiveResponse = await axios.get(
            `${ORTHANC_BASE_URL}/studies/${anonymizedStudyId}/archive`,
            {
                headers: { 'Authorization': orthancAuth },
                responseType: 'stream',
                timeout: 300000 // 5 minutes
            }
        );

        const filename = `${study.bharatPacsId || study._id}_anonymized.zip`;

        // ✅ FIX: Set CORS and download headers BEFORE streaming
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // ✅ FIX: Set Content-Length if available
        if (archiveResponse.headers['content-length']) {
            res.setHeader('Content-Length', archiveResponse.headers['content-length']);
        }

        // ✅ FIX: Handle stream errors
        archiveResponse.data.on('error', (streamError) => {
            console.error('❌ Stream error:', streamError);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Stream error during download'
                });
            }
        });

        // ✅ FIX: Pipe the stream to response
        archiveResponse.data.pipe(res);

        // ✅ FIX: Cleanup ONLY after stream ends successfully
        archiveResponse.data.on('end', async () => {
            console.log('✅ Stream completed successfully');
            try {
                await axios.delete(
                    `${ORTHANC_BASE_URL}/studies/${anonymizedStudyId}`,
                    { headers: { 'Authorization': orthancAuth } }
                );
                console.log(`🗑️ Cleaned up anonymized study: ${anonymizedStudyId}`);
            } catch (cleanupError) {
                console.warn('⚠️ Cleanup failed:', cleanupError.message);
            }
        });

        // ✅ FIX: Handle response close/abort
        res.on('close', () => {
            if (!res.writableEnded) {
                console.warn('⚠️ Client closed connection before stream completed');
            }
        });

    } catch (error) {
        console.error('❌ Error downloading anonymized study:', error);
        
        // ✅ FIX: Only send JSON error if headers not sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to download anonymized study',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

// ✅ NEW: Proxy series download (stream through backend)
export const downloadSeries = async (req, res) => {
    try {
        const { studyId, seriesId } = req.params;
        const user = req.user;

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('bharatPacsId patientInfo');

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        console.log(`📥 Downloading series ${seriesId} for study ${studyId}`);

        // Get series metadata for filename
        const seriesMetadata = await axios.get(
            `${ORTHANC_BASE_URL}/series/${seriesId}`,
            { headers: { 'Authorization': orthancAuth } }
        );

        const description = seriesMetadata.data.MainDicomTags?.SeriesDescription || 'Series';
        const cleanDesc = description.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${study.bharatPacsId || study._id}_${cleanDesc}.zip`;

        // Stream series archive
        const archiveResponse = await axios.get(
            `${ORTHANC_BASE_URL}/series/${seriesId}/archive`,
            {
                headers: { 'Authorization': orthancAuth },
                responseType: 'stream',
                timeout: 300000
            }
        );

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        archiveResponse.data.pipe(res);

    } catch (error) {
        console.error('❌ Error downloading series:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download series',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ Cleanup anonymized study after download
export const cleanupAnonymizedStudy = async (req, res) => {
    try {
        const { anonymizedStudyId } = req.params;

        await axios.delete(
            `${ORTHANC_BASE_URL}/studies/${anonymizedStudyId}`,
            { headers: { 'Authorization': orthancAuth } }
        );

        console.log(`🗑️ Cleaned up anonymized study: ${anonymizedStudyId}`);

        res.json({
            success: true,
            message: 'Anonymized study cleaned up'
        });

    } catch (error) {
        console.warn('⚠️ Failed to cleanup anonymized study:', error.message);
        res.status(500).json({
            success: false,
            message: 'Cleanup failed (study may already be deleted)'
        });
    }
};

// ✅ Get series list
export const getStudySeries = async (req, res) => {
    try {
        const { studyId } = req.params;
        const user = req.user;

        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('orthancStudyID bharatPacsId patientInfo modality');

        if (!study || !study.orthancStudyID) {
            return res.status(404).json({
                success: false,
                message: 'Study not found or Orthanc ID missing'
            });
        }

        console.log(`📋 Fetching series for study: ${study.orthancStudyID}`);

        const seriesListResponse = await axios.get(
            `${ORTHANC_BASE_URL}/studies/${study.orthancStudyID}`,
            {
                headers: { 'Authorization': orthancAuth },
                timeout: 10000
            }
        );

        const studyData = seriesListResponse.data;
        const seriesIds = studyData.Series || [];

        // Fetch details for each series
        const seriesDetails = await Promise.all(
            seriesIds.map(async (seriesId) => {
                try {
                    const seriesResponse = await axios.get(
                        `${ORTHANC_BASE_URL}/series/${seriesId}`,
                        { headers: { 'Authorization': orthancAuth }, timeout: 5000 }
                    );

                    const seriesData = seriesResponse.data;
                    const description = 
                        seriesData.MainDicomTags?.SeriesDescription || 
                        seriesData.MainDicomTags?.ProtocolName ||
                        `${study.modality} Series ${seriesData.MainDicomTags?.SeriesNumber || 'Unknown'}`;

                    return {
                        ID: seriesId,
                        MainDicomTags: {
                            SeriesDescription: description,
                            Modality: seriesData.MainDicomTags?.Modality || study.modality || 'Unknown',
                            SeriesNumber: seriesData.MainDicomTags?.SeriesNumber || '0',
                            SeriesInstanceUID: seriesData.MainDicomTags?.SeriesInstanceUID || ''
                        },
                        Instances: seriesData.Instances || [],
                        InstanceCount: (seriesData.Instances || []).length,
                        Status: seriesData.Status || 'Unknown',
                        // ✅ Add download URL for frontend
                        downloadUrl: `${ORTHANC_BASE_URL}/series/${seriesId}/archive`,
                        authToken: orthancAuth
                    };
                } catch (err) {
                    console.error(`⚠️ Error fetching series ${seriesId}:`, err.message);
                    return null;
                }
            })
        );

        const validSeries = seriesDetails.filter(s => s !== null);
        console.log(`✅ Found ${validSeries.length} series`);

        res.json({
            success: true,
            data: {
                studyId: study._id,
                bharatPacsId: study.bharatPacsId,
                patientName: study.patientInfo?.patientName || 'Unknown',
                series: validSeries,
                orthancBaseUrl: ORTHANC_BASE_URL,
                authToken: orthancAuth
            }
        });

    } catch (error) {
        console.error('❌ Error getting study series:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get series list',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


export const toggleStudyLock = async (req, res) => {
    try {
        const { studyId } = req.params;
        const { shouldLock } = req.body;
        const user = req.user;

        console.log(`🔐 Lock toggle request - Study: ${studyId}, Lock: ${shouldLock}, User: ${user.email}`);

        if (!['admin', 'assignor'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to lock/unlock studies'
            });
        }

        // ✅ FIX: Use findByIdAndUpdate to avoid validation issues
        const study = await DicomStudy.findOne({
            _id: studyId,
            organizationIdentifier: user.organizationIdentifier
        }).select('bharatPacsId studyLock currentCategory workflowStatus');

        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }

        console.log(`📋 Current study state - Category: ${study.currentCategory}, Status: ${study.workflowStatus}, Locked: ${study.studyLock?.isLocked}`);

        // ✅ BUILD UPDATE OBJECT (NO VALIDATION)
        const updateData = {};
        const actionLogEntry = {
            actionType: shouldLock ? 'study_locked' : 'study_unlocked',
            actionCategory: 'lock',
            performedBy: user._id,
            performedByName: user.fullName || user.email,
            performedByRole: user.role,
            performedAt: new Date(),
            notes: shouldLock ? 'Study locked by administrator' : 'Study unlocked by administrator'
        };

        if (shouldLock) {
            // ✅ LOCK: Set all lock fields
            updateData['studyLock.isLocked'] = true;
            updateData['studyLock.lockedBy'] = user._id;
            updateData['studyLock.lockedByName'] = user.fullName || user.email;
            updateData['studyLock.lockedByRole'] = user.role;
            updateData['studyLock.lockedAt'] = new Date();
            updateData['studyLock.lockReason'] = 'administrative';
            updateData['studyLock.lockExpiry'] = null;
        } else {
            // ✅ UNLOCK: Archive current lock to history
            if (study.studyLock?.isLocked) {
                const previousLock = {
                    lockedBy: study.studyLock.lockedBy,
                    lockedByName: study.studyLock.lockedByName,
                    lockedAt: study.studyLock.lockedAt,
                    unlockedAt: new Date(),
                    lockDuration: study.studyLock.lockedAt 
                        ? Math.floor((new Date() - new Date(study.studyLock.lockedAt)) / 60000) 
                        : 0,
                    lockReason: study.studyLock.lockReason
                };

                // Add to history
                await DicomStudy.updateOne(
                    { _id: studyId },
                    { $push: { 'studyLock.previousLocks': previousLock } }
                );
            }

            // Clear lock fields
            updateData['studyLock.isLocked'] = false;
            updateData['studyLock.lockedBy'] = null;
            updateData['studyLock.lockedByName'] = null;
            updateData['studyLock.lockedAt'] = null;
            updateData['studyLock.lockReason'] = null;
        }

        // ✅ UPDATE DIRECTLY (BYPASS VALIDATION)
        const updatedStudy = await DicomStudy.findByIdAndUpdate(
            studyId,
            {
                $set: updateData,
                $push: { actionLog: actionLogEntry }
            },
            { 
                new: true,
                runValidators: false, // ✅ CRITICAL: Skip validation
                select: 'bharatPacsId studyLock currentCategory'
            }
        );

        console.log(`✅ Study lock toggled: ${shouldLock ? 'LOCKED' : 'UNLOCKED'} for ${updatedStudy.bharatPacsId}`);
        console.log(`📋 New lock state:`, updatedStudy.studyLock);

        res.json({
            success: true,
            message: shouldLock ? 'Study locked successfully' : 'Study unlocked successfully',
            data: {
                bharatPacsId: updatedStudy.bharatPacsId,
                isLocked: updatedStudy.studyLock.isLocked,
                lockedBy: updatedStudy.studyLock.lockedByName,
                lockedAt: updatedStudy.studyLock.lockedAt,
                currentCategory: updatedStudy.currentCategory
            }
        });

    } catch (error) {
        console.error('❌ Error toggling study lock:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle study lock',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};