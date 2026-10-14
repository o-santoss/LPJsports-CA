// Corta a foto ao centro em quadrado e reduz para 320×320 (JPEG), antes de a enviar.
export function squarePhoto(file, size = 320) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type || '') && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name || '')) {
      reject(new Error('Escolhe uma imagem (JPG ou PNG).'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui abrir esta imagem. Experimenta uma foto em JPG ou PNG.')); };
    img.src = url;
  });
}
