// pdf.js (carregado sob demanda) com o worker apontado para o arquivo empacotado.
// Miniaturas e pré-visualização usam a mesma instância.
let loading = null;

export function loadPdfjs() {
  if (!loading) {
    loading = Promise.all([
      import("pdfjs-dist/build/pdf.mjs"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, { default: workerUrl }]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    }, (err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}
