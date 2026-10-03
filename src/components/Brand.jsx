import { BRAND } from '../lib/brand'

// Qalam brand: a pen nib resting on a gold writing line, on deep ink-teal.
export function BrandMark({ size = 44, className = '' }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="qalam-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f8a80" />
          <stop offset="1" stopColor="#0a3533" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#qalam-bg)" />
      <path d="M256 392 L168 246 Q168 168 256 108 Q344 168 344 246 Z" fill="#fbf7ee" />
      <path d="M256 392 L256 252" stroke="#145a55" strokeWidth="12" strokeLinecap="round" />
      <circle cx="256" cy="236" r="20" fill="#145a55" />
      <rect x="150" y="410" width="212" height="16" rx="8" fill="#f2b544" />
    </svg>
  );
}

export function Wordmark({ subtitle, size = 'md', light = false }) {
  if (size !== 'lg') {
    return (
      <span className="inline-flex items-center gap-2.5 min-w-0">
        <BrandMark size={36} />
        <span className="min-w-0 leading-tight">
          <span className={`block font-extrabold text-xl tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>{BRAND.name}</span>
          {subtitle && <span className={`block text-xs font-medium truncate -mt-0.5 ${light ? 'text-brand-100' : 'text-slate-500'}`}>{subtitle}</span>}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-center gap-4 text-center">
      <BrandMark size={84} className="drop-shadow-lg" />
      <span className="leading-none">
        <span className={`block font-extrabold text-4xl tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>{BRAND.name}</span>
        {subtitle && <span className={`block font-medium text-base mt-2 ${light ? 'text-brand-100' : 'text-slate-500'}`}>{subtitle}</span>}
      </span>
    </span>
  );
}
