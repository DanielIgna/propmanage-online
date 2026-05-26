// Unified user management: list, filter, edit, ban
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Search, Download, Edit2, Ban, CheckCircle2, X } from "lucide-react";
import { AdminCard, AdminBtn } from "./AdminLayoutMetronic";
import { API } from "../DashShared";

const EditUserModal = ({ user, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: user.name || "",
    email: user.email || "",
    role: user.role || "client",
    verified: !!user.verified,
    tier: user.tier || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/admin/users/${user.id}`, form);
      onSaved();
      onClose();
    } catch (e) {
      alert(e?.response?.data?.detail || "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6" onClick={e => e.stopPropagation()} data-testid="edit-user-modal">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Editare user</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nume</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" data-testid="edit-user-name" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Email</label>
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" data-testid="edit-user-email" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Rol</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" data-testid="edit-user-role">
              <option value="client">Client</option>
              <option value="specialist">Specialist</option>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Tier</label>
            <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" data-testid="edit-user-tier">
              <option value="">— niciun tier —</option>
              <option value="ENTRY">ENTRY</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="PREMIUM">PREMIUM</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.verified} onChange={e => setForm({ ...form, verified: e.target.checked })} data-testid="edit-user-verified" />
            <span className="text-sm">Verificat ✓</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <AdminBtn variant="secondary" onClick={onClose}>Anulează</AdminBtn>
          <AdminBtn onClick={save} disabled={saving} data-testid="edit-user-save">{saving ? "Se salvează..." : "Salvează"}</AdminBtn>
        </div>
      </div>
    </div>
  );
};

export const AdminUsers = () => {
  const [data, setData] = useState({ items: [], total: 0 });
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [skip, setSkip] = useState(0);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const params = { skip, limit: 25 };
    if (q) params.q = q;
    if (role) params.role = role;
    axios.get(`${API}/admin/users`, { params })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [skip, role]);

  const onSearch = (e) => { e.preventDefault(); setSkip(0); load(); };

  const ban = async (uid, banned) => {
    if (!window.confirm(banned ? "Reactivează acest user?" : "Banează acest user?")) return;
    await axios.post(`${API}/admin/users/${uid}/${banned ? "unban" : "ban"}`);
    load();
  };

  const exportCsv = () => {
    window.open(`${API}/admin/export/users.csv`, "_blank");
  };

  return (
    <div className="space-y-4">
      <AdminCard>
        <div className="flex flex-wrap gap-3 items-center">
          <form onSubmit={onSearch} className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Caută după nume sau email..."
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              data-testid="users-search-input"
            />
          </form>
          <select value={role} onChange={e => { setRole(e.target.value); setSkip(0); }} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="users-role-filter">
            <option value="">Toate rolurile</option>
            <option value="client">Client</option>
            <option value="specialist">Specialist</option>
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
          <AdminBtn variant="secondary" onClick={exportCsv} data-testid="users-export-csv">
            <Download className="w-3.5 h-3.5 inline mr-1.5" /> CSV
          </AdminBtn>
        </div>
      </AdminCard>

      <AdminCard testid="users-table-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Nume</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Email</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Rol</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Tier</th>
                <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Wallet</th>
                <th className="text-center py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-500">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(u => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30" data-testid={`user-row-${u.id}`}>
                  <td className="py-2.5 px-3 font-medium">{u.name || "—"}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                  <td className="py-2.5 px-3">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{u.role}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {u.tier && <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${u.tier === "VERIFIED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : u.tier === "PREMIUM" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-800"}`}>{u.tier}</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{Number(u.wallet_balance || 0).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-center">
                    {u.banned ? (
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">Banned</span>
                    ) : u.verified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button onClick={() => setEditing(u)} className="text-blue-600 hover:text-blue-700 dark:text-blue-400 mr-2" title="Editare" data-testid={`edit-user-${u.id}`}>
                      <Edit2 className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => ban(u.id, u.banned)} className={u.banned ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"} title={u.banned ? "Unban" : "Ban"} data-testid={`ban-user-${u.id}`}>
                      <Ban className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && data.items.length === 0 && (
                <tr><td colSpan="7" className="text-center py-8 text-slate-500">Niciun user găsit</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-4 mt-2 text-sm">
          <div className="text-slate-500">Total: {data.total}</div>
          <div className="flex gap-2">
            <AdminBtn variant="secondary" onClick={() => setSkip(Math.max(0, skip - 25))} disabled={skip === 0}>← Anterior</AdminBtn>
            <AdminBtn variant="secondary" onClick={() => setSkip(skip + 25)} disabled={skip + 25 >= data.total}>Următor →</AdminBtn>
          </div>
        </div>
      </AdminCard>

      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
};
