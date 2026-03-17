import DicomStudy from '../models/dicomStudyModel.js';
import Patient from '../models/patientModel.js';
import Doctor from '../models/doctorModel.js';
import Lab from '../models/labModel.js';

/**
 * Updates workflow status across all relevant models
 * @param {Object} options - Options for status update
 * @param {string} options.studyId - DicomStudy ID
 * @param {string} options.status - New workflow status
 * @param {string} [options.doctorId] - Doctor ID (if applicable)
 * @param {string} [options.labId] - Lab ID (if applicable)
 * @param {string} [options.note] - Optional note about status change
 * @param {Object} [options.user] - User making the change
 * @returns {Promise<Object>} - Updated study and patient objects
 */
export const updateWorkflowStatus = async (options) => {
  const { studyId, status, doctorId, labId, note, user } = options;
  
  console.log('🔄 [Workflow] Starting workflow update:', {
    studyId,
    status,
    doctorId,
    labId,
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
    'report_drafted',
    'report_finalized',
    'verification_pending',      // ✅ NEW: Report sent to verifier
    'report_verified',            // ✅ Verifier approved
    'report_rejected',    
    'revert_to_radiologist', 
    'report_completed',           // ✅ NEW: Final completed status (no verification needed OR verified)
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
    // Find the study and populate patient
    console.log('🔍 [Workflow] Finding study:', studyId);
    const study = await DicomStudy.findById(studyId)
      .populate('patient', 'patientID')
      .populate({
        path: 'sourceLab',
        select: 'settings.requireReportVerification'
      });
    
    if (!study) {
      throw new Error(`Study not found: ${studyId}`);
    }
    
    console.log('🔍 [Workflow] Study found, updating status from', study.workflowStatus, 'to', status);
    
    // Ensure patientId is set
    if (!study.patientId && study.patient?.patientID) {
      study.patientId = study.patient.patientID;
    }
    
    // ✅ NEW: Handle report_finalized based on verification requirements
    if (status === 'report_finalized') {
      console.log('📋 [Workflow] Report finalized, checking verification requirements...');
      
      // Check Lab verification settings
      let requiresVerification = false;
      
      if (study.sourceLab?.settings?.requireReportVerification !== undefined) {
        requiresVerification = study.sourceLab.settings.requireReportVerification;
        console.log('📋 [Workflow] Lab verification setting:', requiresVerification);
      }
      
      // Check Doctor verification settings (if doctor is assigned)
      if (doctorId) {
        const doctor = await Doctor.findById(doctorId).select('requireReportVerification');
        if (doctor && doctor.requireReportVerification !== undefined) {
          // If either lab OR doctor requires verification, then require it
          requiresVerification = requiresVerification || doctor.requireReportVerification;
          console.log('📋 [Workflow] Doctor verification setting:', doctor.requireReportVerification);
        }
      }
      
      // ✅ DECISION LOGIC:
      if (requiresVerification) {
        // Send to verifier
        console.log('✅ [Workflow] Verification REQUIRED - Setting status to verification_pending');
        study.workflowStatus = 'verification_pending';
        study.currentCategory = 'VERIFICATION_PENDING'; // ✅ FIXED: Use uppercase enum value
      } else {
        // Skip verification, mark as completed
        console.log('✅ [Workflow] Verification NOT REQUIRED - Setting status to report_completed');
        study.workflowStatus = 'report_completed';
        study.currentCategory = 'COMPLETED'; // ✅ FIXED: Use uppercase enum value
        
        // Mark as completed
        if (!study.reportInfo) {
          study.reportInfo = {};
        }
        study.reportInfo.completedAt = new Date();
        study.reportInfo.completedWithoutVerification = true;
      }
    } else if (status === 'report_verified') {
      // ✅ When verifier approves, mark as completed
      console.log('✅ [Workflow] Report verified by verifier - Setting status to report_completed');
      study.workflowStatus = 'report_completed';
      study.currentCategory = 'COMPLETED'; // ✅ FIXED: Use uppercase enum value
      
      if (!study.reportInfo) {
        study.reportInfo = {};
      }
      study.reportInfo.completedAt = new Date();
      study.reportInfo.verifiedAndCompleted = true;
    } else {
      // ✅ FIXED: Normal status update - map workflowStatus to currentCategory
      const oldStatus = study.workflowStatus;
      study.workflowStatus = status;
      
      // Map workflowStatus to currentCategory enum values
      const categoryMap = {
        'no_active_study': 'ALL',
        'new_study_received': 'CREATED',
        'metadata_extracted': 'CREATED',
        'history_pending': 'HISTORY_CREATED',
        'history_created': 'HISTORY_CREATED',
        'history_verified': 'HISTORY_CREATED',
        'pending_assignment': 'UNASSIGNED',
        'awaiting_radiologist': 'UNASSIGNED',
        'assigned_to_doctor': 'ASSIGNED',
        'assignment_accepted': 'ASSIGNED',
        'doctor_opened_report': 'PENDING',
        'report_in_progress': 'PENDING',
        'pending_completion': 'PENDING',
        'report_drafted': 'DRAFT',
        'draft_saved': 'DRAFT',
        'verification_pending': 'VERIFICATION_PENDING',
        'verification_in_progress': 'VERIFICATION_PENDING',
        'report_finalized': 'FINAL',
        'final_approved': 'FINAL',
        'report_completed': 'COMPLETED',
        'urgent_priority': 'URGENT',
        'emergency_case': 'URGENT',
        'reprint_requested': 'REPRINT_NEED',
        'correction_needed': 'REPRINT_NEED',
        'report_uploaded': 'FINAL',
        'report_downloaded_radiologist': 'FINAL',
        'report_downloaded': 'FINAL',
        'final_report_downloaded': 'COMPLETED',
        'report_verified': 'COMPLETED',
        'report_rejected': 'VERIFICATION_PENDING',
        'revert_to_radiologist': 'PENDING',
        'archived': 'ALL'
      };
      
      study.currentCategory = categoryMap[status] || 'ALL';
    }
    
    // Record status change timestamp and note
    const timestamp = new Date();
    study.statusHistory = study.statusHistory || [];
    study.statusHistory.push({
      status: study.workflowStatus, // Use the final determined status
      changedAt: timestamp,
      changedBy: user?._id,
      note: note || `Status changed to ${study.workflowStatus}`
    });
    
    // Update additional fields based on status
    switch (study.workflowStatus) {
      case 'assigned_to_doctor':
        if (doctorId) {
          if (!study.assignment) {
            study.assignment = {};
          }
          study.assignment.assignedTo = doctorId;
          study.assignment.assignedAt = timestamp;
          study.assignment.assignedBy = user?._id;
          
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
      case 'report_drafted':
        if (!study.reportInfo) {
          study.reportInfo = {};
        }
        study.reportInfo.draftedAt = timestamp;
        study.reportInfo.reporterName = study.reportInfo.reporterName || 
                                       (user?.fullName || 'Unknown');
        break;
      case 'verification_pending':
        if (!study.reportInfo) {
          study.reportInfo = {};
        }
        study.reportInfo.sentForVerificationAt = timestamp;
        break;
      case 'report_completed':
        if (!study.reportInfo) {
          study.reportInfo = {};
        }
        if (!study.reportInfo.completedAt) {
          study.reportInfo.completedAt = timestamp;
        }
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
      case 'revert_to_radiologist':
        if (!study.revertInfo) {
          study.revertInfo = {};
        }
        study.revertInfo.isReverted = true;
        study.currentCategory = 'PENDING';
        break;
    }
    
    console.log('💾 [Workflow] Saving study with new status:', study.workflowStatus);
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
            patient.currentWorkflowStatus = study.workflowStatus;
            patient.activeDicomStudyRef = study._id;
            
            if (!patient.computed) {
              patient.computed = {};
            }
            patient.computed.lastActivity = timestamp;
            
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
      }
    }
    
    console.log('✅ [Workflow] Workflow update completed successfully');
    
    return {
      studyId: study._id,
      patientId: study.patient,
      previousStatus: status, // Original requested status
      currentStatus: study.workflowStatus, // Final determined status
      updatedAt: timestamp,
      requiresVerification: study.workflowStatus === 'verification_pending'
    };
    
  } catch (error) {
    console.error('❌ [Workflow] Error in workflow update:', error);
    console.error('❌ [Workflow] Error stack:', error.stack?.substring(0, 500));
    throw error;
  }
};