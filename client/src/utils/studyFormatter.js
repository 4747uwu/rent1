// client/src/utils/studyFormatter.js

export const formatStudyForWorklist = (rawStudy) => {
  try {
    // ✅ BHARAT PACS ID - UPPERCASE
    const bharatPacsId = (rawStudy.bharatPacsId || 'N/A').toUpperCase();

    // ✅ ORGANIZATION INFO - UPPERCASE
    const organizationName = (rawStudy.organization?.name || 
                            rawStudy.organizationIdentifier || 
                            'Unknown Organization').toUpperCase();

    // ✅ CENTER/LAB INFO - BOLD & UPPERCASE (styling will be done in component)
    const centerName = (rawStudy.sourceLab?.name || 
                      rawStudy.sourceLab?.labName || 
                      rawStudy.sourceLab?.location || 
                      'Unknown Center').toUpperCase();

    const location = (rawStudy?.labLocation || '-').toUpperCase();

    // ✅ PATIENT INFO - UPPERCASE
    const patientName = (rawStudy.patientInfo?.patientName ||
                       rawStudy.patient?.patientNameRaw || 
                       (rawStudy.patient?.firstName || '') + ' ' + (rawStudy.patient?.lastName || '') ||
                       'Unknown Patient').toUpperCase();
    
    const patientId = (rawStudy.patient?.patientID || 
                     rawStudy.patientId || 
                     rawStudy.patientInfo?.patientID ||
                     'N/A').toUpperCase();

    // ✅ AGE/GENDER FORMATTING - UPPERCASE
    const age = rawStudy.patient?.age || 
                rawStudy.patientInfo?.age || 
                'N/A';
    const gender = rawStudy.patient?.gender || 
                   rawStudy.patientInfo?.gender || 
                   'N/A';
    const ageGender = age !== 'N/A' && gender !== 'N/A' ? 
                     `${age}${gender.charAt(0).toUpperCase()}` : 
                     'N/A';

    // ✅ MODALITY - UPPERCASE
    const modality = rawStudy.modalitiesInStudy?.length > 0 ? 
                    rawStudy.modalitiesInStudy.join(', ').toUpperCase() : 
                    (rawStudy.modality || 'N/A').toUpperCase();
    
    const notesCount = rawStudy.notesCount || 0;

    // ✅ SERIES COUNT
    const seriesCount = rawStudy.seriesCount || 0;
    const seriesImages = `${rawStudy.seriesCount || 0}/${rawStudy.instanceCount || 0}`;

    // ✅ ACCESSION NUMBER - UPPERCASE
    const accessionNumber = (rawStudy.accessionNumber || 'N/A').toUpperCase();

    // ✅ REFERRAL NUMBER - UPPERCASE
    const referralNumber = (rawStudy?.referringPhysicianName || 'N/A').toUpperCase();

    // ✅ CLINICAL HISTORY - BOLD & UPPERCASE (styling will be done in component)
    const clinicalHistory = (rawStudy.clinicalHistory?.clinicalHistory || 
                           '').toUpperCase();

    // ✅ STUDY TIME - UPPERCASE
    const studyTime = (rawStudy.studyTime || 'N/A').toUpperCase();
    const studyDate = rawStudy.studyDate ? 
                     new Date(rawStudy.studyDate).toLocaleDateString('en-US', {
                       month: 'short',
                       day: '2-digit',
                       year: 'numeric'
                     }).toUpperCase() : 'N/A';

    // ✅ UPLOAD TIME - UPPERCASE
    const uploadTime = rawStudy.createdAt ? 
                      new Date(rawStudy.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      }).toUpperCase() : 'N/A';

    // ✅ RADIOLOGIST INFO - UPPERCASE
    const getRadiologistInfo = (study) => {
      // Method 1: From category tracking (most recent)
      if (study.categoryTracking?.assigned?.assignedTo) {
        const assignee = study.categoryTracking.assigned.assignedTo;
        return {
          radiologistName: (assignee.fullName || `${assignee.firstName} ${assignee.lastName}`).toUpperCase(),
          radiologistEmail: assignee.email,
          radiologistRole: assignee.role
        };
      }

      // Method 2: From assignment array (latest)
      if (study.assignment?.length > 0) {
        const latestAssignment = study.assignment
          .filter(a => a.assignedTo)
          .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt))[0];
        
        if (latestAssignment?.assignedTo) {
          const assignee = latestAssignment.assignedTo;
          if (typeof assignee === 'object') {
            return {
              radiologistName: (assignee.fullName || `${assignee.firstName} ${assignee.lastName}`).toUpperCase(),
              radiologistEmail: assignee.email,
              radiologistRole: assignee.role
            };
          }
        }
      }

      // Method 3: From current report status
      if (study.currentReportStatus?.lastReportedBy) {
        const reporter = study.currentReportStatus.lastReportedBy;
        return {
          radiologistName: (reporter.fullName || `${reporter.firstName} ${reporter.lastName}`).toUpperCase(),
          radiologistEmail: reporter.email,
          radiologistRole: reporter.role
        };
      }

      return {
        radiologistName: 'UNASSIGNED',
        radiologistEmail: null,
        radiologistRole: null
      };
    };

    const radiologistInfo = getRadiologistInfo(rawStudy);

    // ✅ CASE STATUS - UPPERCASE
    const getCaseStatus = (study) => {
      // Priority cases
      if (study.studyPriority === 'Emergency Case' || 
          study.caseType === 'emergency' ||
          study.currentCategory === 'URGENT') {
        return {
          status: 'URGENT',
          category: study.currentCategory || 'URGENT',
          workflowStatus: study.workflowStatus,
          color: 'red'
        };
      }

      // Check current category
      const categoryMap = {
        'CREATED': { label: 'STUDY CREATED', color: 'blue' },
        'HISTORY_CREATED': { label: 'HISTORY ADDED', color: 'cyan' },
        'UNASSIGNED': { label: 'PENDING ASSIGNMENT', color: 'orange' },
        'ASSIGNED': { label: 'ASSIGNED', color: 'purple' },
        'PENDING': { label: 'IN PROGRESS', color: 'yellow' },
        'DRAFT': { label: 'DRAFT REPORT', color: 'amber' },
        'VERIFICATION_PENDING': { label: 'VERIFICATION PENDING', color: 'indigo' },
        'FINAL': { label: 'FINALIZED', color: 'green' },
        'REPRINT_NEED': { label: 'REPRINT REQUIRED', color: 'red' }
      };

      const categoryInfo = categoryMap[study.currentCategory] || categoryMap['CREATED'];

      return {
        status: categoryInfo.label,
        category: study.currentCategory,
        workflowStatus: study.workflowStatus,
        color: categoryInfo.color
      };
    };

    const caseStatus = getCaseStatus(rawStudy);

    const revertInfo = rawStudy.revertInfo
      ? {
          isReverted:    rawStudy.revertInfo.isReverted    || false,
          revertCount:   rawStudy.revertInfo.revertCount   || 0,
          revertHistory: (rawStudy.revertInfo.revertHistory || []).map(r => ({
            _id:            r._id,
            revertedAt:     r.revertedAt     || null,
            revertedBy:     r.revertedBy     || null,
            revertedByName: r.revertedByName || 'Unknown',
            revertedByRole: r.revertedByRole || '',
            previousStatus: r.previousStatus || '',
            reason:         r.reason         || '',
            notes:          r.notes          || '',
            resolved:       r.resolved       || false,
          })),
          currentRevert: rawStudy.revertInfo.currentRevert
            ? {
                revertedAt:     rawStudy.revertInfo.currentRevert.revertedAt     || null,
                revertedByName: rawStudy.revertInfo.currentRevert.revertedByName || 'Unknown',
                revertedByRole: rawStudy.revertInfo.currentRevert.revertedByRole || '',
                previousStatus: rawStudy.revertInfo.currentRevert.previousStatus || '',
                reason:         rawStudy.revertInfo.currentRevert.reason         || '',
                notes:          rawStudy.revertInfo.currentRevert.notes          || '',
                resolved:       rawStudy.revertInfo.currentRevert.resolved       || false,
              }
            : null,
        }
      : {
          isReverted:    false,
          revertCount:   0,
          revertHistory: [],
          currentRevert: null,
        };

    // ✅ STUDY LOCK INFO - UPPERCASE
    const isLocked = rawStudy.studyLock?.isLocked || false;
    const lockedBy = rawStudy.studyLock?.lockedByName?.toUpperCase() || null;
    const lockedAt = rawStudy.studyLock?.lockedAt || null;

    // ✅ HAS NOTES / ATTACHMENTS FLAGS
    const hasStudyNotes = rawStudy.hasStudyNotes === true || (rawStudy.discussions && rawStudy.discussions.length > 0);
    const attachments = rawStudy.attachments || [];
    const hasAttachments = rawStudy.hasAttachments === true || attachments.length > 0;

    // ✅ ASSIGNMENT INFO - UPPERCASE
    const assignmentInfo = formatAssignmentInfo(rawStudy.assignment);

    // ✅ VERIFICATION INFO - UPPERCASE
    const verificationInfo = getVerificationInfo(rawStudy);
    const verificationNotes = (rawStudy.reportInfo?.verificationInfo?.rejectionReason || '-').toUpperCase();

    // ✅ PRINT HISTORY
    const printCount = rawStudy.printHistory?.length || 0;
    const lastPrint = rawStudy.printHistory?.length > 0
        ? [...rawStudy.printHistory].sort((a, b) => new Date(b.printedAt) - new Date(a.printedAt))[0]
        : null;

    // ✅ NEW: Last download tracking
    const lastDownload = rawStudy.lastDownload
        ? {
            downloadedAt:   rawStudy.lastDownload.downloadedAt   || null,
            downloadedByName: rawStudy.lastDownload.downloadedByName || 'Unknown',
            downloadType:   rawStudy.lastDownload.downloadType   || null,  // 'pdf' | 'docx' | 'print'
            reportId:       rawStudy.lastDownload.reportId       || null,
          }
        : null;

    // ✅ NEW: Follow-up info — pass through as-is from DB
    const followUp = rawStudy.followUp
      ? {
          isFollowUp:     rawStudy.followUp.isFollowUp    || false,
          markedAt:       rawStudy.followUp.markedAt       || null,
          markedBy:       rawStudy.followUp.markedBy       || null,
          markedByName:   rawStudy.followUp.markedByName   || null,
          reason:         rawStudy.followUp.reason         || '',
          followUpDate:   rawStudy.followUp.followUpDate   || null,
          resolvedAt:     rawStudy.followUp.resolvedAt     || null,
          resolvedBy:     rawStudy.followUp.resolvedBy     || null,
          history:        rawStudy.followUp.history        || [],
        }
      : {
          isFollowUp:   false,
          markedAt:     null,
          markedBy:     null,
          markedByName: null,
          reason:       '',
          followUpDate: null,
          resolvedAt:   null,
          resolvedBy:   null,
          history:      [],
        };

    return {
      _id: rawStudy._id,
      studyInstanceUID: rawStudy.studyInstanceUID,
      orthancStudyID: rawStudy.orthancStudyID,
      
      // ✅ ALL UPPERCASE FIELDS
      bharatPacsId,
      organizationName,
      centerName, // Will be styled bold in component
      location,
      
      // ✅ PATIENT INFO - UPPERCASE
      patientId,
      patientName,
      patientAge: age,
      patientSex: gender,
      ageGender,
      notesCount,
      
      // ✅ STUDY INFO - UPPERCASE
      modality,
      seriesCount,
      instanceCount: rawStudy.instanceCount || 0,
      seriesImages,
      accessionNumber,
      referralNumber,
      clinicalHistory, // Will be styled bold in component
      studyDescription: (rawStudy.studyDescription || rawStudy.examDescription || 'NO DESCRIPTION').toUpperCase(),

      //revertinfo

      revertInfo,
      
      // ✅ DATES & TIMES - UPPERCASE
      studyDate,
      studyTime,
      uploadTime,
      uploadDate: rawStudy.createdAt,
      createdAt: rawStudy.createdAt,
      
      // ✅ RADIOLOGIST INFO - UPPERCASE
      radiologist: radiologistInfo.radiologistName,
      radiologistEmail: radiologistInfo.radiologistEmail,
      radiologistRole: radiologistInfo.radiologistRole,
      
      // ✅ CASE STATUS - UPPERCASE
      caseStatus: caseStatus.status,
      caseStatusCategory: caseStatus.category,
      caseStatusColor: caseStatus.color,
      workflowStatus: caseStatus.workflowStatus,
      
      // ✅ STUDY LOCK - UPPERCASE
      isLocked,
      lockedBy,
      lockedAt,
      
      // ✅ NOTES / ATTACHMENTS FLAGS
      hasStudyNotes,
      hasAttachments,
            // priority: rawStudy.priority || 'NORMAL',

       priority: rawStudy.priority || assignmentInfo.priority,  // ✅ ADD THIS
  // assignmentPriority: assignmentInfo.priority,   
      
      // ✅ ASSIGNMENT INFO - UPPERCASE
      isAssigned: assignmentInfo.isAssigned,
      assignedTo: assignmentInfo.assignedToDisplay,
      assignedToIds: assignmentInfo.assignedToIds,
      assignedCount: assignmentInfo.assignedCount,
      assignedDoctors: assignmentInfo.assignedDoctors,
      assignedAt: assignmentInfo.latestAssignedAt,
      assignmentPriority: assignmentInfo.priority,
      dueDate: assignmentInfo.latestDueDate,
      
      // ✅ VERIFICATION - UPPERCASE
      verificationStatus: verificationInfo.verificationStatus,
      verifiedBy: verificationInfo.verifiedBy,
      verifiedAt: verificationInfo.verifiedAt,
      verificationNotes,
      
      
      // ✅ PRINT INFO
      printCount,
      lastPrintedAt:   lastPrint?.printedAt,
      lastPrintedBy:   lastPrint?.printedByName?.toUpperCase(),
      lastPrintType:   lastPrint?.printType,
      lastPrintMethod: lastPrint?.printMethod,

      //statusHistory
            statusHistory: rawStudy.statusHistory || [], // ✅ ADD THIS

      
      // ✅ NEW: Follow-up data
      followUp,
      lastDownload,
      
      // ✅ CATEGORY TRACKING
      categoryTracking: {
        currentCategory: rawStudy.currentCategory,
        created: rawStudy.categoryTracking?.created,
        historyCreated: rawStudy.categoryTracking?.historyCreated,
        assigned: rawStudy.categoryTracking?.assigned,
        final: rawStudy.categoryTracking?.final,
        urgent: rawStudy.categoryTracking?.urgent,
        reprint: rawStudy.categoryTracking?.reprint
      },
      
      // ✅ KEEP RAW DATA for debugging
      _raw: rawStudy,
      _verificationInfo: verificationInfo,
      _radiologistInfo: radiologistInfo,
      _assignmentInfo: assignmentInfo,
      attachments: attachments,
      hasAttachments: hasAttachments
    };
  } catch (error) {
    console.error('Error formatting study:', error);
    return {
      _id: rawStudy._id,
      bharatPacsId: 'ERROR',
      patientId: 'ERROR',
      patientName: 'FORMATTING ERROR',
      _raw: rawStudy
    };
  }
};

