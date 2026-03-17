import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import DicomStudy from '../models/dicomStudyModel.js';
import cookie from 'cookie';
import dotenv from 'dotenv';
import url from "url";

dotenv.config();

const COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'jwtAuthToken';

class WebSocketService {
  constructor() {
    this.wss = null;
    this.adminConnections = new Map();
    this.radiologistConnections = new Map(); // ✅ NEW: Track radiologist connections
    this.activeStudyViewers = new Map(); // ✅ NEW: Map<studyId, Set<userId>>
    this.connectionCount = 0;
    this.lastDataSnapshot = null;
    this.dataUpdateInterval = null;
  }

  initialize(server) {
    this.wss = new WebSocketServer({ 
      server,
      // path: '/ws/admin',
      perMessageDeflate: false,
      maxPayload: 16 * 1024 * 1024, // 16MB
      clientTracking: true
    });

    this.wss.on('connection', async (ws, request) => {
      try {
        console.log('🔌 New WebSocket connection attempt...');
        
        // Extract token from cookies
        let token = null;
        
        // if (request.headers.cookie) {
        //   const cookies = cookie.parse(request.headers.cookie);
        //   token = cookies[COOKIE_NAME];
        // }
        console.log(request.url);
        if (!token) {
          const parsedUrl = url.parse(request.url, true);
          token = parsedUrl.query.token;
          console.log(parsedUrl);
          console.log('🔑 Extracted token:', token ? 'Present' : 'Not found');
        }

        // if (!token) {
        //   console.log('❌ WebSocket connection rejected: No authentication token found');
        //   ws.close(4001, 'Authentication required');
        //   return;
        // }

        // Verify JWT token
        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
          console.error('❌ JWT verification failed:', jwtError.message);
          ws.close(4007, 'Invalid token');
          return;
        }

        // Find user
        const user = await User.findById(decoded.id)
                              .select('-password')
                              .populate('lab', 'name identifier isActive');

        if (!user || !user.isActive) {
          console.log('❌ WebSocket connection rejected: User not found or inactive');
          ws.close(4002, 'Invalid user');
          return;
        }

        // Generate unique connection ID
        this.connectionCount++;
        const connectionId = `${user.role}_${user._id}_${this.connectionCount}_${Date.now()}`;
        
        // ✅ NEW: Store connection based on role
        const connectionData = {
          ws,
          user,
          connectionId,
          connectedAt: new Date(),
          lastPing: new Date(),
          isAlive: true,
          currentlyViewingStudy: null, // ✅ Track currently viewing study
          subscribedToStudies: true,
          subscribedToLiveData: false,
          subscribedToViewerUpdates: false, // ✅ NEW: Subscribe to viewer status
          filters: { category: 'all', page: 1, limit: 50 }
        };

        // Store in appropriate map
        if (user.role === 'admin' || user.role === 'assignor') {
          this.adminConnections.set(connectionId, connectionData);
          connectionData.subscribedToViewerUpdates = true; // Auto-subscribe admins
          console.log(`✅ Admin/Assignor WebSocket connected: ${user.fullName || user.email}`);
        } else if (user.role === 'radiologist' || user.role === 'doctor_account' || user.role === 'verifier') {
          this.radiologistConnections.set(connectionId, connectionData);
          console.log(`✅ Radiologist WebSocket connected: ${user.fullName || user.email}`);
        } else {
          ws.close(4003, 'Unauthorized role');
          return;
        }

        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'connection_established',
          message: 'Connected to study viewer tracking',
          userId: user._id,
          connectionId,
          userInfo: {
            name: user.fullName || user.email,
            role: user.role
          },
          timestamp: new Date()
        }));

        // ✅ Send current active viewers to new admin connection
        if (user.role === 'admin' || user.role === 'assignor') {
          this.sendActiveViewersToConnection(connectionId);
        }

