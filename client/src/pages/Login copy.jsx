import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { 
  Eye, EyeOff, Mail, Lock, AlertCircle, Loader, 
  Shield, Check
} from 'lucide-react';

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

  // CARES Values data
  const caresValues = [
    { 
      letter: 'C', 
      title: 'Collaboration', 
      description: 'Coordinated expertise across radiology, pathology & support teams'
    },
    { 
      letter: 'A', 
      title: 'Agility', 
      description: 'Evidence-driven innovation with continuous staff development'
    },
    { 
      letter: 'R', 
      title: 'Respect', 
      description: 'Patient confidentiality and professional excellence'
    },
    { 
      letter: 'E', 
      title: 'Empathy', 
      description: 'Clear communication and care for vulnerable patients'
    },
    { 
      letter: 'S', 
      title: 'Sense of Ownership', 
      description: 'Quality monitoring and continuous improvement'
    }
  ];

  return (
    <div className="min-h-screen flex bg-white font-sans text-gray-900 overflow-hidden relative">
      
      {/* ================= LEFT SIDE (Form) ================= */}
      <div className="w-full lg:w-[50%] flex flex-col justify-center items-center p-6 sm:p-8 lg:p-16 relative z-20 bg-white">
        
        <div className="w-full max-w-md space-y-12">
          
          {/* ========== LOGO & BRANDING SECTION ========== */}
          <div className="text-center space-y-6">
            
            {/* Krsnaa Logo - ULTRA PROMINENT */}
            <div className="flex justify-center mb-8">
              <div className="relative group">
                {/* Dynamic Glow Effect - Green to Blue */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-400/30 via-cyan-400/30 to-blue-500/30 rounded-full blur-3xl scale-125 opacity-70 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                {/* Logo Container */}
                <img 
                  src="/Krsnaa-Logo-tr.png" 
                  alt="Krsnaa Diagnostics" 
                  className="relative h-40 w-auto object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            </div>

            {/* Main Heading - Maximum Impact */}
            <div className="space-y-3">
              <h1 className="text-5xl sm:text-6xl font-black tracking-tighter">
                <span className="text-gray-900">Krsnaa</span>
                <br />
                <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Diagnostics</span>
              </h1>
              <p className="text-base text-gray-500 font-bold tracking-widest uppercase">
                Let's Do Good
              </p>
            </div>

            {/* Subtitle */}
            <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto pt-3 font-medium">
              Enterprise PACS Platform Built on Trust, Collaboration, and Patient Care
            </p>
          </div>

          {/* ========== LOGIN FORM ========== */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2.5">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400 group-focus-within:text-green-600 transition-colors duration-200" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="doctor@hospital.com"
                    className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm bg-gray-50 hover:bg-white hover:border-gray-300 font-medium"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2.5">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-gray-400 group-focus-within:text-green-600 transition-colors duration-200" />
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
                    className="block w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm bg-gray-50 hover:bg-white hover:border-gray-300 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end mt-2.5">
                  <a href="#" className="text-xs font-bold text-green-700 hover:text-green-900 transition-colors">
                    Forgot Password?
                  </a>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 border-2 border-red-200 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-red-800 font-semibold">{error}</span>
              </div>
            )}

            {/* Submit Button - Gradient Green to Blue */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg font-bold text-white text-base transition-all transform duration-200 ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 hover:-translate-y-1 shadow-lg hover:shadow-2xl'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader className="animate-spin h-5 w-5" />
                  Authenticating...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* ========== SECURITY & FOOTER ========== */}
          <div className="pt-8 border-t-2 border-gray-200 space-y-4">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="font-semibold">HIPAA Compliant • ISO 27001 Certified • AES-256 Encrypted</span>
            </div>
            <p className="text-center text-[11px] text-gray-400 font-medium">
              © 2026 Krsnaa Diagnostics Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE (Hero Section) ================= */}
      <div className="hidden lg:flex lg:w-[50%] relative overflow-hidden flex-col items-center justify-center bg-gradient-to-br from-green-600 via-teal-600 to-blue-700">
        
        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0">
          {/* Gradient Orb - Top Right */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-300/40 to-cyan-300/30 rounded-full blur-3xl mix-blend-screen animate-pulse"></div>
          
          {/* Gradient Orb - Bottom Left */}
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/30 to-teal-400/20 rounded-full blur-3xl mix-blend-screen animate-pulse" style={{ animationDelay: '1s' }}></div>
          
          {/* Subtle Grid */}
          <div className="absolute inset-0 opacity-[0.05]" 
               style={{
                 backgroundImage: `
                   linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                   linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                 `,
                 backgroundSize: '60px 60px'
               }}>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center max-w-2xl space-y-12">
          
          {/* Main Heading */}
          <div className="space-y-4">
            <h2 className="text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
              Precision Diagnostics,<br />
              <span className="text-green-100">Human Touch</span>
            </h2>
            <p className="text-lg text-white/90 leading-relaxed max-w-xl mx-auto font-medium">
              Trusted by 210+ diagnostic centers with enterprise-grade PACS technology and AI-powered insights
            </p>
          </div>

          {/* CARES Values - Prominent Display */}
          <div className="w-full space-y-4">
            <p className="text-sm font-bold text-white/80 uppercase tracking-wider">Our Working Principles</p>
            <div className="grid grid-cols-5 gap-2">
              {caresValues.map((value, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div className="bg-white/15 backdrop-blur-xl border border-white/30 rounded-xl p-4 h-full hover:bg-white/25 transition-all transform hover:-translate-y-1 duration-200">
                    <div className="text-3xl font-black text-white mb-2">{value.letter}</div>
                    <div className="text-xs font-bold text-white/90 leading-tight">{value.title}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/70 text-center italic max-w-md mx-auto mt-4">
              Collaboration • Agility • Respect • Empathy • Sense of Ownership
            </p>
          </div>

          {/* Feature Icons */}
          <div className="flex gap-4 justify-center flex-wrap">
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xl px-4 py-2 rounded-full border border-white/30">
              <Check className="h-4 w-4 text-green-200" />
              <span className="text-sm font-bold text-white">DICOM 3.0</span>
            </div>
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xl px-4 py-2 rounded-full border border-white/30">
              <Check className="h-4 w-4 text-green-200" />
              <span className="text-sm font-bold text-white">HL7 FHIR</span>
            </div>
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-xl px-4 py-2 rounded-full border border-white/30">
              <Check className="h-4 w-4 text-green-200" />
              <span className="text-sm font-bold text-white">AI Analytics</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 w-full">
            <div className="text-center">
              <div className="text-4xl font-black text-green-200 mb-1">210+</div>
              <div className="text-xs text-white/70 uppercase tracking-wider font-bold">Diagnostic Centers</div>
            </div>
            <div className="border-l border-r border-white/20"></div>
            <div className="text-center">
              <div className="text-4xl font-black text-green-200 mb-1">99.99%</div>
              <div className="text-xs text-white/70 uppercase tracking-wider font-bold">Uptime SLA</div>
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="absolute bottom-8 left-0 right-0 z-10 text-center">
          <p className="text-xs text-white/60 font-semibold tracking-wider uppercase">
            Nationwide Pan-India Presence with World-Class Service Standards
          </p>
        </div>
      </div>

    </div>
  );
};

export default Login2Page;