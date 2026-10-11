import Icon from './Icon'
import { ArtHero } from './guide/Art'
import { WHATS_NEW } from '../lib/whatsNew'
import { BRAND } from '../lib/brand'

// The "What's new" window: the newest release as picture-led highlights, older ones as short lists.
// Shown by itself right after signing in (once per version) and from Menu -> What's new.
export default function WhatsNewBody({ onGuide }) {
  const [latest, ...older] = WHATS_NEW;
  return (
    <div>
      <ArtHero />
      <div className="flex items-center gap-2 mt-4 mb-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-brand-700 bg-brand-50 rounded-full px-2.5 py-1">Version {latest.version}</span>
        <span className="text-xs text-slate-500">{latest.date}</span>
      </div>
      <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{latest.title}</h3>
      {latest.intro && <p className="text-slate-600 leading-relaxed mt-1.5 mb-4">{latest.intro}</p>}
      <div className="space-y-2.5">
        {(latest.highlights || []).map(h => (
          <div key={h.title} className="flex gap-3.5 bg-white border border-slate-200 rounded-2xl p-3.5">
            <span className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name={h.icon} size={22} /></span>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 leading-snug">{h.title}</div>
              <p className="text-sm text-slate-600 leading-relaxed mt-0.5">{h.text}</p>
              {h.guide && onGuide && <button type="button" onClick={() => onGuide(h.guide)} className="mt-1.5 text-sm font-bold text-brand-700 inline-flex items-center gap-1">Show me how <Icon name="ArrowRight" size={14} /></button>}
            </div>
          </div>
        ))}
      </div>
      {older.length > 0 && (
        <details className="mt-5 group">
          <summary className="cursor-pointer list-none text-sm font-bold text-slate-500 inline-flex items-center gap-1.5"><Icon name="ChevronRight" size={16} className="transition group-open:rotate-90" />Earlier updates</summary>
          {older.map(rel => (
            <div key={rel.version} className="mt-4">
              <div className="font-extrabold text-slate-900">{rel.title || `Version ${rel.version}`} <span className="text-sm font-medium text-slate-500">· Version {rel.version}</span></div>
              <ul className="space-y-2 mt-2">{rel.items.map(it => <li key={it} className="flex gap-2.5 text-sm text-slate-700"><span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center mt-0.5 shrink-0"><Icon name="Check" size={12} strokeWidth={3} /></span>{it}</li>)}</ul>
            </div>
          ))}
        </details>
      )}
      <p className="text-xs text-slate-400 mt-5 text-center">{BRAND.name} · thank you for using it and for telling us how to make it better.</p>
    </div>
  );
}
