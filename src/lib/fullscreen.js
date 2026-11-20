// Tela cheia da visualização. No app Tauri, coloca a janela inteira em tela cheia (no macOS, um
// espaço próprio); no navegador, usa a API de tela cheia da página. Em qualquer caso, a janela de
// visualização ocupa a tela toda (ver .modal.modal--full), então quem recusar a tela cheia do
// sistema continua vendo a visualização em tamanho total.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./folderAccess";

export async function setFullscreen(on) {
  try {
    if (isTauri()) {
      await getCurrentWindow().setFullscreen(on);
    } else if (on && document.fullscreenEnabled && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else if (!on && document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    // O sistema recusou (por exemplo, sem um gesto do usuário). Nada a fazer além da visualização em tela toda.
  }
}
