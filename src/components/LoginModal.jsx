import { useState } from 'react';
import { Wrench, Lock, Mail, AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react';
import { signIn } from '../lib/tallerService';

/**
 * LoginModal — Full-screen authentication gate.
 *
 * Shown instead of the full app when there is no active Supabase session.
 * Calls supabase.auth.signInWithPassword via the tallerService signIn() helper.
 *
 * Props:
 *   onLogin {fn} — Called with the Supabase session object on successful login.
 */
export default function LoginModal({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!email.trim() || !password) {
      setError('Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: authErr } = await signIn(email.trim(), password);

      if (authErr) {
        // Map common Supabase auth error messages to user-friendly Spanish
        const msg = authErr.message || '';
        if (msg.toLowerCase().includes('invalid login')) {
          setError('Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.');
        } else if (msg.toLowerCase().includes('network')) {
          setError('Sin conexión a internet. Verifica tu red Wi-Fi o datos móviles.');
        } else if (msg.toLowerCase().includes('email not confirmed')) {
          setError('Cuenta no confirmada. Revisa tu correo para el enlace de verificación.');
        } else {
          setError(`Error de autenticación: ${msg}`);
        }
        console.error('[LoginModal] Supabase signIn error:', authErr);
        return;
      }

      if (data?.session) {
        console.log('[LoginModal] Login successful for:', data.session.user?.email);
        // Clear any unexpected external callback paths or auth hashes
        window.history.replaceState({}, document.title, '/');
        onLogin(data.session);
      }
    } catch (err) {
      console.error('[LoginModal] Unexpected error:', err);
      setError('Error inesperado. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0a0a] p-4">

      {/* ── Background radial glow ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(37,99,235,0.18) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm">

        {/* ── Brand Header ── */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-950/60 mb-4"
            style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #38bdf8 100%)' }}
          >
            <Wrench size={28} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">SANCHEZ</h1>
          <p className="text-sky-400 text-xs font-bold uppercase tracking-[0.18em] mt-0.5">
            Automecánica
          </p>
          <p className="text-slate-500 text-sm mt-3 text-center">
            Acceso exclusivo para personal del taller
          </p>
        </div>

        {/* ── Login Card ── */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

          {/* Cobalt top stripe */}
          <div
            className="h-0.5"
            style={{ background: 'linear-gradient(90deg, #1d4ed8, #38bdf8, #1d4ed8)' }}
          />

          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
              >
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@sanchez.com"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl
                             text-white text-base placeholder-slate-700
                             focus:outline-none focus:border-sky-400 transition-all disabled:opacity-50"
                  style={{ minHeight: '48px', fontSize: '16px' }}
                  onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
                  onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-12 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl
                             text-white text-base placeholder-slate-700
                             focus:outline-none focus:border-sky-400 transition-all disabled:opacity-50"
                  style={{ minHeight: '48px', fontSize: '16px' }}
                  onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
                  onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-1"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-950/50 border border-red-800/50 rounded-xl">
                <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm leading-snug">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 text-white font-black text-base
                         rounded-xl transition active:scale-95 shadow-lg shadow-blue-950/50
                         border border-blue-400/25 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
              style={{
                minHeight: '52px',
                background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)',
              }}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Iniciando sesión…</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-600 mt-5">
          © 2026 Sanchez Automecánica · Acceso restringido al personal autorizado
        </p>
      </div>
    </div>
  );
}
