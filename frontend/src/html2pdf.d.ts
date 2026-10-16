declare module 'html2pdf.js' {
  interface PdfWorker { set(options: Record<string, unknown>): PdfWorker; from(element: HTMLElement): PdfWorker; save(): Promise<void>; }
  export default function html2pdf(): PdfWorker;
}
