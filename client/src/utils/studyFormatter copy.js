// client/src/utils/studyFormatter.js

export const formatStudyForWorklist = (rawStudy) => {
  try {
    // ✅ PATIENT INFO - handle multiple possible sources
    const patientName = rawStudy.patientInfo?.patientName ||
                       rawStudy.patientData?.patientNameRaw || 
                       (rawStudy.patientData?.firstName || '') + ' ' + (rawStudy.patientData?.lastName || '')
                       
    
    const patientId = rawStudy.patientData?.patientID || 
                     rawStudy.patientId || 
                     rawStudy.patientInfo?.patientID ||
                     'N/A';

    // ✅ AGE/GENDER FORMATTING
    const age = rawStudy.patientData?.ageString || 
                rawStudy.patientInfo?.age || 
                'N/A';
    const gender = rawStudy.patientData?.gender || 
                   rawStudy.patientInfo?.gender || 
                   'N/A';
    const ageGender = age !== 'N/A' && gender !== 'N/A' ? 
                     `${age}${gender.charAt(0).toUpperCase()}` : 
                     'N/A';

    // ✅ STUDY INFO
    const studyDescription = rawStudy.studyDescription || 
                            rawStudy.examDescription || 
                            'No Description';
    
    const modality = rawStudy.modalitiesInStudy?.length > 0 ? 
                    rawStudy.modalitiesInStudy.join(', ') : 
                    (rawStudy.modality || 'N/A');

    // ✅ LOCATION
    const location = rawStudy.labData?.name || 
                    rawStudy.labData?.location || 
                    'Unknown Location';

    // ✅ DATES
    const studyDate = rawStudy.studyDate ? 
                     new Date(rawStudy.studyDate).toLocaleDateString('en-US', {
                       month: 'short',
                       day: '2-digit',
                       year: 'numeric'
                     }) : 'N/A';

    const uploadDate = rawStudy.createdAt ? 
                      new Date(rawStudy.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      }) : 'N/A';

    // ✅ FIXED: ASSIGNMENT INFO - handle multiple active assignments
    const assignmentInfo = formatAssignmentInfo(rawStudy.assignment);
    
    // ✅ SERIES/INSTANCES
    const seriesImages = `${rawStudy.seriesCount || 0}/${rawStudy.instanceCount || 0}`;

    return {
      _id: rawStudy._id,
      studyInstanceUID: rawStudy.studyInstanceUID,
      orthancStudyID: rawStudy.orthancStudyID,
      
      // ✅ FORMATTED PATIENT INFO
      patientId,
      patientName: patientName.trim() || 'Unknown Patient',
      patientAge: age,
      patientSex: gender,
      ageGender,
      
      // ✅ FORMATTED STUDY INFO
      studyDescription,
      modality,
      seriesCount: rawStudy.seriesCount || 0,
      instanceCount: rawStudy.instanceCount || 0,
      seriesImages,
      
      // ✅ FORMATTED DATES
      studyDate,
      studyTime: rawStudy.studyTime,
      uploadDate,
      createdAt: rawStudy.createdAt,
      
      // ✅ LOCATION/LAB
      location,
      
      // ✅ WORKFLOW
      workflowStatus: rawStudy.workflowStatus,
      priority: rawStudy.priority || 'NORMAL',
      
      // ✅ ASSIGNMENT INFO - properly formatted for multiple assignments
      isAssigned: assignmentInfo.isAssigned,
      assignedTo: assignmentInfo.assignedToDisplay, // Display string for UI
      assignedToIds: assignmentInfo.assignedToIds, // Array of IDs for modal
      assignedCount: assignmentInfo.assignedCount,
      assignedDoctors: assignmentInfo.assignedDoctors, // Array of doctor objects
      assignedAt: assignmentInfo.latestAssignedAt,
      assignmentPriority: assignmentInfo.priority,
      dueDate: assignmentInfo.latestDueDate,
      assignmentStatus: assignmentInfo.status,
      
      // ✅ FULL ASSIGNMENT DATA for modal
      assignment: assignmentInfo,
      
      // ✅ TECHNICAL
      accessionNumber: rawStudy.accessionNumber || '',
      organizationIdentifier: rawStudy.organizationIdentifier,
      
      // ✅ KEEP RAW DATA for debugging
      _raw: rawStudy
    };
  } catch (error) {
    console.error('Error formatting study:', error);
    return {
      _id: rawStudy._id,
      patientId: 'ERROR',
      patientName: 'Formatting Error',
      _raw: rawStudy
    };
  }
};

