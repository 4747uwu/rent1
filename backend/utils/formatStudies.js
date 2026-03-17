/**
 * Format raw database studies for frontend consumption
 * Transforms complex database structure to simplified WorklistTable format
 */

const formatPatientInfo = (study) => {
    // Handle different patient info structures from database
    const patientInfo = study.patientInfo || {};
    const patient = study.patient || {};
    
    // Extract age and gender from different possible fields
    let ageGender = 'N/A';
    const age = patientInfo.patientAge || patient.patientAge || study.patientAge;
    const sex = patientInfo.patientSex || patient.patientSex || study.patientSex;
    
    if (age && sex) {
        ageGender = `${age}${sex.charAt(0).toUpperCase()}`;
    } else if (age) {
        ageGender = age.toString();
    }

    return {
        patientID: patientInfo.patientID || patient.patientID || study.patientId || 'N/A',
        patientName: patientInfo.patientName || patient.patientNameRaw || study.patientName || 'Unknown',
        patientAge: age || 'N/A',
        patientSex: sex || 'N/A',
        ageGender: ageGender,
        patientBirthDate: patientInfo.patientBirthDate || patient.patientBirthDate
    };
};

const formatStudyInfo = (study) => {
    return {
        studyDate: study.studyDate,
        studyTime: study.studyTime,
        studyDescription: study.studyDescription || study.examDescription || 'No description',
        modality: study.modality,
        modalitiesInStudy: study.modalitiesInStudy || [],
        numberOfStudyRelatedSeries: study.numberOfStudyRelatedSeries || study.seriesCount || 0,
        numberOfStudyRelatedInstances: study.numberOfStudyRelatedInstances || study.instanceCount || 0,
        accessionNumber: study.accessionNumber || ''
    };
};

// ✅ FIXED: Assignment formatting with proper user data handling
const formatAssignmentInfo = (study, userMap) => {
    if (!study.assignment || !Array.isArray(study.assignment) || study.assignment.length === 0) {
        return {
            isAssigned: false,
            assignedTo: null,
            assignedBy: null,
            assignedAt: null,
            priority: null,
            dueDate: null
        };
    }

    // Find the most recent active assignment
    const activeAssignment = study.assignment
        .filter(assign => assign.status === 'assigned' || assign.status === 'in_progress')
        .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt))[0];

    if (!activeAssignment) {
        return {
            isAssigned: false,
            assignedTo: null,
            assignedBy: null,
            assignedAt: null,
            priority: null,
            dueDate: null
        };
    }

    // ✅ FIX: Get user info from userMap using ObjectId string
    const assignedToUser = userMap.get(activeAssignment.assignedTo?.toString());
    const assignedByUser = userMap.get(activeAssignment.assignedBy?.toString());

    return {
        isAssigned: true,
        assignedTo: assignedToUser ? {
            _id: assignedToUser._id,
            name: assignedToUser.fullName || assignedToUser.firstName + ' ' + assignedToUser.lastName,
            email: assignedToUser.email,
            role: assignedToUser.role
        } : null,
        assignedBy: assignedByUser ? {
            _id: assignedByUser._id,
            name: assignedByUser.fullName || assignedByUser.firstName + ' ' + assignedByUser.lastName,
            email: assignedByUser.email,
            role: assignedByUser.role
        } : null,
        assignedAt: activeAssignment.assignedAt,
        priority: activeAssignment.priority,
        dueDate: activeAssignment.dueDate,
        notes: activeAssignment.notes,
        status: activeAssignment.status
    };
};

const formatReportInfo = (study, userMap) => {
    if (!study.reportInfo) return null;

    const reportedByUser = study.reportInfo.reportedBy ? userMap.get(study.reportInfo.reportedBy.toString()) : null;
    const verifiedByUser = study.reportInfo.verifiedBy ? userMap.get(study.reportInfo.verifiedBy.toString()) : null;
    
    return {
        status: study.reportInfo.status,
        reportedBy: reportedByUser ? `${reportedByUser.firstName} ${reportedByUser.lastName}` : null,
        reportedDate: study.reportInfo.reportedDate,
        verifiedBy: verifiedByUser ? `${verifiedByUser.firstName} ${verifiedByUser.lastName}` : null,
        verifiedDate: study.reportInfo.verifiedDate,
        finalizedDate: study.reportInfo.finalizedDate
    };
};