// ✅ VERIFICATION INFO EXTRACTOR - UPPERCASE
const getVerificationInfo = (study) => {
  const verificationInfo = study.reportInfo?.verificationInfo;
  
  if (!verificationInfo) {
    return {
      verifiedBy: null,
      verifiedByEmail: null,
      verifiedByRole: null,
      verifiedAt: null,
      verificationStatus: 'PENDING',
      verificationNotes: null
    };
  }
  
  let verifiedBy = null;
  let verifiedByEmail = null;
  let verifiedByRole = null;
  
  if (verificationInfo.verifiedBy) {
    if (typeof verificationInfo.verifiedBy === 'object') {
      verifiedBy = (verificationInfo.verifiedBy.fullName || 
                  `${verificationInfo.verifiedBy.firstName} ${verificationInfo.verifiedBy.lastName}`).toUpperCase();
      verifiedByEmail = verificationInfo.verifiedBy.email;
      verifiedByRole = verificationInfo.verifiedBy.role;
    } else {
      verifiedBy = `USER ${verificationInfo.verifiedBy.toString().substring(0, 8).toUpperCase()}...`;
      verifiedByRole = 'VERIFIER';
    }
  }
  
  return {
    verifiedBy,
    verifiedByEmail,
    verifiedByRole,
    verifiedAt: verificationInfo.verifiedAt,
    verificationStatus: (verificationInfo.verificationStatus || 'PENDING').toUpperCase(),
    verificationNotes: verificationInfo.verificationNotes
  };
};

