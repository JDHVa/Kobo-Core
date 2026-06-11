// ── Configuración de servicios externos ──
// Los valores vienen de .env.local (que NO se sube a git).
// Copia .env.example a .env.local y rellena tus claves.
// ⚠️ Aun así, estas claves terminan en el bundle público de la app
// desplegada: restringe la key de Gemini por dominio en Google Cloud
// Console y mantén las políticas RLS de Supabase activas.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const GEMINI_MODEL = 'gemini-2.0-flash-lite';
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// ── Claves maestras de registro ──
// Cada clave corresponde a UN TALLER: quien se registra con ella queda
// asignado a ese taller y solo ve el inventario de ese taller.
// Se definen en VITE_MASTER_KEYS como JSON: {"CLAVE":"Nombre del taller"}.
// El nombre identifica los datos en la DB: no lo cambies después de
// tener datos, o el taller "perderá" acceso a ellos.
function parseMasterKeys() {
  try { return JSON.parse(import.meta.env.VITE_MASTER_KEYS || '{}'); }
  catch { console.error('VITE_MASTER_KEYS no es JSON válido'); return {}; }
}
export const MASTER_KEYS = parseMasterKeys();
