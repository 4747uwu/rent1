import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/authContext';
import { useAuth } from './hooks/useAuth';
import ToastConfig from './config/toastConfig';
import LoginPage from './pages/Login';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import AssignerDashboard from './pages/assigner/Dashboard';
import LabDashboard from './pages/lab/Dashboard';
import LabBilling from './pages/lab/LabBilling';
import CreateDoctor from './pages/admin/CreateDoctor';
import CreateLab from './pages/admin/CreateLab';
import CreateUser from './pages/admin/CreateUser';
import UserManagement from './pages/admin/UserManagement';
import GroupIdDashboard from './pages/groupId/dashboard';
import DoctorDashboard from './pages/doctor/dashboard';
import TypistDashboard from './pages/typist/dashboard';
import VerifierDashboard from './pages/verifier/dashboard';
import DoctorTemplates from './pages/doctor/templates';
import OnlineReportingSystemEditMode from './components/OnlineReportingSystem/OnlineReportingSystemeditmode.jsx';
import OnlineReportingSystemWithOHIF from './components/OnlineReportingSystem/OnlineReportingSystemWithOHIF';
import OHIFViewerPage from './pages/doctor/OHIFViewerPage';
import SystemOverview from './pages/admin/SystemOverview';
import BrandingSettings from './pages/admin/BrandingSettings';
import AdminTemplates from './pages/admin/Templates';
import LabBrandingSettings from './pages/lab/LabBrandingSettings';
import Login2Page from './pages/Login2';
import ManageLabs from './pages/admin/ManageLabs';
import BillingModules from './pages/admin/BillingModules';
import TATReport from './pages/admin/TATReport';
import QRStudyDecisionPage from './pages/public/QRStudyDecisionPage';



// Protected Route Component - Updated for multi-role support with better fallback
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, currentUser, getDashboardRoute, loading } = useAuth();

  // ✅ FIX: Wait for auth loading to complete before making decisions
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // ✅ MULTI-ROLE SUPPORT: Check if user has ANY of the allowed roles
  if (allowedRoles.length > 0) {
    // Get user roles - use accountRoles if available, otherwise fallback to role
    const userRoles = (currentUser?.accountRoles && currentUser.accountRoles.length > 0) 
      ? currentUser.accountRoles 
      : [currentUser?.role];
    
    console.log('🔐 [ProtectedRoute] Checking access:', {
      allowedRoles,
      userRoles,
      currentUserRole: currentUser?.role,
      accountRoles: currentUser?.accountRoles
    });
    
    const hasAccess = userRoles.some(role => allowedRoles.includes(role));
    
    if (!hasAccess) {
      console.log('❌ [ProtectedRoute] Access denied, redirecting to dashboard');
      return <Navigate to={getDashboardRoute()} replace />;
    }
    
    console.log('✅ [ProtectedRoute] Access granted');
  }

  return children;
};

// Dashboard placeholder component for roles without implementation yet
const DashboardPlaceholder = ({ title, description, role }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl font-bold text-blue-600">{title.charAt(0)}</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-600 mb-6">{description}</p>
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          Your role: <span className="font-semibold">{role}</span>
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Interface coming soon...
        </p>
      </div>
    </div>
  </div>
);

