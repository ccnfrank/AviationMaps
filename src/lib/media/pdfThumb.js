import { loadPdfjs } from "./pdfjs";

// Miniatura de PDF: desenha a primeira página num canvas pequeno (pdf.js, carregado sob demanda).
// O arquivo inteiro vai para a memória, então PDFs muito grandes ficam sem miniatura.
export const MAX_PDF_THUMB_BYTES = 200 * 1024 * 1024;

export async function renderPdfThumb(file, side = 360) {
  if (file.size > MAX_PDF_THUMB_BYTES) throw new Error("PDF grande demais para miniatura.");
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: side / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar miniatura"))), "image/jpeg", 0.85);
    });
  } finally {
    await task.destroy();
  }
}
