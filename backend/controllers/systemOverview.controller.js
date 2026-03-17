import DicomStudy from '../models/dicomStudyModel.js';
import User from '../models/userModel.js';
import Lab from '../models/labModel.js';
import Organization from '../models/organisation.js';
import mongoose from 'mongoose';

// ✅ GET SYSTEM OVERVIEW STATISTICS
export const getSystemOverview = async (req, res) => {
    try {
        const startTime = Date.now();
        const user = req.user;
        
        if (!user || !['admin', 'super_admin'].includes(user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied: Admin role required' 
            });
        }

        // ✅ BUILD ORGANIZATION FILTER
        const orgFilter = {};
        if (user.role !== 'super_admin') {
            orgFilter.organizationIdentifier = user.organizationIdentifier;
        }

        console.log(`🔍 System Overview: Fetching data for ${user.role === 'super_admin' ? 'all organizations' : user.organizationIdentifier}`);

        // ✅ PARALLEL DATA FETCHING FOR PERFORMANCE
        const [
            studyMetrics,
            userMetrics,
            labMetrics,
            workflowMetrics,
            performanceMetrics,
            recentActivity
        ] = await Promise.allSettled([
            getStudyMetrics(orgFilter),
            getUserMetrics(orgFilter),
            getLabMetrics(orgFilter),
            getWorkflowMetrics(orgFilter),
            getPerformanceMetrics(orgFilter),
            getRecentActivity(orgFilter)
        ]);

        const processingTime = Date.now() - startTime;

        // ✅ CONSTRUCT RESPONSE
        const response = {
            success: true,
            overview: {
                studies: studyMetrics.status === 'fulfilled' ? studyMetrics.value : {},
                users: userMetrics.status === 'fulfilled' ? userMetrics.value : {},
                labs: labMetrics.status === 'fulfilled' ? labMetrics.value : {},
                workflow: workflowMetrics.status === 'fulfilled' ? workflowMetrics.value : {},
                performance: performanceMetrics.status === 'fulfilled' ? performanceMetrics.value : {},
                recentActivity: recentActivity.status === 'fulfilled' ? recentActivity.value : []
            },
            metadata: {
                userRole: user.role,
                organizationFilter: user.role !== 'super_admin' ? user.organizationIdentifier : 'all',
                processingTime: processingTime,
                generatedAt: new Date().toISOString()
            }
        };

        // ✅ DEBUG INFO IN DEVELOPMENT
        if (process.env.NODE_ENV === 'development') {
            response.debug = {
                failedQueries: [
                    studyMetrics.status === 'rejected' ? 'studyMetrics' : null,
                    userMetrics.status === 'rejected' ? 'userMetrics' : null,
                    labMetrics.status === 'rejected' ? 'labMetrics' : null,
                    workflowMetrics.status === 'rejected' ? 'workflowMetrics' : null,
                    performanceMetrics.status === 'rejected' ? 'performanceMetrics' : null,
                    recentActivity.status === 'rejected' ? 'recentActivity' : null
                ].filter(Boolean)
            };
        }

        res.status(200).json(response);

    } catch (error) {
        console.error('❌ Error fetching system overview:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching system overview.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ STUDY METRICS HELPER
const getStudyMetrics = async (orgFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        totalStudies,
        todayStudies,
        weekStudies,
        monthStudies,
        modalityBreakdown,
        priorityBreakdown
    ] = await Promise.all([
        DicomStudy.countDocuments(orgFilter),
        DicomStudy.countDocuments({ ...orgFilter, createdAt: { $gte: today } }),
        DicomStudy.countDocuments({ ...orgFilter, createdAt: { $gte: thisWeek } }),
        DicomStudy.countDocuments({ ...orgFilter, createdAt: { $gte: thisMonth } }),
        DicomStudy.aggregate([
            { $match: orgFilter },
            { $group: { _id: '$modality', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        DicomStudy.aggregate([
            { $match: { ...orgFilter, 'assignment.priority': { $exists: true } } },
            { $group: { _id: '$assignment.priority', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ])
    ]);

    return {
        total: totalStudies,
        today: todayStudies,
        thisWeek: weekStudies,
        thisMonth: monthStudies,
        growth: {
            daily: todayStudies,
            weekly: weekStudies,
            monthly: monthStudies
        },
        breakdown: {
            modality: modalityBreakdown,
            priority: priorityBreakdown
        }
    };
};

// ✅ USER METRICS HELPER
const getUserMetrics = async (orgFilter) => {
    const userFilter = {};
    if (orgFilter.organizationIdentifier) {
        userFilter.organizationIdentifier = orgFilter.organizationIdentifier;
    }

    const [
        totalUsers,
        activeUsers,
        roleBreakdown,
        recentLogins
    ] = await Promise.all([
        User.countDocuments(userFilter),
        User.countDocuments({ ...userFilter, status: 'active' }),
        User.aggregate([
            { $match: userFilter },
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        User.countDocuments({ 
            ...userFilter, 
            lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        })
    ]);

    return {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        recentLogins,
        breakdown: {
            roles: roleBreakdown
        }
    };
};

// ✅ LAB METRICS HELPER
const getLabMetrics = async (orgFilter) => {
    const labFilter = {};
    if (orgFilter.organizationIdentifier) {
        labFilter.organizationIdentifier = orgFilter.organizationIdentifier;
    }

    const [
        totalLabs,
        activeLabs,
        labActivity
    ] = await Promise.all([
        Lab.countDocuments(labFilter),
        Lab.countDocuments({ ...labFilter, status: 'active' }),
        DicomStudy.aggregate([
            { $match: { ...orgFilter, sourceLab: { $exists: true } } },
            { $group: { _id: '$sourceLab', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ])
    ]);

    return {
        total: totalLabs,
        active: activeLabs,
        inactive: totalLabs - activeLabs,
        activity: labActivity
    };
};

// ✅ WORKFLOW METRICS HELPER
const getWorkflowMetrics = async (orgFilter) => {
    const [
        statusBreakdown,
        averageTAT,
        overdueStudies
    ] = await Promise.all([
        DicomStudy.aggregate([
            { $match: orgFilter },
            { $group: { _id: '$workflowStatus', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        DicomStudy.aggregate([
            { $match: { ...orgFilter, 'calculatedTAT.totalTATMinutes': { $exists: true, $gt: 0 } } },
            { $group: { _id: null, avgTAT: { $avg: '$calculatedTAT.totalTATMinutes' } } }
        ]),
        DicomStudy.countDocuments({ ...orgFilter, 'calculatedTAT.isOverdue': true })
    ]);

    return {
        statusBreakdown,
        averageTAT: averageTAT[0]?.avgTAT || 0,
        overdueStudies,
        efficiency: averageTAT[0]?.avgTAT ? Math.max(0, 100 - (averageTAT[0].avgTAT / 1440 * 100)) : 0
    };
};

// ✅ PERFORMANCE METRICS HELPER
const getPerformanceMetrics = async (orgFilter) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
        todayCompleted,
        yesterdayCompleted,
        avgReportTime,
        topPerformers
    ] = await Promise.all([
        DicomStudy.countDocuments({ 
            ...orgFilter, 
            workflowStatus: { $in: ['report_finalized', 'report_verified'] },
            'reportInfo.finalizedAt': { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
        }),
        DicomStudy.countDocuments({ 
            ...orgFilter, 
            workflowStatus: { $in: ['report_finalized', 'report_verified'] },
            'reportInfo.finalizedAt': { $gte: yesterday, $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
        }),
        DicomStudy.aggregate([
            { $match: { ...orgFilter, 'calculatedTAT.assignmentToReportTAT': { $exists: true, $gt: 0 } } },
            { $group: { _id: null, avgTime: { $avg: '$calculatedTAT.assignmentToReportTAT' } } }
        ]),
        DicomStudy.aggregate([
            { $match: { ...orgFilter, 'assignment.assignedTo': { $exists: true } } },
            { $unwind: '$assignment' },
            { $group: { 
                _id: '$assignment.assignedTo', 
                completed: { $sum: { $cond: [{ $in: ['$workflowStatus', ['report_finalized', 'report_verified']] }, 1, 0] } },
                total: { $sum: 1 }
            }},
            { $sort: { completed: -1 } },
            { $limit: 5 }
        ])
    ]);

    const growthRate = yesterdayCompleted > 0 ? 
        ((todayCompleted - yesterdayCompleted) / yesterdayCompleted * 100) : 0;

    return {
        todayCompleted,
        yesterdayCompleted,
        growthRate,
        avgReportTime: avgReportTime[0]?.avgTime || 0,
        topPerformers
    };
};

// ✅ RECENT ACTIVITY HELPER
const getRecentActivity = async (orgFilter) => {
    const recentStudies = await DicomStudy.find(orgFilter)
        .populate('assignment.assignedTo', 'fullName role')
        .populate('sourceLab', 'name identifier')
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean();

    return recentStudies.map(study => ({
        _id: study._id,
        patientName: study.patientInfo?.patientName || 'Unknown',
        patientId: study.patientInfo?.patientID || study.patientId,
        accessionNumber: study.accessionNumber,
        modality: study.modality,
        workflowStatus: study.workflowStatus,
        assignedTo: study.assignment?.[0]?.assignedTo?.fullName || 'Unassigned',
        labName: study.sourceLab?.name || 'Unknown Lab',
        updatedAt: study.updatedAt,
        createdAt: study.createdAt
    }));
};

// ✅ GET ORGANIZATION SUMMARY (FOR SUPER ADMIN)
export const getOrganizationSummary = async (req, res) => {
    try {
        const user = req.user;
        
        if (!user || user.role !== 'super_admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied: Super admin role required' 
            });
        }

        const organizations = await Organization.find({ status: 'active' })
            .select('name identifier displayName contactInfo subscription')
            .lean();

        const orgSummaries = await Promise.all(
            organizations.map(async (org) => {
                const [studyCount, userCount, labCount] = await Promise.all([
                    DicomStudy.countDocuments({ organizationIdentifier: org.identifier }),
                    User.countDocuments({ organizationIdentifier: org.identifier }),
                    Lab.countDocuments({ organizationIdentifier: org.identifier })
                ]);

                return {
                    ...org,
                    stats: {
                        studies: studyCount,
                        users: userCount,
                        labs: labCount
                    }
                };
            })
        );

        res.status(200).json({
            success: true,
            organizations: orgSummaries,
            total: orgSummaries.length
        });

    } catch (error) {
        console.error('❌ Error fetching organization summary:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching organization summary.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ✅ GET SYSTEM HEALTH METRICS
export const getSystemHealth = async (req, res) => {
    try {
        const user = req.user;
        
        if (!user || !['admin', 'super_admin'].includes(user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied: Admin role required' 
            });
        }

        const orgFilter = {};
        if (user.role !== 'super_admin') {
            orgFilter.organizationIdentifier = user.organizationIdentifier;
        }

        const [
            totalStudies,
            errorStudies,
            stuckStudies,
            activeUsers,
            systemLoad
        ] = await Promise.all([
            DicomStudy.countDocuments(orgFilter),
            DicomStudy.countDocuments({ ...orgFilter, workflowStatus: 'error' }),
            DicomStudy.countDocuments({ 
                ...orgFilter, 
                workflowStatus: 'assigned_to_doctor',
                'assignment.assignedAt': { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }),
            User.countDocuments({ 
                ...(orgFilter.organizationIdentifier ? { organizationIdentifier: orgFilter.organizationIdentifier } : {}),
                lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }),
            // Simple system load calculation
            DicomStudy.countDocuments({ 
                ...orgFilter, 
                createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } 
            })
        ]);

        const healthScore = Math.max(0, 100 - (errorStudies / Math.max(totalStudies, 1) * 100) - (stuckStudies / Math.max(totalStudies, 1) * 50));

        res.status(200).json({
            success: true,
            health: {
                score: Math.round(healthScore),
                status: healthScore > 90 ? 'excellent' : healthScore > 70 ? 'good' : healthScore > 50 ? 'fair' : 'poor',
                metrics: {
                    totalStudies,
                    errorStudies,
                    stuckStudies,
                    activeUsers,
                    systemLoad
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching system health:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching system health.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getSystemOverview,
    getOrganizationSummary,
    getSystemHealth
};