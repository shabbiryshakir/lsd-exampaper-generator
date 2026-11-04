// Shrinks an uploaded logo so it fits comfortably inside a Firestore document (1 MB limit) and
// prints sharply. Returns a data URL.
export const compressImage = (file, maxSide = 400) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('Could not read the image file.'))
  reader.onload = () => {
    const img = new Image()
    img.onerror = () => reject(new Error('This file is not a valid image.'))
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      let out = canvas.toDataURL('image/png')
      if (out.length > 250000) { // large photo-like logo: JPEG is far smaller (white background)
        const c2 = document.createElement('canvas'); c2.width = w; c2.height = h
        const ctx = c2.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h)
        out = c2.toDataURL('image/jpeg', 0.85)
      }
      resolve(out)
    }
    img.src = reader.result
  }
  reader.readAsDataURL(file)
})
