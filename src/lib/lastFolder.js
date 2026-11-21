// Última pasta carregada no app (caminho nativo, do Tauri). Fica no armazenamento local da janela,
// que sobrevive ao fechar o app. Sem armazenamento disponível, a pasta só não é lembrada.
const KEY = "mapareader.lastFolder";

export function readLastFolder() {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function saveLastFolder(path) {
  try {
    localStorage.setItem(KEY, path);
  } catch {
    // sem armazenamento: a pasta não fica lembrada
  }
}

export function forgetLastFolder() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada guardado, nada a apagar
  }
}
