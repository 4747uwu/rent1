import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Eye, EyeOff, Mail, Lock, AlertCircle, Loader,
  Shield, Users, Zap, Heart, ClipboardCheck, HandHeart
} from 'lucide-react';

/* ── CARES values ── */
const CARES = [
  { letter: 'C', title: 'Collaboration', desc: 'Coordinated diagnostic teams across radiology, pathology, and support.', Icon: Users },
  { letter: 'A', title: 'Agility', desc: 'Evidence-based adoption of new systems after evaluation and training.', Icon: Zap },
  { letter: 'R', title: 'Respect', desc: 'Confidential handling of patient identity, records, and information.', Icon: Shield },
  { letter: 'E', title: 'Empathy', desc: 'Clear guidance with care for elderly and paediatric patients.', Icon: HandHeart },
  { letter: 'S', title: 'Sense of Ownership', desc: 'Every stage monitored, errors documented and corrected internally.', Icon: ClipboardCheck },
];

/* ── Inject keyframes once ── */
const injectStyles = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const s = document.createElement('style');
    s.textContent = `
      @keyframes krsn-up   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      @keyframes krsn-float{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
      @keyframes krsn-drift{ 0%{transform:translate(0,0)} 50%{transform:translate(15px,-10px)} 100%{transform:translate(0,0)} }
      @keyframes krsn-line  { from{stroke-dashoffset:200} to{stroke-dashoffset:0} }
      .krsn-up { animation: krsn-up .65s cubic-bezier(.22,1,.36,1) both; }
      .krsn-d1{animation-delay:.08s} .krsn-d2{animation-delay:.16s} .krsn-d3{animation-delay:.24s}
      .krsn-d4{animation-delay:.32s} .krsn-d5{animation-delay:.40s} .krsn-d6{animation-delay:.48s}
      .krsn-d7{animation-delay:.56s}
    `;
    document.head.appendChild(s);
  };
})();

/* ── DNA / Molecular SVG background ── */
const MedicalBg = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
    <defs>
      {/* Hex / molecular pattern */}
      <pattern id="hex" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
        <path d="M30 0 L60 15 L60 37 L30 52 L0 37 L0 15 Z" fill="none" stroke="rgba(0,154,68,0.04)" strokeWidth="0.5" />
      </pattern>
      {/* Subtle cross pattern (medical) */}
      <pattern id="cross" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M18 10 L22 10 L22 18 L30 18 L30 22 L22 22 L22 30 L18 30 L18 22 L10 22 L10 18 L18 18 Z" fill="rgba(15,43,60,0.015)" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#hex)" />
    <rect width="100%" height="100%" fill="url(#cross)" />

    {/* Decorative connection lines */}
    <line x1="0" y1="50%" x2="18%" y2="50%" stroke="rgba(0,183,194,0.06)" strokeWidth="1" strokeDasharray="4 6" />
    <line x1="82%" y1="50%" x2="100%" y2="50%" stroke="rgba(0,154,68,0.06)" strokeWidth="1" strokeDasharray="4 6" />

    {/* Dot accents */}
    <circle cx="18%" cy="20%" r="2" fill="rgba(0,183,194,0.08)" />
    <circle cx="85%" cy="75%" r="2" fill="rgba(0,154,68,0.08)" />
    <circle cx="10%" cy="80%" r="1.5" fill="rgba(15,43,60,0.06)" />
    <circle cx="90%" cy="15%" r="1.5" fill="rgba(0,183,194,0.06)" />
  </svg>
);

