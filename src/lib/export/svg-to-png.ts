export function svgToPng(svgEl: SVGSVGElement, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgEl.clientWidth * scale;
      canvas.height = svgEl.clientHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load SVG'));
    img.src = url;
  });
}
