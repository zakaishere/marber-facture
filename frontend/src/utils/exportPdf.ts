// Uses the same saved-document preview as printing, one A4 page at a time.
export async function exportPdf(element: HTMLElement, filename: string) {
  const html2pdf = (await import('html2pdf.js')).default;
  const clone = element.cloneNode(true) as HTMLElement;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:210mm;background:white;';
  clone.classList.add('pdf-export'); host.appendChild(clone); document.body.appendChild(host);
  // html2canvas measures glyph baselines with a hidden 1px image in the live document.
  // Tailwind's block-image reset moves that image below its text, pushing PDF text down.
  // Restore inline flow only for the renderer's temporary font probes during this export.
  const fontMetricsStyle = document.createElement('style');
  fontMetricsStyle.textContent = 'body > div[style*="visibility: hidden"][style*="white-space: nowrap"] > img { display: inline-block; }';
  document.head.appendChild(fontMetricsStyle);
  try {
    await document.fonts.ready;
    // Wait for the local location QR before capturing any page, including a first export.
    await Promise.all(Array.from(clone.querySelectorAll('img')).map(image => image.decode()));
    await html2pdf().set({ filename, margin: 0, image: { type: 'jpeg', quality: .98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 1000 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css'], after: '.fp-page:not(:last-child), .mp-page:not(:last-child)' } }).from(clone).save();
  } finally { fontMetricsStyle.remove(); host.remove(); }
}
