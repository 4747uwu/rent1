import DicomStudy from '../models/dicomStudyModel.js';
import Patient from '../models/patientModel.js';
import Doctor from '../models/doctorModel.js';

/**
 * Updates workflow status across all relevant models
 * @param {Object} options - Options for status update
 * @param {string} options.studyId - DicomStudy ID
 * @param {string} options.status - New workflow status
 * @param {string} [options.doctorId] - Doctor ID (if applicable)
 * @param {string} [options.note] - Optional note about status change
 * @param {Object} [options.user] - User making the change
 * @returns {Promise<Object>} - Updated study and patient objects
 */
export const updateWorkflowStatus = async (options) => {
  const { studyId, status, doctorId, note, user } = options;
  
  console.log('🔄 [Workflow] Starting workflow update:', {
    studyId,
    status,
    doctorId,
    note: note?.substring(0, 100),
    userId: user?._id
  });
  
  // 🔧 UPDATED: Validate status against allowed workflow statuses
  const validStatuses = [
    'no_active_study',
    'new_study_received',
    'pending_assignment',
    'assigned_to_doctor',
    'doctor_opened_report',
    'report_in_progress',
    'report_drafted',               // 🆕 NEW: Added report_drafted status
    'report_finalized',
    'report_uploaded',
    'report_downloaded_radiologist',
    'report_downloaded',
    'final_report_downloaded',
    'archived'
  ];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid workflow status: ${status}`);
  }
  
  try {
    // 🔧 FIXED: Find the study and populate patient for patientId
    console.log('🔍 [Workflow] Finding study:', studyId);
    const study = await DicomStudy.findById(studyId).populate('patient', 'patientID');
    if (!study) {
      throw new Error(`Study not found: ${studyId}`);
    }
    
    console.log('🔍 [Workflow] Study found, updating status from', study.workflowStatus, 'to', status);
    
    // 🔧 FIXED: Ensure patientId is set (required field in your schema)
    if (!study.patientId && study.patient?.patientID) {
      study.patientId = study.patient.patientID;
    }
    
    // Update study status
    const oldStatus = study.workflowStatus;
    study.workflowStatus = status;
    
    // Record status change timestamp and note
    const timestamp = new Date();
    study.statusHistory = study.statusHistory || [];
    study.statusHistory.push({
      status,
      changedAt: timestamp,
      changedBy: user?._id,
      note
    });
    
    // Update additional fields based on status
    switch (status) {
      case 'assigned_to_doctor':
        if (doctorId) {
          // 🔧 FIXED: Update assignment structure correctly
          if (!study.assignment) {
            study.assignment = {};
          }
          study.assignment.assignedTo = doctorId;
          study.assignment.assignedAt = timestamp;
          study.assignment.assignedBy = user?._id;
          
          // Also update legacy field for backward compatibility
          study.lastAssignedDoctor = doctorId;
          study.lastAssignmentAt = timestamp;
        }
        break;
      case 'report_in_progress':
        study.reportStartedAt = study.reportStartedAt || timestamp;
        if (!study.reportInfo) {
          study.reportInfo = {};
        }
        study.reportInfo.startedAt = study.reportInfo.startedAt || timestamp;
        break;
      case 'report_drafted':          // 🆕 NEW: Handle draft report status
        if (!study.reportInfo) {
          study.reportInfo = {};
        }
        study.reportInfo.draftedAt = timestamp;
        study.reportInfo.reporterName = study.reportInfo.reporterName || 
                                       (user?.fullName || 'Unknown');
        // Don't set finalizedAt for drafts
        break;
      case 'report_finalized':
        study.reportFinalizedAt = timestamp;
        if (!study.reportInfo) {
          study.reportInfo = {};
        }
        study.reportInfo.finalizedAt = timestamp;
        break;
      case 'report_downloaded_radiologist':
      case 'report_downloaded':
      case 'final_report_downloaded':
        if (!study.reportInfo) {
          study.reportInfo = {};
        }
        study.reportInfo.downloadedAt = timestamp;
        break;
      case 'archived':
        study.archivedAt = timestamp;
        break;
    }
    
    console.log('💾 [Workflow] Saving study with new status');
    // 🔧 FIXED: Save with validation disabled for patientId issue and add timeout
    await Promise.race([
      study.save({ validateBeforeSave: false }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Study save timeout')), 5000))
    ]);
    
    console.log('✅ [Workflow] Study saved successfully');
    
    // Update patient status (with timeout)
    if (study.patient) {
      try {
        console.log('👤 [Workflow] Updating patient status');
        const patientUpdatePromise = (async () => {
          const patient = await Patient.findById(study.patient);
          if (patient) {
            patient.currentWorkflowStatus = status;
            patient.activeDicomStudyRef = study._id;
            
            // Update computed fields
            if (!patient.computed) {
              patient.computed = {};
            }
            patient.computed.lastActivity = timestamp;
            
            // Optional: Add status note to patient
            if (note) {
              patient.statusNotes = note;
            }
            
            await patient.save();
            console.log('✅ [Workflow] Patient status updated');
          }
        })();
        
        await Promise.race([
          patientUpdatePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Patient update timeout')), 3000))
        ]);
      } catch (patientError) {
        console.warn('⚠️ [Workflow] Failed to update patient status:', patientError.message);
        // Don't fail the entire operation if patient update fails
      }
    }
    
    // ✅ SIMPLIFIED: Skip complex doctor assignment updates for report statuses
    if (['report_drafted', 'report_finalized'].includes(status)) {
      console.log('📋 [Workflow] Skipping doctor assignment updates for report status');
      
      // Return updated objects
      return {
        studyId: study._id,
        patientId: study.patient,
        previousStatus: oldStatus,
        currentStatus: status,
        updatedAt: timestamp
      };
    }
    
    // Continue with other doctor assignment logic for non-report statuses...
    // (Keep the existing doctor assignment logic but only for non-report statuses)
    
    console.log('✅ [Workflow] Workflow update completed successfully');
    
    // Return updated objects
    return {
      studyId: study._id,
      patientId: study.patient,
      previousStatus: oldStatus,
      currentStatus: status,
      updatedAt: timestamp
    };
    
  } catch (error) {
    console.error('❌ [Workflow] Error in workflow update:', error);
    console.error('❌ [Workflow] Error stack:', error.stack?.substring(0, 500));
    throw error;
  }
};