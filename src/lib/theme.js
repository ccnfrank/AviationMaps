// Tema do app: "night" (escuro, o padrão) ou "day" (claro). A escolha fica guardada neste navegador.
const KEY = "mapareader.theme";

export function readTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "day" || saved === "night") return saved;
  } catch {
    // sem armazenamento: vale o padrão
  }
  return "night";
}

// Liga o tema no <html>: os tokens de cor em styles.css trocam conforme data-theme.
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "day" ? "day" : "night";
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // sem armazenamento: o tema vale só nesta sessão
  }
  applyTheme(theme);
}
