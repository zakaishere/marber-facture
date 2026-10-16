import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Scale only the on-screen wrapper; printing/export still receives the original A4 content. */
export default function ResponsiveInvoicePreview({ children }: { children: ReactNode }) {
  const host = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLDivElement>(null);
  const [fullSize, setFullSize] = useState(false); const [size, setSize] = useState({ scale: 1, height: 0 });
  useLayoutEffect(() => {
    const container = host.current; const content = canvas.current;
    if (!container || !content) return;
    const measure = () => {
      const scale = fullSize ? 1 : Math.min(1, container.clientWidth / 850);
      const height = Math.ceil(content.offsetHeight * scale);
      setSize(previous => previous.scale === scale && previous.height === height ? previous : { scale, height });
    };
    const observer = new ResizeObserver(measure); observer.observe(container); observer.observe(content); measure();
    return () => observer.disconnect();
  }, [fullSize]);
  return <section className="space-y-3" aria-label="Aperçu du document"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Aperçu A4 · le PDF et l’impression conservent leur taille d’origine.</p><Button type="button" size="sm" variant="outline" aria-pressed={fullSize} onClick={() => setFullSize(value => !value)}>{fullSize ? 'Adapter à l’écran' : 'Agrandir à 100 %'}</Button></div><div ref={host} className="document-preview rounded-xl border max-w-[850px] mx-auto" style={{ height: size.height || undefined, overflowX: fullSize ? 'auto' : 'hidden', overflowY: 'hidden' }}><div ref={canvas} className="invoice-preview-canvas" style={{ width: 850, transform: `scale(${size.scale})`, transformOrigin: 'top left' }}>{children}</div></div></section>;
}
