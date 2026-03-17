import { useEffect, useRef, useState, useCallback } from 'react';
import sessionManager from '../services/sessionManager';

const useWebSocket = (url = null) => {
  const [lastMessage, setLastMessage] = useState(null);
  const [readyState, setReadyState] = useState(WebSocket.CONNECTING);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  // ✅ FIXED: Properly construct WebSocket URL
  const getWsUrl = useCallback(() => {
    if (url) return url;
    
    const token = sessionManager.getToken();
    
    if (!token) {
      console.error('❌ No authentication token available for WebSocket');
      return null;
    }
    
    // ✅ Use window.location to get current host and protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // ✅ Construct full URL
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;
    console.log('🔌 WebSocket URL:', wsUrl);
    console.log('🔌 Current Location:', window.location.href);
    console.log('🔌 Protocol:', protocol, 'Host:', host);
    
    return wsUrl;
  }, [url]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    const wsUrl = getWsUrl();
    
    if (!wsUrl) {
      console.error('❌ Cannot connect to WebSocket: No valid URL');
      setReadyState(WebSocket.CLOSED);
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setReadyState(WebSocket.OPEN);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage({ data: event.data, parsedData: message });
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          setLastMessage({ data: event.data, parsedData: null });
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setReadyState(WebSocket.CLOSED);
      };

      ws.onclose = (event) => {
        console.log(`❌ WebSocket disconnected (Code: ${event.code}, Reason: ${event.reason})`);
        setReadyState(WebSocket.CLOSED);
        
        // ✅ Handle specific close codes
        if (event.code === 4001) {
          console.error('❌ Authentication required - redirecting to login');
          sessionManager.clearSession();
          window.location.href = '/login';
          return;
        }

        if (event.code === 4007) {
          console.error('❌ Invalid token - refreshing and reconnecting');
          sessionManager.refreshTokenIfNeeded().then(() => {
            attemptReconnect();
          });
          return;
        }

        // ✅ Auto-reconnect for other close codes
        attemptReconnect();
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      setReadyState(WebSocket.CLOSED);
      attemptReconnect();
    }
  }, [getWsUrl]);

  // Attempt to reconnect
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.');
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`🔄 Attempting to reconnect... (Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectDelay);
  }, [connect]);

  // Send message
  const sendMessage = useCallback((message) => {
    console.log('🎯 [sendMessage] Called with:', message);
    console.log('🎯 [sendMessage] WebSocket readyState:', wsRef.current?.readyState);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        console.log('🎯 [sendMessage] Sending string:', messageStr);
        wsRef.current.send(messageStr);
        console.log('✅ [sendMessage] Message sent successfully');
      } catch (error) {
        console.error('❌ Error sending WebSocket message:', error);
      }
    } else {
      console.warn('⚠️ WebSocket is not open. Current state:', wsRef.current?.readyState);
    }
  }, []);

  // Close connection
  const closeConnection = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Initialize connection
  useEffect(() => {
    // ✅ Check if user is authenticated before connecting
    const token = sessionManager.getToken();
    if (!token) {
      console.warn('⚠️ No token available - skipping WebSocket connection');
      return;
    }

    connect();

    // ✅ Cleanup on unmount
    return () => {
      closeConnection();
    };
  }, [connect, closeConnection]);

  // ✅ Heartbeat to keep connection alive
  useEffect(() => {
    if (readyState !== WebSocket.OPEN) return;

    const heartbeatInterval = setInterval(() => {
      sendMessage({ type: 'heartbeat' });
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [readyState, sendMessage]);

  return { 
    sendMessage, 
    lastMessage, 
    readyState,
    closeConnection,
    reconnect: connect
  };
};

export default useWebSocket;