        // Handle client messages
        ws.on('message', (data) => {
          try {
            const rawData = data.toString();
            console.log('📨 [WebSocket] Raw message received:', rawData.substring(0, 100));
            
            const message = JSON.parse(rawData);
            console.log('📨 [WebSocket] Parsed message:', {
              type: message.type,
              userId: user._id,
              userName: user.fullName || user.email,
              role: user.role,
              studyId: message.studyId || 'N/A'
            });
            
            this.handleClientMessage(connectionId, message, user.role);
          } catch (error) {
            console.error('❌ [WebSocket] Error parsing message:', error);
            console.error('❌ [WebSocket] Raw data:', data.toString());
          }
        });

        // Handle disconnection
        ws.on('close', (code, reason) => {
          console.log(`❌ WebSocket disconnected: ${user.fullName || user.email} (Code: ${code})`);
          
          // ✅ Clean up active viewers if radiologist disconnects
          if (user.role === 'radiologist' || user.role === 'doctor_account' || user.role === 'verifier') {
            const connection = this.radiologistConnections.get(connectionId);
            if (connection?.currentlyViewingStudy) {
              this.notifyStudyClosed(connection.currentlyViewingStudy, user._id, user.fullName || user.email);
            }
            this.radiologistConnections.delete(connectionId);
          } else {
            this.adminConnections.delete(connectionId);
          }
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.adminConnections.delete(connectionId);
          this.radiologistConnections.delete(connectionId);
        });

