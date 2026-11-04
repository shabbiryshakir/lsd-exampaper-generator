import { BRAND } from '../lib/brand'

// LSD Paper Maker mark: a simple exam sheet with "LSD" on it, in the app's calm teal.
export function BrandMark({ size = 44, className = '' }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <rect width="512" height="512" rx="116" fill="#18625d" />
      <path d="M150 88 h160 l62 62 v274 a20 20 0 0 1 -20 20 H150 a20 20 0 0 1 -20 -20 V108 a20 20 0 0 1 20 -20z" fill="#fbf7ee" />
      <path d="M310 88 v46 a16 16 0 0 0 16 16 h46z" fill="#d6f2ed" />
      <text x="251" y="262" textAnchor="middle" fontFamily="'Noto Serif', Georgia, serif" fontWeight="700" fontSize="92" fill="#18625d">LSD</text>
      <rect x="172" y="306" width="168" height="14" rx="7" fill="#7ccfc3" />
      <rect x="172" y="344" width="120" height="14" rx="7" fill="#7ccfc3" />
      <rect x="172" y="382" width="148" height="14" rx="7" fill="#f2b544" />
    </svg>
  );
}

export function Wordmark({ subtitle, size = 'md', light = false }) {
  if (size !== 'lg') {
    return (
      <span className="inline-flex items-center gap-2.5 min-w-0">
        <BrandMark size={36} />
        <span className="min-w-0 leading-tight">
          <span className={`block font-bold text-lg tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>{BRAND.name}</span>
          {subtitle && <span className={`block text-xs font-medium truncate -mt-0.5 ${light ? 'text-brand-100' : 'text-slate-500'}`}>{subtitle}</span>}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-center gap-4 text-center">
      <BrandMark size={84} className="drop-shadow-lg" />
      <span className="leading-none">
        <span className={`block font-bold text-3xl tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>{BRAND.name}</span>
        {subtitle && <span className={`block font-medium text-base mt-2 ${light ? 'text-brand-100' : 'text-slate-500'}`}>{subtitle}</span>}
      </span>
    </span>
  );
}
