/**
 * TAT (Turnaround Time) Utility Functions
 * Calculates various turnaround times for DICOM studies
 */

/**
 * Calculate time difference in hours between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Hours difference
 */
const calculateHoursDifference = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    
    return Math.round((end - start) / (1000 * 60 * 60) * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate total TAT from study received to final report
 * @param {Object} study - DICOM study object
 * @returns {Object} TAT breakdown
 */
export const calculateTotalTAT = (study) => {
    try {
        const result = {
            totalTAT: null,
            reportingTAT: null,
            verificationTAT: null,
            downloadTAT: null,
            breakdown: {
                studyReceived: study.createdAt || study.studyDate,
                reportStarted: null,
                reportCompleted: null,
                reportVerified: null,
                reportDownloaded: null
            }
        };

        // Extract key timestamps from reportInfo
        if (study.reportInfo) {
            if (study.reportInfo.reportStartedAt) {
                result.breakdown.reportStarted = study.reportInfo.reportStartedAt;
            }
            if (study.reportInfo.reportedDate) {
                result.breakdown.reportCompleted = study.reportInfo.reportedDate;
            }
            if (study.reportInfo.verifiedDate) {
                result.breakdown.reportVerified = study.reportInfo.verifiedDate;
            }
            if (study.reportInfo.finalizedDate) {
                result.breakdown.reportDownloaded = study.reportInfo.finalizedDate;
            }
        }

        // Calculate individual TATs
        const studyStart = result.breakdown.studyReceived;
        
        // Reporting TAT (study received to report completed)
        if (studyStart && result.breakdown.reportCompleted) {
            result.reportingTAT = calculateHoursDifference(studyStart, result.breakdown.reportCompleted);
        }

        // Verification TAT (report completed to verified)
        if (result.breakdown.reportCompleted && result.breakdown.reportVerified) {
            result.verificationTAT = calculateHoursDifference(
                result.breakdown.reportCompleted, 
                result.breakdown.reportVerified
            );
        }

        // Download TAT (verified to downloaded)
        if (result.breakdown.reportVerified && result.breakdown.reportDownloaded) {
            result.downloadTAT = calculateHoursDifference(
                result.breakdown.reportVerified, 
                result.breakdown.reportDownloaded
            );
        }

        // Total TAT (study received to final download)
        if (studyStart && result.breakdown.reportDownloaded) {
            result.totalTAT = calculateHoursDifference(studyStart, result.breakdown.reportDownloaded);
        } else if (studyStart && result.breakdown.reportVerified) {
            // If not downloaded yet, use verification time
            result.totalTAT = calculateHoursDifference(studyStart, result.breakdown.reportVerified);
        } else if (studyStart && result.breakdown.reportCompleted) {
            // If not verified yet, use completion time
            result.totalTAT = calculateHoursDifference(studyStart, result.breakdown.reportCompleted);
        }

        return result;

    } catch (error) {
        console.error('❌ Error calculating TAT:', error);
        return {
            totalTAT: null,
            reportingTAT: null,
            verificationTAT: null,
            downloadTAT: null,
            breakdown: {},
            error: error.message
        };
    }
};

/**
 * Calculate assignment TAT (assigned to started working)
 * @param {Object} assignment - Assignment object
 * @returns {number|null} Hours from assignment to start
 */
export const calculateAssignmentTAT = (assignment) => {
    if (!assignment || !assignment.assignedAt) return null;
    
    const startTime = assignment.startedAt || new Date(); // Use current time if not started
    return calculateHoursDifference(assignment.assignedAt, startTime);
};

/**
 * Get TAT status based on priority and elapsed time
 * @param {number} tatHours - TAT in hours
 * @param {string} priority - Study priority
 * @returns {Object} Status object
 */
export const getTATStatus = (tatHours, priority = 'NORMAL') => {
    if (!tatHours || tatHours < 0) {
        return { status: 'unknown', color: 'gray', message: 'TAT not available' };
    }

    // Define SLA thresholds by priority (in hours)
    const slaThresholds = {
        'EMERGENCY': 2,
        'STAT': 4,
        'URGENT': 8,
        'NORMAL': 24,
        'ROUTINE': 48
    };

    const threshold = slaThresholds[priority] || slaThresholds['NORMAL'];
    const percentageOfSLA = (tatHours / threshold) * 100;

    if (percentageOfSLA <= 50) {
        return { 
            status: 'excellent', 
            color: 'green', 
            message: `Excellent (${tatHours}h / ${threshold}h SLA)`,
            percentage: percentageOfSLA 
        };
    } else if (percentageOfSLA <= 80) {
        return { 
            status: 'good', 
            color: 'blue', 
            message: `Good (${tatHours}h / ${threshold}h SLA)`,
            percentage: percentageOfSLA 
        };
    } else if (percentageOfSLA <= 100) {
        return { 
            status: 'warning', 
            color: 'yellow', 
            message: `Near SLA (${tatHours}h / ${threshold}h SLA)`,
            percentage: percentageOfSLA 
        };
    } else {
        return { 
            status: 'overdue', 
            color: 'red', 
            message: `Overdue (${tatHours}h / ${threshold}h SLA)`,
            percentage: percentageOfSLA 
        };
    }
};

/**
 * Auto-calculate and update TAT for a study
 * @param {Object} study - DICOM study object
 * @returns {Object} Updated study with TAT information
 */
export const autoCalculateTAT = (study) => {
    try {
        const tatInfo = calculateTotalTAT(study);
        const tatStatus = getTATStatus(tatInfo.totalTAT, study.priority);

        // Update study with calculated TAT
        study.calculatedTAT = {
            ...tatInfo,
            status: tatStatus,
            lastCalculated: new Date()
        };

        return study;

    } catch (error) {
        console.error('❌ Error in autoCalculateTAT:', error);
        return study;
    }
};

export default {
    calculateTotalTAT,
    calculateAssignmentTAT,
    getTATStatus,
    autoCalculateTAT,
    calculateHoursDifference
};