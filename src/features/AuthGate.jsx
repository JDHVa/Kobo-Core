import React, { useState } from 'react';
import { Icon, fieldCls, lblCls } from '../components/ui';
import { authSignIn, authSignUp } from '../lib/db';
import { MASTER_KEYS } from '../config';

// Pantalla de login: con RLS activado, sin sesión no hay datos.
// Registro abierto pero protegido por clave maestra (una por equipo).
export function AuthGate({ children, session, authReady }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [masterKey, setMasterKey] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  if (!authReady) {
    return <div className="grid min-h-screen place-items-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-steel-300 border-t-steel-700"/></div>;
  }
  if (session) return children;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await authSignIn(email.trim(), password);
        if (error) throw error;
      } else {
        // Validar clave maestra → determina el equipo
        const team = MASTER_KEYS[masterKey.trim()];
        if (!team) throw new Error('Clave maestra incorrecta. Pídela a alguien de tu equipo.');
        if (!name.trim()) throw new Error('Escribe tu nombre.');
        const { data, error } = await authSignUp(email.trim(), password, { display_name: name.trim(), team });
        if (error) throw error;
        if (!data.session) setInfo('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.');
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : err.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in rounded-3xl border border-steel-200 bg-white p-7 shadow-lift">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-steel-800 text-white shadow-soft"><Icon name="wrench" size={26}/></span>
          <h1 className="font-display text-2xl font-bold text-ink">Taller</h1>
          <p className="text-sm text-ink-mute">
            {mode === 'signin' ? 'Inicia sesión para acceder al inventario.' : 'Crea tu cuenta con la clave maestra de tu equipo.'}
          </p>
        </div>

        {error && <div className="mb-3 flex items-center gap-2 rounded-xl bg-clay-100 px-3 py-2.5 text-sm font-medium text-clay-600"><Icon name="alert-circle" size={16}/> {error}</div>}
        {info && <div className="mb-3 flex items-center gap-2 rounded-xl bg-sage-100 px-3 py-2.5 text-sm font-medium text-sage-600"><Icon name="mail" size={16}/> {info}</div>}

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className={lblCls}>Tu nombre</label>
              <input required className={fieldCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Jesús Daniel" autoFocus/>
            </div>
          )}
          <div>
            <label className={lblCls}>Correo</label>
            <input type="email" required className={fieldCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@gmail.com" autoFocus={mode==='signin'}/>
          </div>
          <div>
            <label className={lblCls}>Contraseña</label>
            <input type="password" required minLength={6} className={fieldCls} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
          </div>
          {mode === 'signup' && (
            <div>
              <label className={lblCls}>Clave maestra del equipo</label>
              <input required className={fieldCls} value={masterKey} onChange={e => setMasterKey(e.target.value)} placeholder="La clave que te dio tu equipo"/>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-steel-800 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-steel-900 disabled:opacity-50">
            {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/> : <Icon name={mode === 'signin' ? 'log-in' : 'user-plus'} size={16}/>}
            {mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <button onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setInfo(''); }}
          className="mt-4 w-full text-center text-sm font-medium text-steel-600 hover:text-steel-800">
          {mode === 'signin' ? '¿Sin cuenta? Regístrate con la clave del equipo' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  );
}
