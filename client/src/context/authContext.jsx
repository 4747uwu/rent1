import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import sessionManager from '../services/sessionManager';

// API URL configuration
// const API_URL = import.meta.env.VITE_BACKEND_URL && import.meta.env.VITE_BACKEND_URL !== ''
//   ? `${import.meta.env.VITE_BACKEND_URL}/api`
//   : 'http://localhost:5000/api';

const API_URL = '/api';
// const API_URL = 'http://localhost:5000/api';

console.log('🔍 API_URL:', API_URL);

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [currentOrganizationContext, setCurrentOrganizationContext] = useState(null);


  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const session = sessionManager.getSession();
        if (session) {
          setCurrentUser(session.user);
          setCurrentOrganizationContext(session.organizationContext || 'global');
          console.log('✅ Session restored:', session.user.email, 'Role:', session.user.role);
          
          // If super admin, load available organizations
          if (session.user.role === 'super_admin') {
            await loadAvailableOrganizations();
          }
        } else {
          console.log('❌ No valid session found');
        }
      } catch (err) {
        console.log("Error checking session:", err);
        sessionManager.clearSession();
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Universal login function - only email and password required
  const login = async (email, password) => {
    setError(null);
    try {
      console.log('🔍 Attempting universal login:', { email });
      
      const loginData = { email, password };

      const res = await axios.post(`${API_URL}/auth/login`, loginData);
      
      if (res.data.success) {
        const { user, token, expiresIn, organizationContext, redirectTo } = res.data;
        const visibleColumns  = res.data.user.visibleColumns;
        console.log('🔍 Login response received for:', res.data);
        
        // ✅ Merge visibleColumns into user object before storing
        const enrichedUser = {
          ...user,
          visibleColumns: visibleColumns || []
        };
        
        // Store session with organization context and enriched user data
        sessionManager.setSession(token, enrichedUser, expiresIn, organizationContext);
        setCurrentUser(enrichedUser);
        setCurrentOrganizationContext(organizationContext);
        
        console.log('✅ Login successful:', {
          role: enrichedUser.role,
          organization: organizationContext,
          redirectTo,
          visibleColumns: enrichedUser.visibleColumns // ✅ Log to verify
        });
        console.log(res.data)
        
        // Load available organizations for super admin
        if (enrichedUser.role === 'super_admin') {
          await loadAvailableOrganizations();
        }
        
        return { user: enrichedUser, redirectTo };
      } else {
        throw new Error(res.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Load available organizations (super admin only)
  const loadAvailableOrganizations = async () => {
    try {
      const token = sessionManager.getToken();
      if (!token) return;

      const res = await axios.get(`${API_URL}/auth/organizations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.data.success) {
        setAvailableOrganizations(res.data.data);
        console.log('✅ Loaded organizations:', res.data.data.length);
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  // Switch organization context (super admin only)
  const switchOrganization = async (organizationIdentifier) => {
    try {
      const token = sessionManager.getToken();
      if (!token) throw new Error('No authentication token');

      const res = await axios.post(`${API_URL}/auth/switch-organization`, 
        { organizationIdentifier }, 
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (res.data.success) {
        const { token: newToken, expiresIn, organizationContext } = res.data;
        
        // Update session with new token and context
        sessionManager.setSession(newToken, currentUser, expiresIn, organizationContext);
        setCurrentOrganizationContext(organizationContext);
        
        console.log('✅ Switched organization context:', organizationContext);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Organization switch error:', err);
      setError(err.response?.data?.message || 'Failed to switch organization');
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const token = sessionManager.getToken();
      if (token) {
        await axios.post(`${API_URL}/auth/logout`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      sessionManager.clearSession();
      setCurrentUser(null);
      setCurrentOrganizationContext(null);
      setAvailableOrganizations([]);
      console.log('✅ Logged out successfully');
    }
  };

  // Check authentication status
  const isAuthenticated = () => {
    return sessionManager.isAuthenticated();
  };

  // Get dashboard route based on role
 // Add this method to your useAuth hook if it doesn't exist
const getDashboardRoute = () => {
    if (!currentUser?.role) return '/login';
    
    switch (currentUser.role) {
        case 'super_admin':
            return '/superadmin/dashboard';
        case 'admin':
            return '/admin/dashboard';
        case 'owner':
            return '/owner/dashboard';
        case 'lab_staff':
            return '/lab/dashboard';
        case 'doctor_account':
            return '/doctor/dashboard';
        // ✅ NEW ROLE ROUTES
        case 'group_id':
            return '/group/dashboard';
        case 'assignor':
            return '/assignor/dashboard';
        case 'radiologist':
            return '/radiologist/dashboard';
        case 'verifier':
            return '/verifier/dashboard';
        case 'physician':
            return '/physician/dashboard';
        case 'receptionist':
            return '/receptionist/dashboard';
        case 'billing':
            return '/billing/dashboard';
        case 'typist':
            return '/typist/dashboard';
        case 'dashboard_viewer':
            return '/dashboard/viewer';
        default:
            return '/dashboard';
    }
};

  // Check if user has specific permission
  const hasPermission = (permission) => {
    return currentUser?.permissions?.[permission] || false;
  };

  // Check if user has specific role
  const hasRole = (roles) => {
    if (typeof roles === 'string') roles = [roles];
    return roles.includes(currentUser?.role);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      loading, 
      error,
      availableOrganizations,
      currentOrganizationContext,
      login, 
      logout, 
      isAuthenticated,
      loadAvailableOrganizations,
      switchOrganization,
      getDashboardRoute,
      hasPermission,
      hasRole,
      setError
    }}>
      {children}
    </AuthContext.Provider>
  );
};