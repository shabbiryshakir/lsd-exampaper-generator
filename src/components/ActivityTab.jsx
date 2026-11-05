import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import Icon from './Icon'

const ago = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (!isFinite(s)) return '—';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
const when = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const LABEL = {
  open: 'Opened the app', app_installed: 'Installed the app', notification_permission: 'Notifications',
  lisan_convert: 'Converted English → Lisan', lisan_typing: 'Typed English → Lisan', converter_open: 'Opened the English → LSD converter',
  converter_copy: 'Copied from the converter', word_added: 'Added a word to the dictionary',
};

// Live view: who is online now, what people did recently, and how the English → Lisan tools and dictionary are used.
export default function ActivityTab() {
  const [presence, setPresence] = useState([]);
  const [events, setEvents] = useState([]);
  const [dict, setDict] = useState([]);
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    const fail = (e) => setError(e?.code === 'permission-denied' ? 'Publish the latest firestore.rules in the Firebase console (Firestore Database → Rules) to see activity.' : 'Could not load activity.');
    const a = onSnapshot(collection(db, 'presence'), (s) => setPresence(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail);
    const b = onSnapshot(query(collection(db, 'events'), orderBy('ts', 'desc'), limit(500)), (s) => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))), fail);
    const c = onSnapshot(collection(db, 'lisanWords'), (s) => setDict(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''))), () => {});
    const t = setInterval(() => tick(n => n + 1), 30000);
    return () => { a(); b(); c(); clearInterval(t); };
  }, []);

  const v = useMemo(() => {
    const now = Date.now(), live = (x) => now - new Date(x.lastSeen || 0).getTime();
    const online = presence.filter(p => live(p) < 150000);
    const recent = presence.filter(p => live(p) >= 150000).sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
    const use = events.filter(e => ['lisan_convert', 'lisan_typing', 'converter_copy'].includes(e.type));
    const top = {};
    events.filter(e => e.type === 'lisan_typing').forEach(e => (e.data?.words || []).forEach(([en]) => { top[en] = (top[en] || 0) + 1; }));
    return {
      online, recent, use,
      useUsers: new Set(use.map(e => e.userId)).size,
      opened: events.filter(e => e.type === 'converter_open').length,
      today: events.filter(e => e.type === 'open' && now - new Date(e.at).getTime() < 86400000).length,
      installed: presence.filter(p => p.installed).length,
      notif: presence.filter(p => p.notifications === 'granted').length,
      blocked: presence.filter(p => p.notifications === 'denied').length,
      notAsked: presence.filter(p => p.installed && p.notifications === 'default').length,
      total: presence.length,
      top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 40),
    };
  }, [presence, events]);

  if (error) return <p className="text-red-600 font-bold p-3">{error}</p>;
  const who = (x) => x.name || x.email || 'Someone';
  return (
    <div className="p-2 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[['Online now', v.online.length], ['Opens today', v.today], ['Teachers seen', v.total], ['Installed app', v.installed], ['Notifications on', v.notif], ['Blocked', v.blocked], ['Installed, not asked yet', v.notAsked]].map(([l, n]) => (
          <div key={l} className="bg-slate-50 rounded-2xl p-3"><div className="text-2xl font-extrabold text-slate-900">{n}</div><div className="text-xs font-bold text-slate-500">{l}</div></div>))}
      </div>

      <section>
        <h3 className="font-extrabold text-slate-900 mb-1 inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />Online now</h3>
        {v.online.length === 0 && <p className="text-sm text-slate-500">Nobody right now.</p>}
        {v.online.map(p => <div key={p.id} className="text-sm py-1">{who(p)} <span className="text-slate-400">· {p.installed ? 'installed app' : 'browser'}</span></div>)}
        {v.recent.length > 0 && <>
          <h3 className="font-extrabold text-slate-900 mt-3 mb-1">Recently seen</h3>
          {v.recent.slice(0, 15).map(p => <div key={p.id} className="text-sm py-0.5 flex justify-between gap-2"><span className="truncate">{who(p)}</span><span className="text-slate-500 shrink-0">{ago(p.lastSeen)}</span></div>)}
        </>}
      </section>

      <section>
        <h3 className="font-extrabold text-slate-900 mb-1 inline-flex items-center gap-1.5"><Icon name="Languages" />English → Lisan <span className="text-sm font-bold text-slate-500">· {v.use.length} uses by {v.useUsers} teachers · converter opened {v.opened}×</span></h3>
        {v.top.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold text-slate-500 mb-1">Most converted words while typing</div>
            <div className="flex flex-wrap gap-1.5">{v.top.map(([w, n]) => <span key={w} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-sm font-bold">{w}{n > 1 && ` ×${n}`}</span>)}</div>
          </div>)}
        {v.use.slice(0, 40).map(e => (
          <div key={e.id} className="text-sm py-1.5 border-b border-slate-100 last:border-0">
            <div className="text-xs text-slate-500">{who(e)} · {when(e.at)} · {LABEL[e.type]}</div>
            {e.type === 'lisan_typing'
              ? <div dir="auto" className="text-slate-800">{(e.data?.words || []).map(([en, li]) => `${en} → ${li}`).join('   ·   ')}</div>
              : <><div dir="auto" className="text-slate-700 truncate">{e.data?.from}</div><div dir="auto" className="font-bold text-slate-900 truncate">{e.data?.to}</div></>}
          </div>))}
      </section>

      <section>
        <h3 className="font-extrabold text-slate-900 mb-1">Words teachers added to the dictionary <span className="text-sm font-bold text-slate-500">· {dict.length}</span></h3>
        {dict.length === 0 && <p className="text-sm text-slate-500">None yet.</p>}
        {dict.slice(0, 80).map(x => (
          <div key={x.id} className="text-sm py-1 flex justify-between gap-2"><span><b>{x.id}</b> → <span dir="auto" className="font-bold">{x.lisan}</span> <span className="text-slate-500">· {x.byName || 'a teacher'}</span></span><span className="text-slate-500 shrink-0">{x.updatedAt ? when(x.updatedAt) : ''}</span></div>))}
      </section>

      <section>
        <h3 className="font-extrabold text-slate-900 mb-1">Recent activity</h3>
        {events.slice(0, 60).map(e => (
          <div key={e.id} className="text-sm py-1 flex justify-between gap-2"><span className="truncate">{who(e)} — {LABEL[e.type] || e.type}{e.type === 'notification_permission' ? `: ${e.data?.result}` : ''}{e.type === 'word_added' ? `: ${e.data?.en} → ${e.data?.lisan}` : ''}</span><span className="text-slate-500 shrink-0">{when(e.at)}</span></div>))}
      </section>
    </div>
  );
}