const formatLabInfo = (study, labMap) => {
    if (!study.sourceLab) return null;
    
    const labInfo = labMap.get(study.sourceLab.toString());
    return labInfo ? {
        labName: labInfo.labName,
        location: labInfo.location
    } : null;
};

/**
 * Format single study for WorklistTable consumption
 * @param {Object} study - Raw study from database
 * @param {Map} userMap - Map of user IDs to user objects
 * @param {Map} labMap - Map of lab IDs to lab objects
 * @returns {Object} Formatted study for frontend
 */
const formatStudyForWorklist = (study, userMap = new Map(), labMap = new Map()) => {
    try {
        const patientInfo = formatPatientInfo(study);
        const studyInfo = formatStudyInfo(study);
        // ✅ FIXED: Assignment info
        const assignmentInfo = formatAssignmentInfo(study, userMap);
        const reportInfo = formatReportInfo(study, userMap);
        const labInfo = formatLabInfo(study, labMap);

        // Determine priority from assignment or study level
        const priority = study.priority || study.studyPriority || 'NORMAL';

        return {
            _id: study._id,
            studyInstanceUID: study.studyInstanceUID || null, // ✅ INCLUDE THIS
            orthancStudyID: study.orthancStudyID || null,
            bharatPacsId: study.bharatPacsId || 'N/A',
            
            // Patient info
            patientName: study.patientInfo?.patientName || study.patient?.patientNameRaw || '-',
            patientId: study.patientInfo?.patientID || study.patient?.patientID || study.patientId || '-',
            patientAge: study.patientInfo?.age || study.patient?.age || study.age || 'N/A',
            patientSex: study.patientInfo?.gender || study.patient?.gender || study.gender || 'N/A',
            ageGender: formatAgeGender(
                study.patientInfo?.age || study.patient?.age || study.age,
                study.patientInfo?.gender || study.patient?.gender || study.gender
            ),
            
            // Center info
            centerName: study.sourceLab?.name || study.sourceLab?.labName || '-',
            
            // Study details
            modality: study.modality || (study.modalitiesInStudy?.[0]) || '-',
            seriesCount: study.seriesCount || 0,
            instanceCount: study.instanceCount || 0,
            seriesImages: study.seriesImages || '0/0',
            accessionNumber: study.accessionNumber || 'N/A',
            studyDescription: study.examDescription || 'Unknown Study',
            
            // Clinical info
            referralNumber: study.referringPhysicianName || 
                           study.physicians?.referring?.name || 
                           study.referralDoctor || 'N/A',
            clinicalHistory: study.clinicalHistory?.clinicalHistory || 
                           study.additionalPatientHistory || 
                           'No history provided',
            
            // Dates
            studyDate: formatDateForDisplay(study.studyDate),
            studyTime: study.studyTime || '-',
            uploadDate: study.createdAt,
            uploadTime: formatDateTimeForDisplay(study.createdAt),
            createdAt: study.createdAt,
            
            // Status
            workflowStatus: study.workflowStatus || 'new_study_received',
            currentCategory: study.currentCategory || 'CREATED',
            caseStatus: formatCaseStatus(study.workflowStatus),
            caseStatusCategory: getCaseStatusCategory(study.workflowStatus),
            caseStatusColor: getCaseStatusColor(study.workflowStatus),
            
            // Priority
            priority: priority,
            
            // ✅ FIXED: Assignment info (flattened for easy access)
            isAssigned: assignmentInfo.isAssigned,
            assignedTo: assignmentInfo.assignedTo?.name || null,
            assignedToEmail: assignmentInfo.assignedTo?.email || null,
            assignedToRole: assignmentInfo.assignedTo?.role || null,
            assignedBy: assignmentInfo.assignedBy?.name || null,
            assignedAt: assignmentInfo.assignedAt,
            assignmentPriority: assignmentInfo.priority,
            dueDate: assignmentInfo.dueDate,
            assignmentStatus: assignmentInfo.status,
            
            // ✅ Keep full assignment object for modal
            assignment: assignmentInfo,

            // ✅ LOCATION/LAB INFO
            location: labInfo?.labName || study.institutionName || 'Unknown',
            
            // ✅ TIMESTAMPS
            createdAt: study.createdAt,
            updatedAt: study.updatedAt,
            
            // ✅ REPORT INFO
            hasReport: !!(study.reportInfo?.reportedBy || study.reportedBy),
            reportedBy: reportInfo?.reportedBy,
            verifiedBy: reportInfo?.verifiedBy,
            reportInfo: study.reportInfo,

            // ✅ ORIGINAL DATA (for debugging)
            originalPatientInfo: {
                patientID: study.patient?.PatientID || study.PatientID,
                patientName: study.patient?.PatientName || study.PatientName,
                patientAge: study.patient?.PatientAge || study.PatientAge,
                patientSex: study.patient?.PatientSex || study.PatientSex,
                ageGender: study.patient?.ageGender || study.ageGender
            },
            originalStudyInfo: {
                studyDate: study.StudyDate || study.studyDate,
                studyTime: study.StudyTime || study.studyTime,
                studyDescription: study.StudyDescription || study.studyDescription,
                modality: study.Modality || study.modality,
                modalitiesInStudy: study.ModalitiesInStudy || study.modalitiesInStudy
            },

            // ✅ TECHNICAL INFO
            accessionNumber: study.AccessionNumber || study.accessionNumber || '',
            studyInstanceUID: study.StudyInstanceUID || study.studyInstanceUID,
            organizationIdentifier: study.organizationIdentifier
        };

    } catch (error) {
        console.error('❌ Error formatting study:', error);
        return study; // Return original if formatting fails
    }
};

