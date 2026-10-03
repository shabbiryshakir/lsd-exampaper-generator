// LSD brand: the serif "LSD" wordmark (the paper's English typeface) paired with
// لسان الدعوة in Kanz al Marjaan (the paper's LSD typeface), so app and papers read as one family.

export function BrandMark({ size = 44, className = '' }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-[28%] bg-indigo-700 text-white shadow-sm shrink-0 ${className}`} style={{ width: size, height: size }}>
      <span className="font-english font-bold tracking-tight" style={{ fontSize: size * 0.36, lineHeight: 1 }}>LSD</span>
    </span>
  );
}

export function Wordmark({ subtitle, size = 'md' }) {
  if (size !== 'lg') {
    // Compact one-line version for the top bar.
    return (
      <span className="inline-flex items-center gap-2.5 min-w-0">
        <BrandMark size={38} />
        <span className="min-w-0 leading-tight">
          <span className="flex items-baseline gap-2">
            <span className="font-english font-bold text-gray-900 text-xl tracking-tight">LSD</span>
            <span className="font-arabic text-indigo-700 text-lg" dir="rtl">لسان الدعوة</span>
          </span>
          {subtitle && <span className="block text-xs text-gray-500 font-medium truncate -mt-0.5">{subtitle}</span>}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-center gap-3 text-center">
      <BrandMark size={84} />
      <span className="leading-none">
        <span className="block font-english font-bold text-gray-900 text-4xl tracking-tight">LSD</span>
        <span className="block font-arabic text-indigo-700 text-2xl mt-2" dir="rtl">لسان الدعوة</span>
        {subtitle && <span className="block text-gray-500 font-medium text-sm mt-3 uppercase tracking-widest">{subtitle}</span>}
      </span>
    </span>
  );
}
