// backend/controllers/dicom.controller.js
import DicomStudy from '../models/dicomStudyModel.js';
import Patient from '../models/patientModel.js';
import Lab from '../models/labModel.js';
import Organization from '../models/organisation.js';

export const saveExtractedDicomData = async (req, res) => {
    try {
        console.log('📦 [DICOM Extraction] Received extracted data from Python server');

        const {
            organization: orgName,
            labName,
            studies,
            totalStudies,
            totalSeries,
            totalInstances,
            uploadedFiles,
            failedFiles
        } = req.body;

        if (!studies || studies.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No study data provided'
            });
        }

        // Find organization by name
        const organization = await Organization.findOne({ name: orgName });
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: `Organization "${orgName}" not found`
            });
        }

        // Find lab by name within the organization
        const lab = await Lab.findOne({ 
            name: labName,
            organization: organization._id 
        });
        
        if (!lab) {
            return res.status(404).json({
                success: false,
                message: `Lab "${labName}" not found in organization "${orgName}"`
            });
        }

        console.log(`🏥 [DICOM Extraction] Organization: ${organization.name}, Lab: ${lab.name}`);

        // ✅ EXTRACT FULL LOCATION FROM LAB DATABASE RECORD (ONCE, outside loop)
        let labLocation = '';
        if (lab.address) {
            const parts = [];
            if (lab.address.street) parts.push(lab.address.street);
            if (lab.address.city) parts.push(lab.address.city);
            if (lab.address.state) parts.push(lab.address.state);
            if (lab.address.zipCode) parts.push(lab.address.zipCode);
            if (lab.address.country) parts.push(lab.address.country);
            labLocation = parts.filter(p => p && p.trim() !== '').join(', ');
        }
        
        console.log(`📍 [DICOM Extraction] Full lab location from DB: ${labLocation || 'N/A'}`);

        const savedStudies = [];
        const errors = [];

        // Process each study
        for (const studyData of studies) {
            try {
                // Extract patient information
                const patientName = studyData.patientName || 'UNKNOWN^PATIENT';
                const patientID = studyData.patientID || 'UNKNOWN';
                const patientSex = studyData.patientSex || 'O';
                const patientBirthDate = studyData.patientBirthDate || '';
                const patientAge = studyData.patientAge || '';

                console.log(`👤 [DICOM Extraction] Processing patient: ${patientName} (${patientID})`);

                // Find or create patient
                let patient = await Patient.findOne({
                    mrn: patientID,
                    organization: organization._id
                });

                if (!patient) {
                    console.log(`✨ [DICOM Extraction] Creating new patient: ${patientName}`);
                    
                    const nameParts = patientName.split('^');
                    const lastName = nameParts[0] || patientName;
                    const firstName = nameParts[1] || '';

                    patient = new Patient({
                        organization: organization._id,
                        organizationIdentifier: organization.identifier,
                        mrn: patientID,
                        patientID: patientID,
                        patientNameRaw: patientName,
                        firstName: firstName,
                        lastName: lastName,
                        computed: {
                            fullName: `${firstName} ${lastName}`.trim() || patientName
                        },
                        gender: patientSex,
                        dateOfBirth: patientBirthDate ? parseDate(patientBirthDate) : null
                    });
                    
                    await patient.save();
                    console.log(`✅ [DICOM Extraction] Patient created: ${patient._id}`);
                }

                // Extract study information
                const studyInstanceUID = studyData.studyInstanceUID;
                const accessionNumber = studyData.accessionNumber || `ACC${Date.now()}`;
                const studyDescription = studyData.studyDescription || 'ZIP Upload Study';
                const studyDate = studyData.studyDate ? parseDate(studyData.studyDate) : new Date();
                const referringPhysician = studyData.referringPhysician || '';
                
                // ✅ USE LAB NAME as institution/center name (not DICOM tag)
                const institutionName = lab.name;

                console.log(`📋 [DICOM Extraction] Study: ${studyInstanceUID}`);
                console.log(`🏥 [DICOM Extraction] Using lab name as institution: ${institutionName}`);

                // Check if study already exists
                const existingStudy = await DicomStudy.findOne({
                    studyInstanceUID: studyInstanceUID,
                    organization: organization._id
                });

                if (existingStudy) {
                    console.log(`⚠️ [DICOM Extraction] Study already exists: ${existingStudy._id}`);
                    savedStudies.push({
                        studyId: existingStudy._id,
                        studyInstanceUID: studyInstanceUID,
                        status: 'already_exists'
                    });
                    continue;
                }

                // Determine modality and body part from series or study level
                let primaryModality = studyData.modality || 'OT';
                let bodyPart = studyData.bodyPartExamined || '';

                if (studyData.seriesDetails && studyData.seriesDetails.length > 0) {
                    primaryModality = studyData.seriesDetails[0].modality || primaryModality;
                    bodyPart = studyData.seriesDetails[0].bodyPartExamined || bodyPart;
                }

                // Get Orthanc study ID from uploaded files
                let orthancStudyId = studyData.orthancStudyID;
                if (!orthancStudyId) {
                    orthancStudyId = `MANUAL_${Date.now()}_${studyInstanceUID.slice(-8)}`;
                }

                // Parse study date and time
                const studyTime = studyData.studyTime || '';

                // Extract series and instance counts
                const seriesCount = studyData.seriesCount || 0;
                const instanceCount = studyData.instanceCount || 0;

                // Build modalitiesInStudy array
                const modalitiesInStudy = [];
                if (primaryModality) {
                    modalitiesInStudy.push(primaryModality);
                }

                // Create DICOM study record
                const newStudy = new DicomStudy({
                    organization: organization._id,
                    organizationIdentifier: organization.identifier,
                    patient: patient._id,
                    patientId: patient._id,
                    
                    patientInfo: {
                        patientID: patientID,
                        patientName: patientName,
                        age: patientAge,
                        gender: patientSex
                    },
                    
                    orthancStudyID: orthancStudyId,   // ✅ FIX: was orthancStudyId (lowercase d)
                    
                    studyInstanceUID: studyInstanceUID,
                    accessionNumber: accessionNumber,
                    
                    studyDate: studyDate,
                    studyTime: studyTime,
                    studyDescription: studyDescription,
                    examDescription: studyDescription,
                    modality: primaryModality,
                    modalitiesInStudy: modalitiesInStudy,
                    bodyPart: bodyPart,
                    bodyPartExamined: bodyPart,
                    
                    sourceLab: lab._id,
                    labLocation: labLocation,  // ✅ Full location from lab DB
                    institutionName: institutionName,  // ✅ Lab name as institution
                    
                    workflowStatus: 'new_study_received',
                    priority: 'NORMAL',
                    
                    // Series and instance counts at root level
                    seriesCount: seriesCount,
                    instanceCount: instanceCount,
                    seriesImages: `${seriesCount}/${instanceCount}`,
                    
                    clinicalHistory: {
                        symptoms: '',
                        relevantMedicalHistory: '',
                        referringPhysician: referringPhysician,
                        indication: '',
                        clinicalContext: []
                    },
                    
                    referringPhysicianName: referringPhysician,
                    physicians: {
                        referring: {
                            name: referringPhysician,
                            email: '',
                            mobile: '',
                            institution: institutionName  // ✅ Lab name
                        },
                        requesting: {
                            name: '',
                            email: '',
                            mobile: '',
                            institution: ''
                        }
                    },
                    
                    technologist: {
                        name: '',
                        mobile: '',
                        comments: '',
                        reasonToSend: ''
                    },
                    
                    studyPriority: 'SELECT',
                    caseType: 'routine',
                    
                    equipment: {
                        manufacturer: studyData.manufacturer || '',
                        model: studyData.manufacturerModel || '',
                        stationName: studyData.stationName || '',
                        softwareVersion: ''
                    },
                    
                    storageInfo: {
                        orthancAvailable: true,
                        orthancStudyID: orthancStudyId,   // ✅ FIX: uppercase D
                        cloudArchiveAvailable: false,
                        type: 'orthanc',
                        studyInstanceUID: studyInstanceUID,
                        receivedAt: new Date(),
                        isStableStudy: false,
                        instancesFound: instanceCount,
                        processingMethod: 'python_zip_upload'
                    },
                    
                    metadata: {
                        manufacturer: studyData.manufacturer || '',
                        manufacturerModel: studyData.manufacturerModel || '',
                        institutionName: institutionName,  // ✅ Lab name
                        stationName: studyData.stationName || '',
                        seriesCount: seriesCount,
                        instanceCount: instanceCount
                    },
                    
                    customLabInfo: {
                        organizationId: organization._id,
                        organizationIdentifier: organization.identifier,
                        organizationName: organization.name,
                        labId: lab._id,
                        labIdentifier: lab.identifier,
                        labName: lab.name,
                        labIdSource: 'frontend_selection',
                        orgIdSource: 'frontend_selection',
                        detectionMethod: 'manual_zip_upload'
                    },
                    
                    auditLog: [{
                        action: 'STUDY_UPLOADED',
                        actionType: 'STUDY_UPLOADED',
                        performedBy: null,
                        userRole: 'system',
                        timestamp: new Date(),
                        details: {
                            source: 'zip_upload',
                            extractedFromDicom: true,
                            totalSeries: seriesCount,
                            totalInstances: instanceCount,
                            labName: labName,
                            organization: orgName,
                            institutionName: institutionName,  // ✅ Lab name logged
                            labLocation: labLocation
                        }
                    }],
                    
                    statusHistory: [{
                        status: 'new_study_received',
                        changedAt: new Date(),
                        note: `Study created via ZIP upload: ${seriesCount} series, ${instanceCount} instances. Institution: ${institutionName}, Location: ${labLocation}`
                    }],
                    
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                await newStudy.save();

                console.log(`✅ [DICOM Extraction] Study saved: ${newStudy._id}`);
                console.log(`✅ [DICOM Extraction] Center Name: ${institutionName}`);
                console.log(`✅ [DICOM Extraction] Lab Location: ${labLocation}`);

                savedStudies.push({
                    studyId: newStudy._id,
                    studyInstanceUID: studyInstanceUID,
                    patientName: patientName,
                    accessionNumber: accessionNumber,
                    status: 'created'
                });

            } catch (error) {
                console.error(`❌ [DICOM Extraction] Error processing study:`, error);
                errors.push({
                    studyInstanceUID: studyData.studyInstanceUID,
                    error: error.message
                });
            }
        }

        console.log(`✅ [DICOM Extraction] Complete: ${savedStudies.length}/${studies.length} studies saved`);

        res.status(201).json({
            success: true,
            message: `Processed ${studies.length} studies, saved ${savedStudies.length}`,
            data: {
                savedStudies: savedStudies,
                totalProcessed: studies.length,
                totalSaved: savedStudies.length,
                errors: errors,
                summary: {
                    organization: orgName,
                    lab: labName,
                    totalStudies: studies.length,
                    totalSaved: savedStudies.length,
                    totalFailed: errors.length,
                    totalInstances: totalInstances || savedStudies.reduce((sum, s) => sum + (s.instanceCount || 0), 0)
                }
            }
        });

    } catch (error) {
        console.error('❌ [DICOM Extraction] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save extracted DICOM data',
            error: error.message
        });
    }
};

// Helper function to parse DICOM date format (YYYYMMDD) to Date object
function parseDate(dicomDate) {
    if (!dicomDate || dicomDate.length < 8) return null;
    
    const year = dicomDate.substring(0, 4);
    const month = dicomDate.substring(4, 6);
    const day = dicomDate.substring(6, 8);
    
    return new Date(`${year}-${month}-${day}`);
}