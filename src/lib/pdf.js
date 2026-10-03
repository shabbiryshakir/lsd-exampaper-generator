// Builds an A4 PDF from the rendered preview sheets. Each sheet is captured as an
// image exactly as it appears in the preview, so the PDF is identical on every
// phone and computer (no dependence on the browser's print engine).

// Converts any loaded <img> into a data URL jsPDF can embed.
function imageToDataUrl(img) {
  if (img.src.startsWith('data:image/png') || img.src.startsWith('data:image/jpeg')) return img.src;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

export async function downloadPdf(container, fileName, onProgress) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const sheets = [...container.querySelectorAll('.a4-sheet')];
  const zoomEl = container.closest('.paper-zoom');
  const prevZoom = zoomEl?.style.zoom;
  if (zoomEl) zoomEl.style.zoom = '1';
  await document.fonts?.ready;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  try {
    for (let i = 0; i < sheets.length; i++) {
      onProgress?.(i + 1, sheets.length);
      const sheet = sheets[i];
      const sheetRect = sheet.getBoundingClientRect();
      const mmPerPx = 210 / sheetRect.width;

      // Images (logos, pictures) are placed into the PDF directly rather than through the
      // page snapshot, because phone browsers (Safari especially) often drop them from snapshots.
      const images = [...sheet.querySelectorAll('img')].filter(img => img.complete && img.naturalWidth > 0);
      const placed = images.map(img => {
        const r = img.getBoundingClientRect();
        const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight); // object-contain
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        let data = null;
        try { data = imageToDataUrl(img); } catch { /* cross-origin image: leave it in the snapshot */ }
        return { img, data, x: (r.left - sheetRect.left + (r.width - w) / 2) * mmPerPx, y: (r.top - sheetRect.top + (r.height - h) / 2) * mmPerPx, w: w * mmPerPx, h: h * mmPerPx };
      }).filter(p => p.data);
      placed.forEach(p => { p.img.style.visibility = 'hidden'; });

      const opts = { quality: 0.92, pixelRatio: 2.5, backgroundColor: '#ffffff', style: { boxShadow: 'none', margin: '0' } };
      let shot;
      try {
        // The first capture on Safari sometimes misses web fonts; a warm-up render fixes it.
        if (i === 0) await toJpeg(sheet, { ...opts, pixelRatio: 0.5 });
        shot = await toJpeg(sheet, opts);
      } finally {
        placed.forEach(p => { p.img.style.visibility = ''; });
      }
      if (i > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(shot, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      placed.forEach(p => pdf.addImage(p.data, p.data.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG', p.x, p.y, p.w, p.h));
    }
  } finally {
    if (zoomEl) zoomEl.style.zoom = prevZoom;
  }
  pdf.save(fileName);
}

// Shrinks an uploaded logo so it never bloats saved papers (Firestore documents are limited to 1 MB).
export function resizeImage(file, maxSize = 360, type = 'image/png') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(type, 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
