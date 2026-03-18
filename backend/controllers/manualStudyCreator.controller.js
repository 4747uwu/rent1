import DicomStudy from '../models/dicomStudyModel.js';
import Patient from '../models/patientModel.js';
import Lab from '../models/labModel.js';
import Organization from '../models/organisation.js';
import axios from 'axios';
import FormData from 'form-data';
import { generateUID } from '../utils/dicomUtils.js';
import mongoose from 'mongoose';

const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'http://159.89.165.112:8766';
const ORTHANC_URL = 'http://159.89.165.112:8043';

export const createManualStudy = async (req, res) => {
    try {
        console.log('📋 [Manual Study] Creating manual study...');
        console.log('📋 [Manual Study] Form data:', req.body);
        console.log('📋 [Manual Study] Files:', req.files);

        const {
            patientName,
            patientId,
            patientBirthDate,
            patientSex,
            studyDescription,
            seriesDescription,
            modality,
            bodyPartExamined,
            accessionNumber,
            labId,
            organizationId,
            clinicalHistory,
            referringPhysician,
            urgency,
            uploadMode
        } = req.body;

        // ✅ FIX: Different validation for ZIP vs Images mode
        if (uploadMode === 'zip') {
            // ZIP mode only requires labId
            if (!labId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: labId'
                });
            }

            console.log('📦 [Manual Study] ZIP mode - only lab validation required');

        } else if (uploadMode === 'images') {
            // Images mode requires full patient info
            if (!patientName || !patientId || !labId || !modality) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: patientName, patientId, labId, modality'
                });
            }

            console.log('🖼️ [Manual Study] Images mode - full validation required');
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid uploadMode. Must be "zip" or "images"'
            });
        }

        // Resolve lab: allow either ObjectId or identifier string
        let lab = null;
        if (labId) {
            if (mongoose.Types.ObjectId.isValid(labId)) {
                lab = await Lab.findById(labId).populate('organization');
            }
            if (!lab) {
                lab = await Lab.findOne({ identifier: String(labId).trim().toUpperCase() }).populate('organization');
            }
        }
        if (!lab) {
            return res.status(404).json({
                success: false,
                message: 'Lab not found'
            });
        }

        const organization = await Organization.findById(lab.organization);
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: 'Organization not found'
            });
        }

        // Build full lab location string from address fields
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
        console.log(`🏥 [Manual Study] Lab: ${lab.name}, Organization: ${organization.name}, Location: ${labLocation || 'N/A'}`);

        // ✅ ZIP MODE: Skip patient/study creation, let Python handle everything
        if (uploadMode === 'zip' && req.files && req.files.zipFile) {
            console.log(`📦 [Manual Study] ZIP MODE - Processing...`);

            const zipFile = Array.isArray(req.files.zipFile) ? req.files.zipFile[0] : req.files.zipFile;
            const formData = new FormData();

            // ✅ Send ZIP with organization, lab info, and location
            formData.append('zipFile', zipFile.buffer, {
                filename: zipFile.originalname,
                contentType: zipFile.mimetype
            });

            // Send organization, lab details including location
            formData.append('organization', organization.name);
            formData.append('labName', lab.name);
            formData.append('labIdentifier', lab.identifier);
            formData.append('labLocation', labLocation);

            console.log(`🐍 [Manual Study] Sending to Python server: ${PYTHON_SERVER_URL}/upload-zip-to-orthanc`);
            console.log(`📦 [Manual Study] ZIP file size: ${(zipFile.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`📍 [Manual Study] Lab location for ZIP: ${labLocation || 'N/A'}`);

            try {
                // ✅ Call the new Python endpoint that extracts everything
                const uploadResponse = await axios.post(
                    `${PYTHON_SERVER_URL}/upload-zip-to-orthanc`,
                    formData,
                    {
                        headers: formData.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        timeout: 300000
                    }
                );

                console.log('📥 [Manual Study] Python server response:', JSON.stringify(uploadResponse.data, null, 2));

                if (!uploadResponse.data.success) {
                    throw new Error('ZIP upload failed: ' + uploadResponse.data.message);
                }

                // ✅ Python server handles everything and sends data to /api/dicom/save-extracted-data
                console.log(`✅ [Manual Study] ZIP processed by Python server`);
                console.log(`📊 [Manual Study] Extracted studies: ${uploadResponse.data.extractedData?.totalStudies || 0}`);

                res.status(201).json({
                    success: true,
                    message: uploadResponse.data.message || 'ZIP file uploaded and processed successfully',
                    data: {
                        extractedData: uploadResponse.data.extractedData,
                        totalStudies: uploadResponse.data.extractedData?.totalStudies || 0,
                        totalSeries: uploadResponse.data.extractedData?.totalSeries || 0,
                        totalInstances: uploadResponse.data.extractedData?.totalInstances || 0,
                        uploadedFiles: uploadResponse.data.uploadedFiles?.length || 0,
                        failedFiles: uploadResponse.data.failedFiles?.length || 0,
                        nodejsResponse: uploadResponse.data.nodejsBackendResponse
                    }
                });

                return; // ✅ Exit early since Python handles everything

            } catch (error) {
                console.error('❌ [Manual Study] ZIP upload error:', error.message);
                if (error.response) {
                    console.error('Python server response:', error.response.data);
                }
                throw new Error(`ZIP processing failed: ${error.response?.data?.message || error.message}`);
            }
        }

        // ✅ IMAGES MODE: Continue with normal flow (existing code below)
        if (uploadMode === 'images') {
            // Find or create patient
            let patient = await Patient.findOne({
                mrn: patientId,
                organization: organization._id
            });

            if (!patient) {
                console.log(`👤 [Manual Study] Creating new patient: ${patientName}`);
                patient = new Patient({
                    organization: organization._id,
                    organizationIdentifier: organization.identifier,
                    mrn: patientId,
                    patientID: patientId,
                    patientNameRaw: patientName,
                    firstName: patientName.split(' ')[0],
                    lastName: patientName.split(' ').slice(1).join(' ') || patientName,
                    computed: {
                        fullName: patientName
                    },
                    gender: patientSex || 'O',
                    dateOfBirth: patientBirthDate || null
                });
                await patient.save();
            }

            // Generate UIDs
            const studyInstanceUID = generateUID();
            const seriesInstanceUID = generateUID();
            const finalAccessionNumber = accessionNumber || `ACC${Date.now()}`;

            console.log(`🔑 [Manual Study] Generated UIDs:`, {
                studyInstanceUID,
                seriesInstanceUID,
                accessionNumber: finalAccessionNumber
            });

            // ✅ Prepare metadata for Python server - use lab.name as institution
            const dicomMetadata = {
                patientName: patientName,
                patientId: patientId,
                patientBirthDate: patientBirthDate ? patientBirthDate.replace(/-/g, '') : '',
                patientSex: patientSex || 'O',
                studyInstanceUID: studyInstanceUID,
                seriesInstanceUID: seriesInstanceUID,
                studyDescription: studyDescription || 'Manual Upload Study',
                seriesDescription: seriesDescription || 'Manual Upload Series',
                modality: modality,
                bodyPartExamined: bodyPartExamined || '',
                accessionNumber: finalAccessionNumber,
                referringPhysician: referringPhysician || '',
                institutionName: lab.name  // ✅ Use lab name as institution
            };

            console.log(`🏥 [Manual Study] Using institution name: ${lab.name}`);

            let orthancStudyId = null;
            let filesProcessed = 0;

            // Process images
            if (req.files && req.files.images) {
                const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
                console.log(`📤 [Manual Study] Uploading ${images.length} images to Python server...`);

                const formData = new FormData();

                // Add metadata
                Object.keys(dicomMetadata).forEach(key => {
                    formData.append(key, dicomMetadata[key]);
                });

                // Add image files
                images.forEach(file => {
                    formData.append('images', file.buffer, {
                        filename: file.originalname,
                        contentType: file.mimetype
                    });
                });

                // Convert to DICOM via Python server
                const convertResponse = await axios.post(
                    `${PYTHON_SERVER_URL}/convert-to-dicom`,
                    formData,
                    {
                        headers: formData.getHeaders(),
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity,
                        timeout: 300000
                    }
                );

                if (!convertResponse.data.success) {
                    throw new Error('DICOM conversion failed');
                }

                // 🔍 DEBUG: Log response structure to understand what Python returns
                console.log('📥 [Manual Study] Python response keys:', Object.keys(convertResponse.data));
                console.log('📥 [Manual Study] Python response structure:', JSON.stringify(convertResponse.data, null, 2).slice(0, 500));

                // 🔍 Accept multiple possible response formats
                const convertedFiles = Array.isArray(convertResponse.data.files) ? convertResponse.data.files
                    : Array.isArray(convertResponse.data.convertedFiles) ? convertResponse.data.convertedFiles
                        : Array.isArray(convertResponse.data.dicomFiles) ? convertResponse.data.dicomFiles
                            : [];

                console.log(`📊 [Manual Study] Found ${convertedFiles.length} converted files from Python`);

                // If no files returned, use original images count as fallback
                if (convertedFiles.length === 0) {
                    console.warn('⚠️ [Manual Study] No converted files in response, using original images count');
                    filesProcessed = images.length;
                } else {
                    let uploadedCount = 0;

                    // Upload each DICOM file to Orthanc and count successes
                    for (let i = 0; i < convertedFiles.length; i++) {
                        const dicomFile = convertedFiles[i];

                        // Handle different file structures
                        const base64String = typeof dicomFile === 'string' ? dicomFile
                            : (dicomFile.buffer || dicomFile.content || dicomFile.data || dicomFile.file || '');

                        if (!base64String) {
                            console.warn(`⚠️ [Manual Study] File ${i}: No buffer/data found, skipping`);
                            continue;
                        }

                        try {
                            const dicomBuffer = Buffer.from(base64String, 'base64');

                            const orthancResponse = await axios.post(
                                `${ORTHANC_URL}/instances`,
                                dicomBuffer,
                                {
                                    headers: {
                                        'Content-Type': 'application/dicom'
                                    },
                                    auth: {
                                        username: process.env.ORTHANC_USERNAME || 'alice',
                                        password: process.env.ORTHANC_PASSWORD || 'alicePassword'
                                    }
                                }
                            );

                            if (orthancResponse && orthancResponse.status >= 200 && orthancResponse.status < 300) {
                                uploadedCount++;
                                console.log(`✅ [Manual Study] File ${i + 1}/${convertedFiles.length} uploaded to Orthanc`);

                                if (!orthancStudyId && orthancResponse.data.ParentStudy) {
                                    orthancStudyId = orthancResponse.data.ParentStudy;
                                }
                            }
                        } catch (uploadErr) {
                            console.error(`❌ [Manual Study] File ${i}: Orthanc upload failed:`, uploadErr.message);
                        }
                    }

                    filesProcessed = uploadedCount;
                    console.log(`✅ [Manual Study] Successfully uploaded ${uploadedCount}/${convertedFiles.length} files to Orthanc`);
                }
            }

            console.log(`📊 [Manual Study] Final filesProcessed: ${filesProcessed}`);

            if (!orthancStudyId) {
                orthancStudyId = `MANUAL_${Date.now()}`;
                console.warn('⚠️ [Manual Study] Could not determine Orthanc study ID, using manual ID');
            }

            console.log(`🆔 [Manual Study] Orthanc Study ID: ${orthancStudyId}`);

            // ✅ FIXED: Map urgency to valid uppercase priority enum values
            const priorityMap = {
                'stat': 'STAT',
                'urgent': 'PRIORITY',      // ✅ 'urgent' → 'PRIORITY' (not 'EMERGENCY')
                'emergency': 'EMERGENCY',      // If needed
                'normal': 'NORMAL',
                'routine': 'NORMAL',
            };
            const resolvedPriority = priorityMap[(urgency || '').toLowerCase()] || 'NORMAL';

            // ✅ Create DICOM study record in database with lab name as institution
            const newStudy = new DicomStudy({
                organization: organization._id,
                organizationIdentifier: organization.identifier,
                patient: patient._id,
                patientId: patient._id,
                patientInfo: {
                    patientID: patientId,
                    patientName: patientName,
                    age: req.body.patientAge || '',
                    gender: patientSex || 'O'
                },

                orthancStudyID: orthancStudyId,   // ✅ FIX: was orthancStudyId (lowercase d)

                studyInstanceUID: studyInstanceUID,
                accessionNumber: finalAccessionNumber,

                studyDate: new Date(),
                studyDescription: studyDescription || 'Manual Upload Study',
                examDescription: studyDescription || 'Manual Upload Study',  // ✅ ADDED: Also set examDescription
                modality: modality,
                bodyPartExamined: bodyPartExamined || '',

                sourceLab: lab._id,
                labLocation: labLocation || '',
                institutionName: lab.name,  // ✅ Store lab name as institution

                workflowStatus: 'new_study_received',
                // ✅ FIXED: Use valid uppercase priority
                priority: resolvedPriority,

                // 🔧 Series and instance counts
                seriesCount: 1,
                instanceCount: filesProcessed,
                seriesImages: `1/${filesProcessed}`,

                // ✅ ADDED: modalitiesInStudy for consistency
                modalitiesInStudy: [modality],

                clinicalHistory: {
                    clinicalHistory: clinicalHistory || '',  // ✅ FIXED: Use correct field name
                    symptoms: clinicalHistory || '',         // Keep for backwards compatibility
                    relevantMedicalHistory: '',
                    referringPhysician: referringPhysician || '',
                    indication: '',
                    clinicalContext: []
                },

                referringPhysicianName: referringPhysician || '',  // ✅ ADDED
                physicians: {
                    referring: {
                        name: referringPhysician || '',
                        email: '',
                        mobile: '',
                        institution: ''
                    }
                },

                storageInfo: {
                    orthancAvailable: true,
                    orthancStudyID: orthancStudyId,   // ✅ FIX: uppercase D
                    cloudArchiveAvailable: false
                },

                auditLog: [{
                    action: 'STUDY_UPLOADED',
                    actionType: 'STUDY_UPLOADED',
                    performedBy: req.user._id,
                    userRole: req.user.role,
                    timestamp: new Date(),
                    details: {
                        source: 'manual_upload',
                        uploadMode: uploadMode,
                        filesProcessed: filesProcessed,
                        instancesUploaded: filesProcessed,
                        labName: lab.name,
                        labLocation: labLocation,
                        priority: resolvedPriority  // ✅ Log the mapped priority
                    }
                }],

                createdAt: new Date(),
                updatedAt: new Date()
            });

            await newStudy.save();

            console.log(`✅ [Manual Study] Study created successfully: ${newStudy._id}`);
            console.log(`📍 [Manual Study] Stored lab location: ${labLocation || 'N/A'}`);
            console.log(`🏥 [Manual Study] Stored institution name: ${lab.name}`);
            console.log(`⚡ [Manual Study] Stored priority: ${resolvedPriority} (mapped from urgency: ${urgency})`);

            res.status(201).json({
                success: true,
                message: 'Study created successfully',
                data: {
                    studyId: newStudy._id,
                    orthancStudyId: orthancStudyId,
                    patientName: patientName,
                    accessionNumber: finalAccessionNumber,
                    filesProcessed: filesProcessed,
                    labLocation: labLocation,
                    institutionName: lab.name,
                    study: newStudy
                }
            });
        }

    } catch (error) {
        console.error('❌ [Manual Study] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create manual study',
            error: error.message
        });
    }
};