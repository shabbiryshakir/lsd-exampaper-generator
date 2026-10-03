import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import Icon from './Icon'
import { fromCloud, normalizeHeader } from '../lib/paper'

// Emails that see the admin panel. Firestore rules (firestore.rules → isAdmin) must list the same emails.
export const ADMIN_EMAILS = ['shabbiryshakir@gmail.com'];
export const isAdmin = (user) => !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

const bytesOf = (data) => { try { return new Blob([JSON.stringify(data)]).size; } catch { return 0; } };
const fmtSize = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const dayMs = 86400000;

// Read-only overview of every teacher and paper (same as the admin panel on the live site).
export default function AdminPanel({ onOpenPaper }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setError(''); setData(null);
    try {
      const [ps, us] = await Promise.all([getDocs(collection(db, 'papers')), getDocs(collection(db, 'users'))]);
      const papers = ps.docs.map(d => { const raw = d.data(); return { ...fromCloud({ id: d.id, ...raw }), _bytes: bytesOf(raw) }; })
        .sort((a, b) => new Date(b.lastEdited || 0) - new Date(a.lastEdited || 0));
      const users = us.docs.map(d => { const raw = d.data(); return { id: d.id, ...raw, _bytes: bytesOf(raw) }; });
      setData({ papers, users });
    } catch (e) {
      console.error('Admin fetch error:', e);
      setError(e?.code === 'permission-denied'
        ? 'Firestore rules do not allow admin access yet. Publish the latest firestore.rules in the Firebase console (Firestore Database → Rules).'
        : 'Could not load. Please check your internet connection.');
    }
  };
  useEffect(() => { load(); }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const byUser = new Map();
    const userFor = (id) => {
      if (!byUser.has(id)) byUser.set(id, { id, name: '', email: '', papers: [], bytes: 0, last: 0, school: '' });
      return byUser.get(id);
    };
    data.users.forEach(u => {
      const r = userFor(u.id);
      r.name = u.displayName || u.name || ''; r.email = u.email || ''; r.bytes += u._bytes;
      r.school = u.schoolSettings?.name || u.schoolSettings?.schoolName || '';
      r.last = Math.max(r.last, new Date(u.lastSeen || 0).getTime() || 0);
    });
    data.papers.forEach(p => {
      const r = userFor(p.userId || 'unknown');
      r.papers.push(p); r.bytes += p._bytes;
      if (!r.name) r.name = p.memberInfo?.[p.userId]?.name || p.authorName || '';
      r.last = Math.max(r.last, new Date(p.lastEdited || 0).getTime() || 0);
    });
    const users = [...byUser.values()].sort((a, b) => b.last - a.last);
    const live = data.papers.filter(p => !p.deletedAt);
    const count = (fn) => Object.entries(live.reduce((m, p) => { const k = fn(p); if (k) m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
    return {
      users, live,
      totalBytes: users.reduce((s, u) => s + u.bytes, 0),
      active7: users.filter(u => now - u.last < 7 * dayMs).length,
      new7: live.filter(p => now - new Date(p.createdAt || p.lastEdited || 0).getTime() < 7 * dayMs).length,
      trashed: data.papers.length - live.length,
      shared: live.filter(p => (p.members || []).length > 1).length,
      classes: count(p => normalizeHeader(p.header).className).slice(0, 6),
      langs: count(p => p.layout?.language || 'lsd'),
    };
  }, [data]);

  const q = search.trim().toLowerCase();
  const match = (...xs) => !q || xs.some(x => String(x || '').toLowerCase().includes(q));

  if (error) return <Box><p className="text-red-600 font-bold mb-3">{error}</p><button onClick={load} className="font-bold text-brand-700">Try again</button></Box>;
  if (!view) return <Box><div className="flex items-center gap-2 text-slate-500"><Icon name="Loader2" />Loading everything…</div></Box>;

  const paperRow = (p) => {
    const h = normalizeHeader(p.header);
    const owner = view.users.find(u => u.id === p.userId);
    return (
      <button key={p.id} onClick={() => onOpenPaper(p, owner)} className="w-full text-start flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 border-b border-slate-100 last:border-0">
        <Icon name="FileText" className="text-brand-600" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 truncate" dir="auto">{h.examName || 'Untitled'} — {h.className}</div>
          <div className="text-xs text-slate-500 truncate">{owner?.name || p.authorName || 'Unknown'} · {fmtDate(p.lastEdited)} · {fmtSize(p._bytes)}{p.deletedAt ? ' · in trash' : ''}{(p.members || []).length > 1 ? ` · ${p.members.length} teachers` : ''}</div>
        </div>
        <Icon name="Eye" size={18} className="text-slate-400" />
      </button>
    );
  };

  return (
    <main className="max-w-5xl mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 inline-flex items-center gap-2"><Icon name="ShieldCheck" className="text-brand-700" />Admin</h1>
        <button onClick={load} className="text-sm font-bold text-brand-700 inline-flex items-center gap-1"><Icon name="RotateCcw" size={16} />Refresh</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Teachers" value={view.users.length} hint={`${view.active7} active this week`} />
        <Stat label="Papers" value={view.live.length} hint={`${view.new7} new this week`} />
        <Stat label="Storage used" value={fmtSize(view.totalBytes)} hint="Firestore, all data" />
        <Stat label="Shared papers" value={view.shared} hint={`${view.trashed} in trash`} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <Box title="Top classes">{view.classes.map(([k, n]) => <Bar key={k} label={k} n={n} max={view.classes[0][1]} />)}</Box>
        <Box title="Languages">{view.langs.map(([k, n]) => <Bar key={k} label={k === 'lsd' ? 'Lisan ud Dawat' : k === 'en' ? 'English' : k} n={n} max={view.langs[0][1]} />)}</Box>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[['users', 'Teachers'], ['papers', 'All papers']].map(([k, l]) => <button key={k} onClick={() => { setTab(k); setSelected(null); }} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${tab === k ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>{l}</button>)}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className="flex-1 min-w-[10rem] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-2 mb-10">
        {tab === 'papers' && view.live.concat(data.papers.filter(p => p.deletedAt))
          .filter(p => { const h = normalizeHeader(p.header); return match(h.examName, h.className, p.authorName); }).map(paperRow)}
        {tab === 'users' && !selected && view.users.filter(u => match(u.name, u.email, u.school)).map(u => (
          <button key={u.id} onClick={() => setSelected(u.id)} className="w-full text-start flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 border-b border-slate-100 last:border-0">
            <Icon name="UserRound" className="text-slate-400" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-900 truncate">{u.name || 'Unknown teacher'}</div>
              <div className="text-xs text-slate-500 truncate">{[u.email, u.school].filter(Boolean).join(' · ') || u.id}</div>
            </div>
            <div className="text-end text-xs text-slate-500 shrink-0">
              <div className="font-bold text-slate-800 text-sm">{u.papers.filter(p => !p.deletedAt).length} papers</div>
              <div>{fmtSize(u.bytes)} · {u.last ? fmtDate(u.last) : '—'}</div>
            </div>
          </button>
        ))}
        {tab === 'users' && selected && (() => {
          const u = view.users.find(x => x.id === selected);
          return (
            <>
              <button onClick={() => setSelected(null)} className="p-3 text-sm font-bold text-brand-700 inline-flex items-center gap-1"><Icon name="ArrowLeft" size={16} />All teachers</button>
              <div className="px-3 pb-2"><div className="font-bold text-lg">{u.name || 'Unknown teacher'}</div><div className="text-sm text-slate-500">{u.email} · {fmtSize(u.bytes)}</div></div>
              {u.papers.length ? u.papers.map(paperRow) : <p className="p-3 text-slate-500">No papers yet.</p>}
            </>
          );
        })()}
      </div>
    </main>
  );
}

function Stat({ label, value, hint }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4"><div className="text-xs font-bold text-slate-500">{label}</div><div className="text-2xl font-extrabold text-slate-900 mt-1">{value}</div><div className="text-xs text-slate-500 mt-0.5">{hint}</div></div>;
}
function Box({ title, children }) {
  return <div className="bg-white rounded-2xl border border-slate-200 p-4">{title && <div className="text-xs font-bold text-slate-500 mb-2">{title}</div>}{children}</div>;
}
function Bar({ label, n, max }) {
  return (
    <div className="flex items-center gap-2 text-sm py-1">
      <span className="w-28 truncate" dir="auto">{label}</span>
      <span className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><span className="block h-full bg-brand-600 rounded-full" style={{ width: `${(n / max) * 100}%` }} /></span>
      <span className="w-8 text-end font-bold">{n}</span>
    </div>
  );
}
