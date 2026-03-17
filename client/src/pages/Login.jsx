import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Eye, EyeOff, Mail, Lock, AlertCircle, Loader,
  Shield, Activity, Cloud, Lock as LockIcon, CheckCircle2
} from 'lucide-react';

/* ── Inject keyframes once ── */
const injectStyles = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const s = document.createElement('style');
    s.textContent = `
      @keyframes radx-up   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      @keyframes radx-float{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      .radx-up { animation: radx-up .65s cubic-bezier(.22,1,.36,1) both; }
      .radx-d1{animation-delay:.08s} .radx-d2{animation-delay:.16s} .radx-d3{animation-delay:.24s}
    `;
    document.head.appendChild(s);
  };
})();

/* ── Minimalist Background ── */
const ProfessionalBg = () => (
  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-slate-50">
    {/* Geometric accents */}
    <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-50/50 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3" />
    <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-sky-50/50 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3" />
    
    {/* Subtle grid pattern */}
    <div className="absolute inset-0" style={{ 
      backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
      backgroundSize: '32px 32px',
      opacity: 0.4
    }} />
  </div>
);

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login, error, isAuthenticated, getDashboardRoute, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    if (isAuthenticated()) {
      const dashboardRoute = getDashboardRoute();
      const from = location.state?.from || dashboardRoute;
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state, getDashboardRoute]);

  useEffect(() => { if (error) setError(null); }, [formData, setError]);

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
      
      const loginEmail = email.includes('@') ? email.trim() : `${email.trim()}@bharatpacs.com`;
      
      const { user, redirectTo } = await login(loginEmail, password);
      const from = location.state?.from || redirectTo || getDashboardRoute();
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login failed:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Brand colors derived from Radx1 logo ── */
  const T = {
    navy: '#0f172a', // Dark slate blue (matches RAD part)
    blue: '#0ea5e9', // Bright light blue (matches X1 part)
    grayBg: '#f8fafc',
    border: '#e2e8f0',
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center overflow-hidden font-sans text-slate-800 bg-white">
      <ProfessionalBg />

      {/* ── Top brand line ── */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-800 to-sky-500 z-50" />

      {/* ════ MAIN CONTENT ════ */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-0">

        {/* ═══ LEFT — HERO / VALUE PROP ═══ */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center lg:items-start text-center lg:text-left pr-0 lg:pr-12">
          <div className="radx-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-sky-600 text-xs font-bold tracking-wide uppercase mb-6 border border-blue-100 shadow-sm">
              <Activity className="w-4 h-4" /> Cloud PACS Platform
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
              Next-Generation
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-sky-500">
                Diagnostic Imaging
              </span>
            </h1>
            
            <p className="text-base lg:text-lg text-slate-600 mb-10 max-w-md mx-auto lg:mx-0 leading-relaxed font-medium">
              A professional suite for high-performance radiology. Secure, ultra-fast, and accessible from anywhere.
            </p>

            {/* Feature Highlights */}
            <div className="hidden lg:grid grid-cols-1 gap-5">
              {[
                { icon: Cloud, title: "Zero-Footprint Viewer", desc: "Access high-resolution DICOM instantly." },
                { icon: LockIcon, title: "Enterprise Security", desc: "End-to-end encryption & HIPAA compliance." },
                { icon: CheckCircle2, title: "Streamlined Workflow", desc: "Optimized for radiologists and reporting." },
              ].map((ft, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white shadow flex items-center justify-center text-sky-500">
                    <ft.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{ft.title}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">{ft.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT — LOGIN FORM ═══ */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center pl-0 lg:pl-12 relative">
          
          <div className="radx-up radx-d1 w-full max-w-md mx-auto bg-white p-8 lg:p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100">
            
            {/* Form Logo */}
            <div className="flex justify-center mb-8">
              <img 
                src="/rent.jpeg" 
                alt="RADX1 Logo" 
                className="h-14 w-auto object-contain drop-shadow-sm"
              />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to your account</h2>
              <p className="text-sm text-slate-500 mt-2">Enter your credentials to access RADX1</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Username / Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                  </div>
                  <input
                    id="email" name="email" type="text" autoComplete="username" required
                    value={formData.email} onChange={handleInputChange}
                    placeholder="doctor@hospital.com"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all hover:bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                  </div>
                  <input
                    id="password" name="password" type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password" required
                    value={formData.password} onChange={handleInputChange}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all hover:bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <a href="#" className="text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors">
                    Forgot details?
                  </a>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="rounded-lg bg-red-50 p-3 flex items-start border border-red-100">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-red-700 font-medium">{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit" disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <Loader className="animate-spin -ml-1 mr-2 h-4 w-4" /> Signing in...
                  </span>
                ) : 'Secure Login'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              HIPAA Compliant · ISO 27001 Certified
            </div>
          </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 py-4 text-center z-20 pointer-events-none">
        <p className="text-xs font-medium text-slate-400">
          © {new Date().getFullYear()} RADX1. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;