// ✅ FIXED: Assignment info formatter to handle multiple active assignments
const formatAssignmentInfo = (assignmentArray) => {
  console.log('🔍 FORMATTING ASSIGNMENTS:', assignmentArray);
  
  if (!assignmentArray || !Array.isArray(assignmentArray) || assignmentArray.length === 0) {
    return {
      isAssigned: false,
      assignedToDisplay: null,
      assignedToIds: [],
      assignedCount: 0,
      assignedDoctors: [],
      latestAssignedAt: null,
      priority: null,
      latestDueDate: null,
      status: null
    };
  }
  
  // ✅ SIMPLE FIX: Get the most recent assignments (last 2-3 entries)
  // Since your backend is adding assignments without clearing old ones,
  // we'll take the most recent unique assignments
  
  // Sort by assignment date (most recent first)
  const sortedAssignments = assignmentArray.sort((a, b) => 
    new Date(b.assignedAt) - new Date(a.assignedAt)
  );
  
  console.log('📋 SORTED ASSIGNMENTS BY DATE:', sortedAssignments.map(a => ({
    assignedTo: a.assignedTo,
    assignedAt: a.assignedAt,
    status: a.status
  })));
  
  // ✅ GET LATEST ASSIGNMENTS (assume cleared assignments are not the current ones)
  // Take the most recent assignment date and get all assignments from that date
  const latestAssignmentDate = sortedAssignments[0]?.assignedAt;
  const latestAssignments = sortedAssignments.filter(a => 
    a.assignedAt === latestAssignmentDate
  );
  
  console.log('📋 LATEST ASSIGNMENTS FROM SAME TIME:', latestAssignments);
  
  if (latestAssignments.length === 0) {
    return {
      isAssigned: false,
      assignedToDisplay: null,
      assignedToIds: [],
      assignedCount: 0,
      assignedDoctors: [],
      latestAssignedAt: null,
      priority: null,
      latestDueDate: null,
      status: null
    };
  }
  
  // ✅ EXTRACT ALL ASSIGNED DOCTOR IDS (remove duplicates)
  const assignedToIds = [...new Set(latestAssignments.map(a => a.assignedTo?.toString()).filter(Boolean))];
  
  // ✅ CREATE DOCTOR OBJECTS with names
  const assignedDoctors = assignedToIds.map(id => {
    const assignment = latestAssignments.find(a => a.assignedTo?.toString() === id);
    return {
      id: id,
      name: assignment?.assignedToName || 'Unknown Doctor',
      email: assignment?.assignedToEmail || null,
      role: assignment?.assignedToRole || assignment?.role || 'radiologist',
      assignedAt: assignment?.assignedAt,
      priority: assignment?.priority,
      dueDate: assignment?.dueDate,
      status: assignment?.status || 'assigned'
    };
  });
  
  // ✅ CREATE DISPLAY STRING
  const assignedToDisplay = assignedDoctors.length === 1 
    ? assignedDoctors[0].name
    : `${assignedDoctors.length} Doctors`; // "2 Doctors" for multiple
  
  // ✅ GET LATEST ASSIGNMENT DATA
  const latestAssignment = latestAssignments[0];
  
  console.log('✅ FORMATTED ASSIGNMENT INFO:', {
    assignedCount: assignedDoctors.length,
    assignedToIds,
    assignedToDisplay,
    doctors: assignedDoctors.map(d => d.name)
  });
  
  return {
    isAssigned: true, // ✅ This should be true when we have assignments
    assignedToDisplay,
    assignedToIds,
    assignedCount: assignedDoctors.length,
    assignedDoctors,
    latestAssignedAt: latestAssignment.assignedAt,
    priority: latestAssignment.priority || 'NORMAL',
    latestDueDate: latestAssignment.dueDate,
    status: 'assigned' // Since we have assignments
  };
};

export const formatStudiesForWorklist = (rawStudies) => {
  if (!Array.isArray(rawStudies)) {
    console.warn('formatStudiesForWorklist: input is not an array');
    return [];
  }
  
  console.log('🔄 FORMATTING STUDIES:', rawStudies.length);
  return rawStudies.map(formatStudyForWorklist);
};