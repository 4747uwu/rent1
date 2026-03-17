import mongoose from 'mongoose';
import DicomStudy from '../models/dicomStudyModel.js';

// ✅ GET STUDY REPORTING INFO - For OnlineReportingSystem
export const getStudyReportingInfo = async (req, res) => {
    try {
        const { studyId } = req.params;
        
        console.log('🔍 Getting comprehensive study info for reporting:', studyId);
        
        // Find study with all necessary populated data
        const study = await DicomStudy.findById(studyId)
            .populate('patient', 'patientID patientNameRaw firstName lastName age gender dateOfBirth clinicalInfo medicalHistory')
            .populate('sourceLab', 'name identifier')
            .populate({
                path: 'lastAssignedDoctor',
                populate: {
                    path: 'userAccount',
                    select: 'fullName email'
                }
            })
            .select(`
                _id orthancStudyID studyInstanceUID accessionNumber workflowStatus 
                modality modalitiesInStudy studyDescription examDescription 
                seriesCount instanceCount studyDate studyTime createdAt 
                patientId preProcessedDownload clinicalHistory referringPhysician 
                referringPhysicianName caseType assignment priority
            `)
            .lean();
        
        if (!study) {
            console.log('❌ Study not found:', studyId);
            return res.status(404).json({
                success: false,
                message: 'Study not found'
            });
        }
        
        console.log('📊 Found study with patient ObjectId:', study.patient?._id, '(patientId:', study.patientId + ')');
        
        // Extract patient information with multiple fallbacks
        const patient = study.patient || {};
        const patientName = patient.patientNameRaw || 
                           `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 
                           'Unknown Patient';
        
        // Extract clinical history from multiple possible locations
        const clinicalHistory = study.clinicalHistory || 
                              patient.clinicalInfo?.clinicalHistory || 
                              patient.medicalHistory?.clinicalHistory || 
                              'No clinical history available';
        
        // Extract study identifiers
        const orthancStudyID = study.orthancStudyID;
        const studyInstanceUID = study.studyInstanceUID;
        
        console.log('🔍 Extracted study identifiers:', {
            orthancStudyID,
            studyInstanceUID,
            originalStudyId: study._id
        });
        
        // Check R2 download availability
        const preProcessedDownload = study.preProcessedDownload || {};
        const hasR2CDN = preProcessedDownload.zipStatus === 'completed' && !!preProcessedDownload.zipUrl;
        const r2SizeMB = preProcessedDownload.zipSizeMB || 0;
        
        console.log('🌐 R2 CDN availability:', {
            hasR2Zip: hasR2CDN,
            zipStatus: preProcessedDownload.zipStatus || 'pending',
            downloadOptions: preProcessedDownload
        });
        
        // Prepare download options
        const downloadOptions = {
            hasR2CDN: hasR2CDN,
            hasWasabiZip: hasR2CDN, // Legacy compatibility
            hasR2Zip: hasR2CDN,
            r2SizeMB: r2SizeMB,
            wasabiSizeMB: r2SizeMB, // Legacy compatibility
            zipStatus: preProcessedDownload.zipStatus || 'not_started',
            zipCreatedAt: preProcessedDownload.zipCreatedAt,
            zipExpiresAt: preProcessedDownload.zipExpiresAt,
            downloadCount: preProcessedDownload.downloadCount || 0,
            lastDownloaded: preProcessedDownload.lastDownloaded,
            endpoints: {
                r2CDN: `/api/download/study/${orthancStudyID}/r2-direct`,
                preProcessed: `/api/download/study/${orthancStudyID}/pre-processed`,
                orthancDirect: `/api/orthanc-download/study/${orthancStudyID}/download`,
                createZip: `/api/download/study/${orthancStudyID}/create`
            }
        };
        
        // Format study information
        const studyInfo = {
            _id: study._id,
            orthancStudyID: orthancStudyID,
            studyInstanceUID: studyInstanceUID,
            accessionNumber: study.accessionNumber || 'N/A',
            workflowStatus: study.workflowStatus || 'pending_assignment',
            modality: study.modalitiesInStudy?.length > 0 ? 
                     study.modalitiesInStudy.join(', ') : (study.modality || 'N/A'),
            description: study.studyDescription || study.examDescription || 'N/A',
            studyDate: study.studyDate,
            studyTime: study.studyTime,
            createdAt: study.createdAt,
            seriesCount: study.seriesCount || 0,
            instanceCount: study.instanceCount || 0,
            priority: study.assignment?.priority || study.priority || 'NORMAL',
            caseType: study.caseType || 'routine',
            sourceLab: study.sourceLab?.name || 'N/A',
            assignedDoctor: study.lastAssignedDoctor?.userAccount?.fullName || 'Not Assigned',
            referringPhysician: study.referringPhysician || study.referringPhysicianName || 'N/A'
        };
        
        // Format patient information
        const patientInfo = {
            patientId: study.patientId || patient.patientID || 'N/A',
            patientName: patientName,
            fullName: patientName,
            age: patient.age || 'N/A',
            gender: patient.gender || 'N/A',
            dateOfBirth: patient.dateOfBirth || 'N/A',
            clinicalHistory: clinicalHistory
        };
        
        const response = {
            success: true,
            data: {
                studyInfo,
                patientInfo,
                downloadOptions,
                clinicalHistory: clinicalHistory,
                // Additional metadata for frontend
                metadata: {
                    hasR2Download: hasR2CDN,
                    downloadReady: hasR2CDN,
                    storageProvider: 'cloudflare-r2',
                    lastUpdated: new Date()
                }
            }
        };
        
        console.log('✅ Sending comprehensive study info response:', {
            studyId: studyInfo._id,
            patientName: patientInfo.patientName,
            hasR2CDN: downloadOptions.hasR2CDN,
            endpoints: Object.keys(downloadOptions.endpoints)
        });
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Error getting study info for reporting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get study information for reporting',
            error: error.message
        });
    }
};

export default {
    getStudyReportingInfo
};