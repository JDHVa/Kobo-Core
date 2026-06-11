import { useState, useEffect } from 'react';
import { Icon, ModalShell } from '../components/ui';
import { dbFetchTeamMembers, dbSetMemberRole } from '../lib/db';

// Panel de equipo: lista de miembros del taller con su rol.
// Solo el admin puede cambiar roles (el servidor lo refuerza con RLS).
export function TeamPanel({ open, onClose, isAdmin, myId, onToast }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    dbFetchTeamMembers().then(list => { setMembers(list); setLoading(false); });
  }, [open]);

  const changeRole = async (member, role) => {
    if (role === member.role) return;
    const admins = members.filter(m => m.role === 'admin');
    if (member.role === 'admin' && admins.length === 1) {
      onToast?.('Debe quedar al menos un admin en el taller', 'take');
      return;
    }
    const prev = members;
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, role } : m));
    const { error } = await dbSetMemberRole(member.id, role);
    if (error) {
      setMembers(prev);
      onToast?.('No se pudo cambiar el rol', 'take');
    } else {
      onToast?.(`${member.display_name || member.email} ahora es ${role === 'admin' ? 'admin' : 'miembro'}`, 'info');
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Equipo del taller" icon="users">
      <div className="space-y-2 p-5">
        {loading && <p className="py-6 text-center text-sm text-ink-mute">Cargando miembros…</p>}
        {!loading && members.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-mute">
            Sin miembros registrados. Ejecuta <code>supabase/roles.sql</code> en Supabase si aún no lo has hecho.
          </p>
        )}
        {members.map(m => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-steel-200 bg-white px-3.5 py-3 shadow-soft">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${m.role === 'admin' ? 'bg-steel-800 text-white' : 'bg-steel-100 text-steel-600'}`}>
                <Icon name={m.role === 'admin' ? 'shield' : 'user'} size={16}/>
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {m.display_name || m.email}{m.id === myId && <span className="ml-1.5 text-xs font-normal text-ink-mute">(tú)</span>}
                </p>
                <p className="truncate text-xs text-ink-mute">{m.email}</p>
              </div>
            </div>
            {isAdmin ? (
              <select value={m.role} onChange={e => changeRole(m, e.target.value)}
                className="shrink-0 rounded-lg border border-steel-200 bg-white px-2 py-1.5 text-xs font-semibold text-ink-soft outline-none">
                <option value="admin">Admin</option>
                <option value="member">Miembro</option>
              </select>
            ) : (
              <span className="shrink-0 rounded-full bg-steel-100 px-2.5 py-1 text-xs font-semibold text-steel-600">
                {m.role === 'admin' ? 'Admin' : 'Miembro'}
              </span>
            )}
          </div>
        ))}
        {isAdmin && members.length > 0 && (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-steel-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
            <Icon name="info" size={14} className="mt-0.5 shrink-0 text-steel-500"/>
            <p>Los <strong>miembros</strong> pueden agregar materiales y retirar/devolver. Solo los <strong>admin</strong> pueden editar el mapa, eliminar y gestionar roles.</p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
