// Builds an A4 PDF from the rendered preview sheets. Each sheet is captured as an
// image exactly as it appears in the preview, so the PDF is identical on every
// phone and computer (no dependence on the browser's print engine).
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
      const opts = { quality: 0.92, pixelRatio: 2.5, backgroundColor: '#ffffff', style: { boxShadow: 'none', margin: '0' } };
      // The first capture on Safari sometimes misses web fonts; a warm-up render fixes it.
      if (i === 0) await toJpeg(sheets[i], { ...opts, pixelRatio: 0.5 });
      const img = await toJpeg(sheets[i], opts);
      if (i > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
  } finally {
    if (zoomEl) zoomEl.style.zoom = prevZoom;
  }
  pdf.save(fileName);
}

// Shrinks an uploaded logo so it never bloats saved papers (Firestore documents are limited to 1 MB).
export function resizeImage(file, maxSize = 360) {
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
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