// ✅ ASSIGNMENT INFO FORMATTER - UPPERCASE
const formatAssignmentInfo = (assignmentArray) => {
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
  
  const activeAssignments = assignmentArray.filter(assignment => {
    const hasAssignedTo = assignment.assignedTo && 
                         (typeof assignment.assignedTo === 'object' ? assignment.assignedTo._id : assignment.assignedTo);
    return hasAssignedTo && assignment.assignedAt;
  });

  if (activeAssignments.length === 0) {
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

  const sortedAssignments = activeAssignments.sort((a, b) => 
    new Date(b.assignedAt) - new Date(a.assignedAt)
  );

  const assignedDoctors = sortedAssignments.map(assignment => {
    const assignedTo = assignment.assignedTo;
    
    let doctorInfo;
    if (typeof assignedTo === 'object' && assignedTo._id) {
      doctorInfo = {
        id: assignedTo._id.toString(),
        name: (assignedTo.fullName || `${assignedTo.firstName || ''} ${assignedTo.lastName || ''}`.trim()).toUpperCase(),
        email: assignedTo.email,
        role: assignedTo.role
      };
    } else if (typeof assignedTo === 'string') {
      doctorInfo = {
        id: assignedTo,
        name: 'UNKNOWN DOCTOR',
        email: null,
        role: 'RADIOLOGIST'
      };
    } else {
      doctorInfo = {
        id: 'unknown',
        name: 'UNKNOWN DOCTOR',
        email: null,
        role: 'RADIOLOGIST'
      };
    }

    return {
      ...doctorInfo,
      assignedAt: assignment.assignedAt,
      priority: assignment.priority || 'NORMAL',
      dueDate: assignment.dueDate,
      status: assignment.status || 'ASSIGNED'
    };
  });

  const uniqueDoctors = assignedDoctors.filter((doctor, index, self) => 
    index === self.findIndex(d => d.id === doctor.id)
  );

  const assignedToIds = uniqueDoctors.map(doctor => doctor.id);
  const assignedToDisplay = uniqueDoctors.length === 1 
    ? uniqueDoctors[0].name
    : `${uniqueDoctors.length} DOCTORS`;

  const latestAssignment = sortedAssignments[0];

  return {
    isAssigned: true,
    assignedToDisplay,
    assignedToIds,
    assignedCount: uniqueDoctors.length,
    assignedDoctors: uniqueDoctors,
    latestAssignedAt: latestAssignment.assignedAt,
    priority: latestAssignment.priority || 'NORMAL',
    latestDueDate: latestAssignment.dueDate,
    status: 'ASSIGNED'
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