/**
 * Format array of studies for WorklistTable consumption
 * @param {Array} studies - Raw studies from database
 * @param {Map} userMap - Map of user IDs to user objects  
 * @param {Map} labMap - Map of lab IDs to lab objects
 * @returns {Array} Formatted studies for frontend
 */
export const formatStudiesForWorklist = (studies) => {
    if (!studies || !Array.isArray(studies)) {
        console.warn('formatStudiesForWorklist: Invalid input, expected array');
        return [];
    }

    return studies.map(study => {
        const patientInfo = formatPatientInfo(study);
        const studyInfo = formatStudyInfo(study);
        // ✅ FIXED: Assignment info
        const assignmentInfo = formatAssignmentInfo(study, userMap);
        const reportInfo = formatReportInfo(study, userMap);
        const labInfo = formatLabInfo(study, labMap);

        // Determine priority from assignment or study level
        const priority = study.priority || study.studyPriority || 'NORMAL';

        const formatted = {
            _id: study._id,
            studyInstanceUID: study.studyInstanceUID || null, // ✅ INCLUDE THIS
            orthancStudyID: study.orthancStudyID || null,
            bharatPacsId: study.bharatPacsId || 'N/A',
            
            // Patient info
            patientName: study.patientInfo?.patientName || study.patient?.patientNameRaw || '-',
            patientId: study.patientInfo?.patientID || study.patient?.patientID || study.patientId || '-',
            patientAge: study.patientInfo?.age || study.patient?.age || study.age || 'N/A',
            patientSex: study.patientInfo?.gender || study.patient?.gender || study.gender || 'N/A',
            ageGender: formatAgeGender(
                study.patientInfo?.age || study.patient?.age || study.age,
                study.patientInfo?.gender || study.patient?.gender || study.gender
            ),
            
            // Center info
            centerName: study.sourceLab?.name || study.sourceLab?.labName || '-',
            
            // Study details
            modality: study.modality || (study.modalitiesInStudy?.[0]) || '-',
            seriesCount: study.seriesCount || 0,
            instanceCount: study.instanceCount || 0,
            seriesImages: study.seriesImages || '0/0',
            accessionNumber: study.accessionNumber || 'N/A',
            studyDescription: study.examDescription || 'Unknown Study',
            
            // Clinical info
            referralNumber: study.referringPhysicianName || 
                           study.physicians?.referring?.name || 
                           study.referralDoctor || 'N/A',
            clinicalHistory: study.clinicalHistory?.clinicalHistory || 
                           study.additionalPatientHistory || 
                           'No history provided',
            
            // Dates
            studyDate: formatDateForDisplay(study.studyDate),
            studyTime: study.studyTime || '-',
            uploadDate: study.createdAt,
            uploadTime: formatDateTimeForDisplay(study.createdAt),
            createdAt: study.createdAt,
            
            // Status
            workflowStatus: study.workflowStatus || 'new_study_received',
            currentCategory: study.currentCategory || 'CREATED',
            caseStatus: formatCaseStatus(study.workflowStatus),
            caseStatusCategory: getCaseStatusCategory(study.workflowStatus),
            caseStatusColor: getCaseStatusColor(study.workflowStatus),
            
            // Priority
            priority: priority,
            
            // ✅ FIXED: Assignment info (flattened for easy access)
            isAssigned: assignmentInfo.isAssigned,
            assignedTo: assignmentInfo.assignedTo?.name || null,
            assignedToEmail: assignmentInfo.assignedTo?.email || null,
            assignedToRole: assignmentInfo.assignedTo?.role || null,
            assignedBy: assignmentInfo.assignedBy?.name || null,
            assignedAt: assignmentInfo.assignedAt,
            assignmentPriority: assignmentInfo.priority,
            dueDate: assignmentInfo.dueDate,
            assignmentStatus: assignmentInfo.status,
            
            // ✅ Keep full assignment object for modal
            assignment: assignmentInfo,

            // ✅ LOCATION/LAB INFO
            location: labInfo?.labName || study.institutionName || 'Unknown',
            
            // ✅ TIMESTAMPS
            createdAt: study.createdAt,
            updatedAt: study.updatedAt,
            
            // ✅ REPORT INFO
            hasReport: !!(study.reportInfo?.reportedBy || study.reportedBy),
            reportedBy: reportInfo?.reportedBy,
            verifiedBy: reportInfo?.verifiedBy,
            reportInfo: study.reportInfo,

            // ✅ ORIGINAL DATA (for debugging)
            originalPatientInfo: {
                patientID: study.patient?.PatientID || study.PatientID,
                patientName: study.patient?.PatientName || study.PatientName,
                patientAge: study.patient?.PatientAge || study.PatientAge,
                patientSex: study.patient?.PatientSex || study.PatientSex,
                ageGender: study.patient?.ageGender || study.ageGender
            },
            originalStudyInfo: {
                studyDate: study.StudyDate || study.studyDate,
                studyTime: study.StudyTime || study.studyTime,
                studyDescription: study.StudyDescription || study.studyDescription,
                modality: study.Modality || study.modality,
                modalitiesInStudy: study.ModalitiesInStudy || study.modalitiesInStudy
            },

            // ✅ TECHNICAL INFO
            accessionNumber: study.AccessionNumber || study.accessionNumber || '',
            studyInstanceUID: study.StudyInstanceUID || study.studyInstanceUID,
            organizationIdentifier: study.organizationIdentifier
        };

        return formatted;
    });
};

/**
 * Alternative method - format studies from API response
 * @param {Object} apiResponse - Response from studies API
 * @param {Map} userMap - Map of user IDs to user objects
 * @param {Map} labMap - Map of lab IDs to lab objects  
 * @returns {Object} Formatted API response with formatted studies
 */
export const formatStudiesApiResponse = (apiResponse, userMap = new Map(), labMap = new Map()) => {
    if (!apiResponse.success || !apiResponse.data) {
        return apiResponse;
    }

    return {
        ...apiResponse,
        data: formatStudiesForWorklist(apiResponse.data, userMap, labMap)
    };
};

export default {
    formatStudiesForWorklist,
    formatStudiesApiResponse
};