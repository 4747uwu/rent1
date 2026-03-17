import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Eye, EyeOff, Mail, Lock, AlertCircle, Loader, 
  Shield, Activity 
} from 'lucide-react';
// import ColorBends from '../creative/maxColor';

const Login2Page = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
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
      const { email, password } = formData;
      if (!email.trim() || !password.trim()) throw new Error('Please provide both email and password');
      
      const { user, redirectTo } = await login(email.trim(), password);
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
              Access the most advanced Cloud-Native PACS ecosystem for modern radiology.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="radiologist@hospital.com"
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
            <p className="mt-4 text-center text-[10px] text-gray-300">
              © 2026 Bharat PACS. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE (Branded Bharat PACS) ================= */}
      <div className="hidden lg:flex lg:w-[60%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex-col items-center justify-center">
        
        {/* Advanced Animated Background with ColorBends */}
        {/* <div className="absolute inset-0 z-0">
           <ColorBends
            colors={["#0f172a", "#1e3a8a", "#1e40af", "#3b82f6", "#60a5fa", "#93c5fd"]}
            rotation={320}
            speed={0.12}
            scale={1.2}
            frequency={0.95}
            warpStrength={0.865}
            mouseInfluence={0.6}
            parallax={1.9}
            noise={0.03}
            transparent={true}
          />
        </div> */}

        {/* Gradient Overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20 z-[1]"></div>

        {/* Decorative Grid Pattern */}
        {/* <div className="absolute inset-0 z-[2] opacity-[0.03]" 
             style={{
               backgroundImage: `
                 linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                 linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
               `,
               backgroundSize: '50px 50px'
             }}>
        </div> */}

        {/* Hero Content - Centered & Dominant */}
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center w-full max-w-2xl">
          
          {/* Premium Glass Card with Logo */}
          {/* <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[3rem] p-14 shadow-[0_20px_80px_rgba(0,0,0,0.3)] mb-10 transform hover:scale-105 transition-all duration-700 ease-out hover:shadow-[0_30px_100px_rgba(59,130,246,0.4)]">
            <img 
              src="/bharat.png" 
              alt="Bharat PACS Logo" 
              className="w-72 h-72 lg:w-80 lg:h-80 object-contain drop-shadow-2xl filter brightness-110"
            />
          </div> */}

          <h1 className="text-6xl font-black text-black tracking-tight drop-shadow-2xl mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white">
            XCENTIC PACS
          </h1>
          
          <p className="text-2xl text-blue-100 font-semibold max-w-xl leading-relaxed drop-shadow-lg mb-2">
            Next-Generation Cloud Imaging
          </p>
          
          <p className="text-sm text-blue-200/80 max-w-lg leading-relaxed drop-shadow mb-8">
            Enterprise-grade DICOM infrastructure with AI-powered workflows, 
            zero-footprint viewers, and global CDN distribution.
          </p>
          
          {/* Premium Feature Pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-3 mb-8">
             <span className="px-5 py-2 bg-white/15 backdrop-blur-md border border-white/30 rounded-full text-xs font-bold text-white shadow-lg hover:bg-white/20 transition-all">
               🔒 AES-256 Encrypted
             </span>
             <span className="px-5 py-2 bg-white/15 backdrop-blur-md border border-white/30 rounded-full text-xs font-bold text-white shadow-lg hover:bg-white/20 transition-all">
               ⚡ Sub-50ms Latency
             </span>
             <span className="px-5 py-2 bg-white/15 backdrop-blur-md border border-white/30 rounded-full text-xs font-bold text-white shadow-lg hover:bg-white/20 transition-all">
               🤖 AI Analysis Ready
             </span>
             <span className="px-5 py-2 bg-white/15 backdrop-blur-md border border-white/30 rounded-full text-xs font-bold text-white shadow-lg hover:bg-white/20 transition-all">
               ☁️ Multi-Cloud Native
             </span>
             <span className="px-5 py-2 bg-white/15 backdrop-blur-md border border-white/30 rounded-full text-xs font-bold text-white shadow-lg hover:bg-white/20 transition-all">
               📊 Real-Time Analytics
             </span>
          </div>

          {/* Tech Stack Badges */}
          <div className="flex items-center justify-center gap-4 text-xs text-black font-medium mt-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              DICOM 3.0 Compliant
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              HL7 FHIR Integrated
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              99.99% Uptime SLA
            </span>
          </div>

        </div>

        {/* Bottom Watermark */}
        <div className="absolute bottom-8 left-0 right-0 z-10 text-center">
          <p className="text-xs text-blue-200/40 font-medium tracking-wider">
            POWERED BY XCENTIC × CODINGWODING
          </p>
        </div>

      </div>

    </div>
  );
};

export default Login2Page;