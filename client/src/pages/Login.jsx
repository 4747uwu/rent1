import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Eye, EyeOff, Mail, Lock, AlertCircle, Loader, 
  Shield, Activity 
} from 'lucide-react';
// import ColorBends from '../creative/maxColor';

const LoginPage = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login, error, isAuthenticated, getDashboardRoute, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated()) {
      const dashboardRoute = getDashboardRoute();
      const from = location.state?.from || dashboardRoute;
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state, getDashboardRoute]);

  useEffect(() => {
    if (error) setError(null);
  }, [formData, setError]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { username, password } = formData;
      if (!username.trim() || !password.trim()) throw new Error('Please provide both username and password');
      
      // Append @bharatpacs.com if no @ is provided
      const loginEmail = username.includes('@') ? username.trim() : `${username.trim()}@bharatpacs.com`;
      
      const { user, redirectTo } = await login(loginEmail, password);
      console.log('✅ Login successful:', { role: user.role, email: user.email });
      
      const from = location.state?.from || redirectTo || getDashboardRoute();
      navigate(from, { replace: true });

    } catch (err) {
      console.error('❌ Login failed:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans text-gray-900 overflow-hidden">
      
      {/* ================= LEFT SIDE (Form) ================= */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center items-center p-8 lg:p-12 relative z-20 bg-white shadow-2xl">
        
        <div className="w-full max-w-sm space-y-8">
          
          {/* Mobile Logo View (Only visible on small screens) */}
          <div className="lg:hidden flex justify-center mb-6">
             <img src="/bharat.png" alt="Bharat PACS" className="h-16 w-16 object-contain" />
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Enter your credentials to access the secure Radiology Information System.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              
              {/* Username */}
              <div>
                <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="john"
                    className="block w-full pl-10 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm bg-gray-50 hover:bg-white hover:border-gray-300"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm bg-gray-50 hover:bg-white hover:border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                    Forgot Password?
                  </a>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 border border-red-100 flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                <span className="text-sm text-red-700 font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white transition-all transform hover:-translate-y-0.5 ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 hover:bg-gray-800 hover:shadow-lg'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <Loader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Authenticating...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
              <Shield className="h-3 w-3" />
              <span>HIPAA Compliant • ISO 27001 Certified</span>
            </div>
            {/* <p className="mt-4 text-center text-[10px] text-gray-300">
              © 2026 Bharat PACS. All rights
            </p> */}
            <p className="mt-4 text-center text-[10px] text-gray-300">
              © 2026 RIS Portal. All rights{' '}
              <button 
                onClick={() => navigate('/login2')}
                className="hover:text-gray-400 transition-colors cursor-default"
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }}
              >
                reserved
              </button>
              .
            </p>
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE (Dominant Logo) ================= */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden bg-gray-50 flex-col items-center justify-center">
        
        {/* Animated Background */}
        {/* <div className="absolute inset-0 z-0">
           <ColorBends
            colors={["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#ffffff"]}
            rotation={120}
            speed={0.15}
            scale={1.4}
            frequency={0.8}
            warpStrength={0.6}
            transparent
          />
        </div> */}

        {/* Decorative Big Background Icon (Very faint) */}
        <div className="absolute -right-20 -bottom-20 z-0 opacity-[0.03] pointer-events-none">
          <Activity className="w-[600px] h-[600px] text-gray-900" />
        </div>

        {/* Hero Content - Centered & Dominant */}
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center w-full max-w-2xl">
          
          {/* Glass Effect Card behind logo for pop */}
          <div className="bg-white/30 backdrop-blur-md border border-white/50 rounded-[3rem] p-12 shadow-[0_8px_32px_rgba(0,0,0,0.05)] mb-8 transform hover:scale-105 transition-transform duration-500 ease-out">
            <img 
              src="/bharatHalf.png" 
              alt="Bharat PACS Logo" 
              className="w-96 h-96 lg:w-96 lg:h-96 object-contain drop-shadow-xl"
            />
          </div>

          <h1 className="text-5xl font-black text-gray-900 tracking-tight drop-shadow-sm mb-4">
            Bharat PACS
          </h1>
          
          <p className="text-xl text-gray-600 font-medium max-w-lg leading-relaxed">
            Next-Generation Cloud Imaging
          </p>
          
          {/* Minimalist Feature Tags */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
             <span className="px-4 py-1.5 bg-white/60 backdrop-blur border border-white/40 rounded-full text-xs font-semibold text-gray-600 shadow-sm">
               DICOM 3.0
             </span>
             <span className="px-4 py-1.5 bg-white/60 backdrop-blur border border-white/40 rounded-full text-xs font-semibold text-gray-600 shadow-sm">
               AI Analysis
             </span>
             <span className="px-4 py-1.5 bg-white/60 backdrop-blur border border-white/40 rounded-full text-xs font-semibold text-gray-600 shadow-sm">
               Cloud Native
             </span>
          </div>

        </div>

      </div>

    </div>
  );
};

export default LoginPage;