// App Routes Component
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login2" element={<Login2Page />} />
      <Route path="/qr/:studyId" element={<QRStudyDecisionPage />} />
      
      {/* ✅ SUPER ADMIN ROUTES */}
      <Route 
        path="/superadmin/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ ADMIN ROUTES - Allow admin + super_admin */}
      <Route 
        path="/admin/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      <Route path="/admin/manage-labs" element={
    <ProtectedRoute allowedRoles={['admin', 'super_admin', 'group_id']}>
        <ManageLabs />
    </ProtectedRoute>
} />

      {/* ✅ BILLING MODULES */}
      <Route path="/admin/billing-modules" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
          <BillingModules />
        </ProtectedRoute>
      } />

      <Route path="/admin/tat-report" element={
        <ProtectedRoute allowedRoles={['admin', 'super_admin', 'group_id']}>
          <TATReport />
        </ProtectedRoute>
      } />
      
      {/* ✅ SYSTEM OVERVIEW (Admin / Super Admin) */}
      <Route
        path="/admin/system-overview"
        element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <SystemOverview />
          </ProtectedRoute>
        }
      />
      
      {/* ✅ CREATE DOCTOR - Allow admin, group_id, assignor */}
      <Route 
        path="/admin/create-doctor" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'group_id', 'super_admin', 'assignor']}>
            <CreateDoctor />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ CREATE LAB - Allow admin + super_admin */}
      <Route 
        path="/admin/create-lab" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin', 'group_id']}>
            <CreateLab />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ CREATE USER - Allow admin, group_id, super_admin, assignor */}
      <Route 
        path="/admin/create-user" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'group_id', 'super_admin', 'assignor']}>
            <CreateUser />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ USER MANAGEMENT - Allow admin, super_admin, group_id, assignor */}
      <Route 
        path="/admin/user-management" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin', 'group_id', 'assignor']}>
            <UserManagement />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ ROLE-SPECIFIC DASHBOARD ROUTES WITH MULTI-ROLE SUPPORT */}
      
      {/* Owner Dashboard */}
      <Route 
        path="/owner/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin', 'super_admin']}>
            <DashboardPlaceholder 
              title="Owner Dashboard" 
              description="Organization ownership and management interface"
              role="Owner"
            />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Lab Staff Dashboard - Allow lab_staff + assignor combo */}
      <Route 
        path="/lab/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['lab_staff', 'assignor', 'admin']}>
            <LabDashboard/>
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Lab Billing - Allow lab_staff + admin */}
      <Route 
        path="/lab/billing" 
        element={
          <ProtectedRoute allowedRoles={['lab_staff', 'admin']}>
            <LabBilling/>
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Doctor Account Dashboard - Allow doctor_account, radiologist, verifier combos */}
      <Route 
        path="/doctor/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['doctor_account', 'radiologist', 'verifier', 'assignor']}>
            <DoctorDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Group ID Dashboard */}
      <Route 
        path="/group/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['group_id', 'admin', 'super_admin']}>
            <GroupIdDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Assignor Dashboard - Allow assignor + multi-role combos */}
      <Route 
        path="/assignor/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['assignor', 'radiologist', 'verifier', 'admin']}>
            <AssignerDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Radiologist Dashboard - Allow radiologist + multi-role combos */}
      <Route 
        path="/radiologist/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['radiologist', 'assignor', 'verifier', 'doctor_account']}>
            <DoctorDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Verifier Dashboard - Allow verifier + multi-role combos */}
      <Route 
        path="/verifier/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['verifier', 'assignor', 'radiologist', 'admin']}>
            <VerifierDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Physician Dashboard */}
      <Route 
        path="/physician/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['physician', 'doctor_account', 'radiologist']}>
            <DashboardPlaceholder 
              title="Physician Dashboard" 
              description="Patient reports and clinical decision support"
              role="Physician"
            />
          </ProtectedRoute>
        } 
      />
      
      {/* Receptionist Dashboard */}
      <Route 
        path="/receptionist/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['receptionist', 'admin']}>
            <DashboardPlaceholder 
              title="Receptionist Dashboard" 
              description="Patient registration and appointment management"
              role="Receptionist"
            />
          </ProtectedRoute>
        } 
      />
      
      {/* Billing Dashboard */}
      <Route 
        path="/billing/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['billing', 'admin']}>
            <DashboardPlaceholder 
              title="Billing Dashboard" 
              description="Invoice generation and payment processing"
              role="Billing"
            />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Typist Dashboard - Allow typist + radiologist combo */}
      <Route 
        path="/typist/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['typist', 'radiologist', 'assignor']}>
            <TypistDashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* Dashboard Viewer */}
      <Route 
        path="/dashboard/viewer" 
        element={
          <ProtectedRoute allowedRoles={['dashboard_viewer', 'admin', 'super_admin']}>
            <DashboardPlaceholder 
              title="Dashboard Viewer" 
              description="Read-only analytics and monitoring"
              role="Dashboard Viewer"
            />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ Doctor Templates - Allow all reporting roles */}
      <Route 
        path="/doctor/templates" 
        element={
          <ProtectedRoute allowedRoles={['doctor_account', 'radiologist', 'typist', 'assignor', 'verifier']}>
            <DoctorTemplates />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ FALLBACK DASHBOARD ROUTE */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPlaceholder 
              title="Default Dashboard" 
              description="Generic dashboard interface"
              role="User"
            />
          </ProtectedRoute>
        } 
      />

      {/* ✅ Online Reporting Routes - Allow all reporting roles */}
      <Route 
        path="/online-reporting/:studyId" 
        element={
          <ProtectedRoute allowedRoles={['doctor_account', 'radiologist', 'typist', 'verifier', 'admin', 'assignor']}>
            <OnlineReportingRouteHandler />
          </ProtectedRoute>
        } 
      />
      
      {/* ✅ OHIF full-view route - Allow all roles that can view studies */}
      <Route
        path="/doctor/viewer/:studyId"
        element={
          <ProtectedRoute allowedRoles={['doctor_account', 'radiologist', 'admin', 'assignor', 'verifier']}>
            <OHIFViewerPage />
          </ProtectedRoute>
        }
      />

      <Route 
        path="/admin/templates" 
        element={
          <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
            <AdminTemplates />
          </ProtectedRoute>
        } 
      />
      
      {/* Admin Branding Settings - Allow admin only */}
      <Route 
        path="/admin/branding" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <BrandingSettings />
          </ProtectedRoute>
        } 
      />

      
      
      {/* Lab Branding Settings - Allow lab_staff + admin */}
      <Route 
        path="/lab/branding" 
        element={
          <ProtectedRoute allowedRoles={['lab_staff', 'admin']}>
            <LabBrandingSettings />
          </ProtectedRoute>
        } 
      />
      
      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Catch all - redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

// ✅ Route handler to decide between regular and OHIF versions
const OnlineReportingRouteHandler = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const openOHIF = urlParams.get('openOHIF');
  const isVerifier = urlParams.get('verifier');
  const isVerification = urlParams.get('verification');
  
  console.log('🔀 [Route Handler] URL Parameters:', {
    openOHIF,
    isVerifier,
    isVerification
  });
  
  // Route to OHIF version if verifier mode OR openOHIF is true
  if (openOHIF === 'true' || isVerifier === 'true' || isVerification === 'true') {
    console.log('🖼️ [Route Handler] Loading OnlineReportingSystemWithOHIF');
    return <OnlineReportingSystemWithOHIF />;
  } else {
    console.log('📝 [Route Handler] Loading regular OnlineReportingSystem');
    return <OnlineReportingSystemEditMode />;
  }
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          {/* ✅ ADD: Toast Configuration */}
          <ToastConfig />
          <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