/* ── Floating orbs ── */
const Orbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    <div
      className="absolute rounded-full"
      style={{
        width: 420, height: 420, top: '-8%', right: '-6%',
        background: 'radial-gradient(circle, rgba(0,183,194,0.06) 0%, transparent 70%)',
        animation: 'krsn-drift 18s ease-in-out infinite',
      }}
    />
    <div
      className="absolute rounded-full"
      style={{
        width: 360, height: 360, bottom: '-5%', left: '-4%',
        background: 'radial-gradient(circle, rgba(0,154,68,0.05) 0%, transparent 70%)',
        animation: 'krsn-drift 22s ease-in-out infinite 4s',
      }}
    />
    <div
      className="absolute rounded-full"
      style={{
        width: 200, height: 200, top: '40%', left: '55%',
        background: 'radial-gradient(circle, rgba(15,43,60,0.04) 0%, transparent 70%)',
        animation: 'krsn-drift 16s ease-in-out infinite 8s',
      }}
    />
  </div>
);

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────── */
const Login2Page = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login, error, isAuthenticated, getDashboardRoute, setError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    if (isAuthenticated()) {
      const from = location.state?.from || getDashboardRoute();
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
      const { user, redirectTo } = await login(email.trim(), password);
      const from = location.state?.from || redirectTo || getDashboardRoute();
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login failed:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Brand tokens ── */
  const T = {
    teal: '#00B7C2',
    green: '#009A44',
    navy: '#0F2B3C',
    navyLt: '#1A3E54',
  };

  return (
    <div
      className="min-h-screen w-full relative flex flex-col items-center justify-center overflow-hidden"
      style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        background: `linear-gradient(145deg, #F4FAFB 0%, #F0F8F4 35%, #F5F9FC 65%, #F2FAF6 100%)`,
      }}
    >
      {/* Background layers */}
      <MedicalBg />
      <Orbs />

      {/* ── Thin top accent bar ── */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${T.teal}, ${T.green} 50%, ${T.navy})` }}
      />

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-10 flex flex-col items-center">

        {/* ── LOGO BLOCK ── */}
        <div className="krsn-up text-center mb-8">
          <div className="relative inline-block">
            {/* Soft halo */}
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-30"
              style={{
                background: `radial-gradient(circle, ${T.teal} 0%, transparent 70%)`,
                transform: 'scale(2)',
              }}
            />
            <img
              src="/Krsnaa-Logo-tr.png"
              alt="Krsnaa Diagnostics"
              className="relative h-28 w-auto object-contain"
              style={{ filter: `drop-shadow(0 4px 24px rgba(0,183,194,0.15))` }}
            />
          </div>
        </div>

        {/* ── Main two-column area ── */}
        <div className="w-full flex flex-col lg:flex-row items-stretch gap-0">

          {/* ═══ LEFT — CARES VALUES ═══ */}
          <div className="hidden lg:flex lg:w-[50%] flex-col justify-center pr-12 pl-4">

            <div className="krsn-up krsn-d2 mb-6">
              <p
                className="text-xs font-bold tracking-[0.3em] uppercase"
                style={{ color: T.navy }}
              >
                Our Operating Principles
              </p>
              <div className="mt-2 w-10 h-[2px] rounded-full" style={{ background: T.teal }} />
            </div>

            {/* Value cards */}
            <div className="space-y-3">
              {CARES.map((v, i) => {
                const Icon = v.Icon;
                return (
                  <div
                    key={v.letter}
                    className={`krsn-up krsn-d${i + 3} group flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 cursor-default`}
                    style={{
                      background: 'rgba(255,255,255,0.55)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(15,43,60,0.06)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.85)';
                      e.currentTarget.style.borderColor = 'rgba(0,183,194,0.2)';
                      e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,183,194,0.08)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.55)';
                      e.currentTarget.style.borderColor = 'rgba(15,43,60,0.06)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    {/* Letter badge */}
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm"
                      style={{
                        background: `linear-gradient(135deg, ${T.navy}, ${T.navyLt})`,
                        boxShadow: `0 3px 12px rgba(15,43,60,0.2)`,
                      }}
                    >
                      {v.letter}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold" style={{ color: T.navy }}>{v.title}</h3>
                        <Icon className="w-3.5 h-3.5 opacity-40" style={{ color: T.teal }} />
                      </div>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#5A7A8A' }}>{v.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compliance line */}
            <div className="krsn-up krsn-d7 flex items-center gap-3 mt-8 ml-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#7A9AAA' }}>
                <Shield className="w-3 h-3" style={{ color: T.teal }} />
                HIPAA Compliant
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#7A9AAA' }}>
                <Shield className="w-3 h-3" style={{ color: T.green }} />
                ISO 27001
              </div>
              <span className="text-gray-300">·</span>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#7A9AAA' }}>
                <Shield className="w-3 h-3" style={{ color: T.navy }} />
                NABL Accredited
              </div>
            </div>
          </div>

          {/* ═══ VERTICAL SEPARATOR ═══ */}
          <div className="hidden lg:flex flex-col items-center justify-center py-8">
            <div className="w-[1px] flex-1 rounded-full" style={{ background: `linear-gradient(to bottom, transparent, ${T.teal}33, ${T.green}33, transparent)` }} />
          </div>

          {/* ═══ RIGHT — LOGIN FORM ═══ */}
          <div className="w-full lg:w-[50%] flex flex-col justify-center pl-0 lg:pl-12">

            {/* Form card */}
            <div
              className="krsn-up krsn-d1 w-full max-w-md mx-auto p-8 lg:p-10 rounded-3xl"
              style={{
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(15,43,60,0.06)',
                boxShadow: '0 8px 40px rgba(15,43,60,0.06), 0 1px 3px rgba(15,43,60,0.04)',
              }}
            >
              {/* Mobile logo */}
              <div className="lg:hidden text-center mb-6">
                <img src="/Krsnaa-Logo-tr.png" alt="Krsnaa Diagnostics" className="h-20 w-auto object-contain mx-auto" />
              </div>

              {/* Heading */}
              <div className="mb-8">
                <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: T.navy }}>
                  Welcome Back
                </h1>
                <p className="text-sm mt-1.5" style={{ color: '#7A9AAA' }}>
                  Sign in to Krsnaa's Diagnostic Platform
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5A7A8A' }}>
                    Email Address
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-[17px] w-[17px]" style={{ color: '#A0B4BF' }} />
                    </div>
                    <input
                      id="email" name="email" type="email" autoComplete="email" required
                      value={formData.email} onChange={handleInputChange}
                      placeholder="doctor@hospital.com"
                      className="block w-full pl-12 pr-4 py-3.5 rounded-xl text-sm transition-all duration-200"
                      style={{ border: '1.5px solid rgba(15,43,60,0.1)', background: 'rgba(244,250,251,0.6)', color: T.navy, outline: 'none' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = T.teal;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0,183,194,0.08)`;
                        e.target.style.background = '#fff';
                        e.target.parentElement.querySelector('svg').style.color = T.teal;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(15,43,60,0.1)';
                        e.target.style.boxShadow = 'none';
                        e.target.style.background = 'rgba(244,250,251,0.6)';
                        e.target.parentElement.querySelector('svg').style.color = '#A0B4BF';
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#5A7A8A' }}>
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-[17px] w-[17px]" style={{ color: '#A0B4BF' }} />
                    </div>
                    <input
                      id="password" name="password" type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password" required
                      value={formData.password} onChange={handleInputChange}
                      placeholder="••••••••"
                      className="block w-full pl-12 pr-12 py-3.5 rounded-xl text-sm transition-all duration-200"
                      style={{ border: '1.5px solid rgba(15,43,60,0.1)', background: 'rgba(244,250,251,0.6)', color: T.navy, outline: 'none' }}
                      onFocus={(e) => {
                        e.target.style.borderColor = T.teal;
                        e.target.style.boxShadow = `0 0 0 3px rgba(0,183,194,0.08)`;
                        e.target.style.background = '#fff';
                        e.target.parentElement.querySelector('svg').style.color = T.teal;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(15,43,60,0.1)';
                        e.target.style.boxShadow = 'none';
                        e.target.style.background = 'rgba(244,250,251,0.6)';
                        e.target.parentElement.querySelector('svg').style.color = '#A0B4BF';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors"
                      style={{ color: '#A0B4BF' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = T.navy}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#A0B4BF'}
                    >
                      {showPassword ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-2">
                    <a
                      href="#" className="text-xs font-semibold transition-colors"
                      style={{ color: T.teal }}
                      onMouseEnter={(e) => e.target.style.color = T.navy}
                      onMouseLeave={(e) => e.target.style.color = T.teal}
                    >
                      Forgot Password?
                    </a>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-xl p-3.5 flex items-center" style={{ background: 'rgba(228,0,43,0.06)', border: '1px solid rgba(228,0,43,0.12)' }}>
                    <AlertCircle className="h-4.5 w-4.5 text-red-500 mr-3 flex-shrink-0" />
                    <span className="text-sm text-red-700 font-medium">{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit" disabled={isLoading}
                  className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl font-bold text-white text-sm transition-all duration-200"
                  style={{
                    background: isLoading ? '#B0C4CE' : `linear-gradient(135deg, ${T.navy}, ${T.navyLt})`,
                    boxShadow: isLoading ? 'none' : `0 4px 16px rgba(15,43,60,0.25)`,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(15,43,60,0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    if (!isLoading) e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,43,60,0.25)';
                  }}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <Loader className="animate-spin -ml-1 mr-2 h-4 w-4" /> Authenticating...
                    </span>
                  ) : 'Sign In'}
                </button>
              </form>

              {/* Mobile compliance */}
              <div className="lg:hidden mt-6 pt-5 border-t text-center" style={{ borderColor: 'rgba(15,43,60,0.06)' }}>
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium" style={{ color: '#A0B4BF' }}>
                  <Shield className="w-3 h-3" style={{ color: T.teal }} />
                  HIPAA · ISO 27001 · NABL
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 py-4 text-center">
        <p className="text-[11px] font-medium" style={{ color: '#A0B4BF' }}>
          © 2026 Krsnaa Diagnostics. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login2Page;