        // Set up pong handler
        ws.on('pong', () => {
          ws.isAlive = true;
          const connection = this.adminConnections.get(connectionId) || this.radiologistConnections.get(connectionId);
          if (connection) {
            connection.lastPing = new Date();
          }
        });

      } catch (error) {
        console.error('❌ WebSocket connection error:', error);
        ws.close(4004, 'Connection failed');
      }
    });

    this.startHeartbeat();
    this.startDataStreaming();

    console.log('🔌 WebSocket server initialized with study viewer tracking');
  }

  // ✅ NEW: Enhanced message handler with viewer tracking
  async handleClientMessage(connectionId, message, userRole) {
    console.log('🔧 [handleClientMessage] Processing:', {
      type: message.type,
      userRole,
      connectionId: connectionId.substring(0, 30)
    });
    
    const connection = this.adminConnections.get(connectionId) || this.radiologistConnections.get(connectionId);
    if (!connection) {
      console.log('❌ [handleClientMessage] Connection not found for:', connectionId.substring(0, 30));
      return;
    }

    switch (message.type) {
      // Existing cases...
      case 'ping':
      case 'heartbeat':
        connection.lastPing = new Date();
        connection.isAlive = true;
        connection.ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date()
        }));
        break;

      // ✅ NEW: Radiologist opened a study for viewing/reporting
      case 'study_opened':
        console.log('👁️ [WebSocket] Processing study_opened:', {
          userRole,
          studyId: message.studyId,
          mode: message.mode
        });
        
        if (userRole === 'radiologist' || userRole === 'doctor_account' || userRole === 'verifier') {
          const { studyId, mode } = message;
          if (studyId) {
            console.log('✅ [WebSocket] Valid study_opened, notifying admins');
            this.notifyStudyOpened(studyId, connection.user._id, connection.user.fullName || connection.user.email, mode);
            connection.currentlyViewingStudy = studyId;
          } else {
            console.log('❌ [WebSocket] No studyId in message');
          }
        } else {
          console.log('❌ [WebSocket] Invalid userRole for study_opened:', userRole);
        }
        break;

      // ✅ NEW: Radiologist closed the study
      case 'study_closed':
        if (userRole === 'radiologist' || userRole === 'doctor_account' || userRole === 'verifier') {
          const { studyId } = message;
          if (studyId) {
            this.notifyStudyClosed(studyId, connection.user._id, connection.user.fullName || connection.user.email);
            connection.currentlyViewingStudy = null;
          }
        }
        break;

      // ✅ NEW: Admin requests list of active viewers
      case 'request_active_viewers':
        if (userRole === 'admin' || userRole === 'assignor') {
          this.sendActiveViewersToConnection(connectionId);
        }
        break;

      // ✅ NEW: Subscribe to viewer updates (admins only)
      case 'subscribe_to_viewer_updates':
        if (userRole === 'admin' || userRole === 'assignor') {
          connection.subscribedToViewerUpdates = true;
          connection.ws.send(JSON.stringify({
            type: 'subscribed_to_viewer_updates',
            message: 'Subscribed to real-time viewer updates',
            timestamp: new Date()
          }));
          this.sendActiveViewersToConnection(connectionId);
        }
        break;

      // Existing cases...
      case 'subscribe_to_live_data':
        connection.subscribedToLiveData = true;
        if (message.filters) {
          connection.filters = { ...connection.filters, ...message.filters };
        }
        await this.sendStudyData(connectionId, true);
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  // ✅ NEW: Notify admins that a study was opened
  notifyStudyOpened(studyId, userId, userName, mode = 'viewing') {
    // Track in active viewers map
    if (!this.activeStudyViewers.has(studyId)) {
      this.activeStudyViewers.set(studyId, new Set());
    }
    this.activeStudyViewers.get(studyId).add(userId);

    const notification = {
      type: 'study_viewer_opened',
      timestamp: new Date(),
      data: {
        studyId,
        userId,
        userName,
        mode, // 'viewing' or 'reporting'
        action: 'opened'
      }
    };

    let sentCount = 0;
    this.adminConnections.forEach((connection) => {
      if (connection.ws.readyState === connection.ws.OPEN && connection.subscribedToViewerUpdates) {
        try {
          connection.ws.send(JSON.stringify(notification));
          sentCount++;
        } catch (error) {
          console.error(`Error sending viewer notification:`, error);
        }
      }
    });

    console.log(`👁️ Study opened notification sent to ${sentCount} admin(s): ${userName} opened study ${studyId} (${mode})`);
  }

  // ✅ NEW: Notify admins that a study was closed
  notifyStudyClosed(studyId, userId, userName) {
    // Remove from active viewers map
    if (this.activeStudyViewers.has(studyId)) {
      this.activeStudyViewers.get(studyId).delete(userId);
      if (this.activeStudyViewers.get(studyId).size === 0) {
        this.activeStudyViewers.delete(studyId);
      }
    }

    const notification = {
      type: 'study_viewer_closed',
      timestamp: new Date(),
      data: {
        studyId,
        userId,
        userName,
        action: 'closed'
      }
    };

    let sentCount = 0;
    this.adminConnections.forEach((connection) => {
      if (connection.ws.readyState === connection.ws.OPEN && connection.subscribedToViewerUpdates) {
        try {
          connection.ws.send(JSON.stringify(notification));
          sentCount++;
        } catch (error) {
          console.error(`Error sending viewer closed notification:`, error);
        }
      }
    });

    console.log(`👁️ Study closed notification sent to ${sentCount} admin(s): ${userName} closed study ${studyId}`);
  }

  // ✅ NEW: Send current active viewers to a specific connection
  sendActiveViewersToConnection(connectionId) {
    const connection = this.adminConnections.get(connectionId);
    if (!connection || connection.ws.readyState !== connection.ws.OPEN) return;

    const activeViewers = {};
    
    // Build active viewers object: { studyId: [{ userId, userName, mode }] }
    this.radiologistConnections.forEach((radConn) => {
      if (radConn.currentlyViewingStudy) {
        if (!activeViewers[radConn.currentlyViewingStudy]) {
          activeViewers[radConn.currentlyViewingStudy] = [];
        }
        activeViewers[radConn.currentlyViewingStudy].push({
          userId: radConn.user._id,
          userName: radConn.user.fullName || radConn.user.email,
          mode: 'viewing' // Could be enhanced to track mode
        });
      }
    });

    connection.ws.send(JSON.stringify({
      type: 'active_viewers_list',
      timestamp: new Date(),
      data: activeViewers
    }));

    console.log(`📋 Sent active viewers list to ${connection.user.email}`);
  }

  async sendInitialStudyData(connectionId) {
    const connection = this.adminConnections.get(connectionId);
    if (!connection) return;

    try {
      const studyData = await this.fetchStudyData(connection.filters);
      
      connection.ws.send(JSON.stringify({
        type: 'initial_study_data',
        data: studyData,
        timestamp: new Date()
      }));
      
      connection.lastDataSent = Date.now();
      console.log(`📊 Sent initial study data to ${connection.user.email}`);
    } catch (error) {
      console.error('Error sending initial study data:', error);
    }
  }

  async sendStudyData(connectionId, forceUpdate = false) {
    const connection = this.adminConnections.get(connectionId);
    if (!connection || !connection.subscribedToLiveData) return;

    try {
      const studyData = await this.fetchStudyData(connection.filters);
      const dataHash = JSON.stringify(studyData).length; // Simple hash
      
      // Only send if data changed or forced
      if (forceUpdate || connection.lastDataSent !== dataHash) {
        connection.ws.send(JSON.stringify({
          type: 'study_data_update',
          data: studyData,
          timestamp: new Date(),
          forced: forceUpdate
        }));
        
        connection.lastDataSent = dataHash;
      }
    } catch (error) {
      console.error(`Error sending study data to ${connectionId}:`, error);
    }
  }

  async fetchStudyData(filters = {}) {
    try {
      const { category = 'all', page = 1, limit = 50 } = filters;
      
      // Build filter conditions
      let filterConditions = {};
      
      switch (category) {
        case 'pending':
          filterConditions.workflowStatus = { $in: ['new_study_received', 'study_needs_review'] };
          break;
        case 'inprogress':
          filterConditions.workflowStatus = { $in: ['assigned_to_doctor', 'report_in_progress'] };
          break;
        case 'completed':
          filterConditions.workflowStatus = { $in: ['report_finalized', 'final_report_downloaded'] };
          break;
        // 'all' shows everything
      }

      // Fetch studies with corrected population
      const studies = await DicomStudy.find(filterConditions)
        .populate('patient', 'patientID patientNameRaw gender dateOfBirth')
        .populate('sourceLab', 'name identifier')
        .populate({
          path: 'lastAssignedDoctor',
          select: 'specialization',
          populate: {
            path: 'userAccount',
            select: 'firstName lastName email fullName'
          }
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      // Get total count
      const totalRecords = await DicomStudy.countDocuments(filterConditions);
      const totalPages = Math.ceil(totalRecords / limit);

      // Get category counts for dashboard stats
      const categoryCounts = await DicomStudy.aggregate([
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $in: ['$workflowStatus', ['new_study_received', 'study_needs_review']] }, then: 'pending' },
                  { case: { $in: ['$workflowStatus', ['assigned_to_doctor', 'report_in_progress']] }, then: 'inprogress' },
                  { case: { $in: ['$workflowStatus', ['report_finalized', 'final_report_downloaded']] }, then: 'completed' }
                ],
                default: 'other'
              }
            },
            count: { $sum: 1 }
          }
        }
      ]);

      const summary = {
        byCategory: {
          all: totalRecords,
          pending: categoryCounts.find(c => c._id === 'pending')?.count || 0,
          inprogress: categoryCounts.find(c => c._id === 'inprogress')?.count || 0,
          completed: categoryCounts.find(c => c._id === 'completed')?.count || 0
        },
        activeLabs: [...new Set(studies.map(s => s.sourceLab?._id).filter(Boolean))].length,
        activeDoctors: [...new Set(studies.map(s => s.lastAssignedDoctor?._id).filter(Boolean))].length
      };

      return {
        success: true,
        data: studies,
        totalPages,
        totalRecords,
        currentPage: page,
        summary,
        fetchedAt: new Date()
      };

    } catch (error) {
      console.error('Error fetching study data:', error);
      throw error;
    }
  }

  startDataStreaming() {
    // Send data updates every 5 seconds to subscribed connections
    this.dataUpdateInterval = setInterval(async () => {
      const activeConnections = Array.from(this.adminConnections.values())
        .filter(conn => conn.ws.readyState === conn.ws.OPEN && conn.subscribedToLiveData);
      
      if (activeConnections.length === 0) return;

      for (const connection of activeConnections) {
        await this.sendStudyData(connection.connectionId);
      }
    }, 5000); // Every 5 seconds

    console.log('📊 Started data streaming interval');
  }

  startHeartbeat() {
    const interval = setInterval(() => {
      this.adminConnections.forEach((connection, connectionId) => {
        if (connection.ws.readyState === connection.ws.OPEN) {
          if (connection.isAlive === false) {
            console.log(`Terminating unresponsive connection: ${connectionId}`);
            connection.ws.terminate();
            this.adminConnections.delete(connectionId);
            return;
          }

          connection.isAlive = false;
          connection.ws.ping();
        } else {
          this.adminConnections.delete(connectionId);
        }
      });
    }, 30000); // Every 30 seconds

    return interval;
  }

  // Enhanced study notifications
  async notifyNewStudy(studyData) {
    const notification = {
      type: 'new_study_notification',
      timestamp: new Date(),
      data: {
        studyId: studyData._id,
        patientName: studyData.patientName,
        patientId: studyData.patientId,
        modality: studyData.modality,
        location: studyData.location,
        studyDate: studyData.studyDate,
        workflowStatus: studyData.workflowStatus,
        priority: studyData.priority,
        accessionNumber: studyData.accessionNumber,
        seriesImages: studyData.seriesImages || '1/1'
      }
    };

    let sentCount = 0;
    this.adminConnections.forEach((connection, connectionId) => {
      if (connection.ws.readyState === connection.ws.OPEN && connection.subscribedToStudies) {
        try {
          connection.ws.send(JSON.stringify(notification));
          sentCount++;
        } catch (error) {
          console.error(`Error sending notification to ${connectionId}:`, error);
        }
      }
    });

    console.log(`📢 New study notification sent to ${sentCount} admin(s): ${studyData.patientName}`);
    
    // Also trigger data refresh for live data subscribers
    await this.broadcastDataRefresh();
  }

  async broadcastDataRefresh() {
    const liveDataConnections = Array.from(this.adminConnections.values())
      .filter(conn => conn.ws.readyState === conn.ws.OPEN && conn.subscribedToLiveData);
    
    for (const connection of liveDataConnections) {
      await this.sendStudyData(connection.connectionId, true);
    }
  }

  // 🆕 NEW: Simple New Study Notification (no data)
  async notifySimpleNewStudy() {
    const notification = {
      type: 'simple_new_study_notification',
      timestamp: new Date(),
      message: 'New Study Arrived'
    };

    let sentCount = 0;
    this.adminConnections.forEach((connection, connectionId) => {
      if (connection.ws.readyState === connection.ws.OPEN && connection.subscribedToStudies) {
        try {
          connection.ws.send(JSON.stringify(notification));
          sentCount++;
        } catch (error) {
          console.error(`Error sending simple notification to ${connectionId}:`, error);
        }
      }
    });

    console.log(`📢 Simple "New Study Arrived" notification sent to ${sentCount} admin(s)`);
  }

  // Get connection stats
  getStats() {
    return {
      totalConnections: this.adminConnections.size,
      activeConnections: Array.from(this.adminConnections.values()).filter(
        conn => conn.ws.readyState === conn.ws.OPEN
      ).length,
      subscribedToStudies: Array.from(this.adminConnections.values()).filter(
        conn => conn.subscribedToStudies && conn.ws.readyState === conn.ws.OPEN
      ).length,
      subscribedToLiveData: Array.from(this.adminConnections.values()).filter(
        conn => conn.subscribedToLiveData && conn.ws.readyState === conn.ws.OPEN
      ).length
    };
  }
}

// Export singleton instance
export default new WebSocketService();