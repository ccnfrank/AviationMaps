import { useEffect, useRef, useState } from "react";
import { PlaneTakeoff, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useTranslation } from "react-i18next";
import Modal from "./components/Modal";
import PixelButton from "./components/PixelButton";
import Preview from "./components/Preview";
import HoverPreview from "./components/HoverPreview";
import SplitDivider from "./components/SplitDivider";
import Search from "./components/Search";
import LanguageSwitch from "./components/LanguageSwitch";
import HelpButton from "./components/HelpButton";
import ThemeButton from "./components/ThemeButton";
import ViewerEmpty from "./components/ViewerEmpty";
import {
  allowFolder, canPickDirectory, isTauri, onOpenedFolder, pickDirectory, pickMapFileNative, readDirectory,
  readDroppedDirectory, takeOpenedFolder,
} from "./lib/folderAccess";
import { forgetLastFolder, readLastFolder, saveLastFolder } from "./lib/lastFolder";
import { setFullscreen } from "./lib/fullscreen";
import { mapKeyOf } from "./lib/savedRoutes";
import { ROOT_NAME, groupFiles } from "./lib/groupFiles";
import { firstMapFile, getPreviewKind } from "./lib/previewKind";
import { readTheme, setTheme } from "./lib/theme";
import logo from "./assets/aero-logo.png";

// Mapa Reader: a página inicial do Media Manager, só com mapas. Carrega uma pasta (pelo botão ou
// soltando-a na janela). A busca mostra os mapas (imagens e PDF) que casam com o texto, logo
// abaixo do campo, e cada um abre na janela de visualização. Dentro da visualização, uma coluna ao
// lado mostra os mapas da pasta para trocar de mapa. Os outros arquivos são ignorados.
// Sem pasta, um mapa avulso também serve: a tecla V abre a janela vazia, e o arquivo entra
// arrastando-o para a janela ou pelo botão de escolher. Um arquivo solto na tela inicial abre direto.
export default function App() {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [theme, setThemeState] = useState(readTheme); // "night" (padrão) ou "day"
  const toggleTheme = () => {
    const next = theme === "day" ? "night" : "day";
    setTheme(next);
    setThemeState(next);
  };
  const [folders, setFolders] = useState(null); // null: nenhuma pasta carregada ainda
  const [previewEntry, setPreviewEntry] = useState(null);
  // Mapa sob o mouse na coluna da visualização: aparece na janela enquanto o mouse passa; o clique abre de vez.
  const [hoverEntry, setHoverEntry] = useState(null);
  // Split maps: a visualização vira dois painéis. O da esquerda é o mapa aberto; o da direita, o escolhido na lista.
  // `activePane` diz qual painel recebe as teclas e as ferramentas (o último clicado).
  const [split, setSplit] = useState(false);
  const [rightEntry, setRightEntry] = useState(null);
  const [rightSeq, setRightSeq] = useState(0);
  const [activePane, setActivePane] = useState("left");
  // Fração da área dos dois painéis que cabe ao da esquerda (0.5: os dois iguais). A linha entre eles muda o valor.
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [viewerEmpty, setViewerEmpty] = useState(false); // janela aberta sem mapa, esperando um arquivo
  const viewerOpen = previewEntry !== null || viewerEmpty;
  const [previewSeq, setPreviewSeq] = useState(0);
  const [dropping, setDropping] = useState(false);
  const [viewMode, setViewMode] = useState(null); // null: padrão da pasta carregada
  const hasFolders = (folders?.length ?? 0) > 0;
  // Com subpastas, a busca abre em lista (uma linha por subpasta); sem elas, em grade.
  const hasSubfolders = (folders ?? []).some((f) => f.name !== ROOT_NAME);
  const view = viewMode ?? (hasSubfolders ? "list" : "grid");
  // Visualização da coluna ao lado do mapa: miniaturas por padrão, independente da busca da página.
  const [libraryView, setLibraryView] = useState("grid");

  // Só os mapas entram na lista: imagens e PDF. Vídeo, áudio, zip e o resto da pasta somem aqui.
  const showFiles = (files) => {
    const maps = files.filter((f) => getPreviewKind(f.name) !== "unsupported");
    setFolders(maps.length ? groupFiles(maps) : []);
    setViewMode(null);
  };

  const reportReadError = (err, key = "errors.readFolder") => {
    toast.error(t(key), { description: err?.message ?? String(err) });
  };

  const openPreview = (entry) => {
    setHoverEntry(null);
    // Com o split ligado, o mapa escolhido na lista vai para o painel da direita; o da esquerda fica.
    if (split && showLibrary && previewEntry) {
      setRightSeq((n) => n + 1);
      setRightEntry(entry);
      setActivePane("right");
      return;
    }
    setViewerEmpty(false);
    setPreviewSeq((n) => n + 1);
    setPreviewEntry(entry);
  };

  // Abre o primeiro mapa de uma lista de arquivos (soltados ou escolhidos). Outros tipos são ignorados.
  const openFiles = (files) => {
    const file = firstMapFile(files);
    if (!file) {
      toast.error(t("errors.unsupportedFile"));
      return;
    }
    openPreview({ name: file.name, size: file.size, file });
  };

  // Tela cheia da visualização: o estado fica aqui porque é a janela do modal que muda de tamanho.
  const [viewFull, setViewFullState] = useState(false);
  const setViewFull = (on) => {
    setViewFullState(on);
    setFullscreen(on);
  };
  const closePreview = () => {
    if (viewFull) setViewFull(false);
    setHoverEntry(null);
    setSplit(false);
    setRightEntry(null);
    setActivePane("left");
    setPreviewEntry(null);
    setViewerEmpty(false);
  };

  // Tecla V: mostra a janela de visualização vazia (para soltar ou escolher um mapa). Não age
  // enquanto se digita, nem com a janela já aberta, nem com Ctrl, Cmd ou Alt.
  useEffect(() => {
    if (viewerOpen) return undefined;
    const onKey = (e) => {
      if (e.key.toLowerCase() !== "v" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      setViewerEmpty(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen]);

  // Esc sai da tela cheia (antes de fechar a visualização, que também responde ao Esc).
  useEffect(() => {
    if (!viewFull) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setViewFullState(false);
      setFullscreen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [viewFull]);

  // No navegador, a tela cheia pode acabar pelo próprio navegador (Esc, por exemplo): acompanha.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setViewFullState(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // A coluna ao lado do mapa (gaveta) aparece com pasta carregada, fora da tela cheia (que ocupa a janela toda).
  // Começa aberta; L, ou o botão da barra da visualização, abre e fecha. L não age enquanto se digita.
  const showLibrary = hasFolders && !viewFull;
  // Os dois painéis precisam da coluna (é de lá que vem o mapa da direita), então somem na tela cheia.
  const splitShown = split && showLibrary;
  const [libraryOpen, setLibraryOpen] = useState(true);
  const toggleLibrary = () => {
    setHoverEntry(null);
    setLibraryOpen((open) => !open);
  };
  // Split maps: liga e desliga os dois painéis. Ao ligar, a coluna abre, para haver de onde escolher o mapa.
  const toggleSplit = () => {
    setHoverEntry(null);
    setRightEntry(null);
    setActivePane("left");
    if (!split) {
      setLibraryOpen(true);
      setSplitRatio(0.5);
    }
    setSplit((on) => !on);
  };
  // Só com o split ligado: o mouse sobre um mapa da lista mostra esse mapa na janela da direita, sem trocar
  // o mapa dela. Não se pré-visualiza o que a direita já mostra. Sem o split, a lista não pré-visualiza.
  const rightHover = splitShown && libraryOpen && hoverEntry && !(rightEntry && mapKeyOf(rightEntry) === mapKeyOf(hoverEntry))
    ? hoverEntry
    : null;
  // Tecla S: liga e desliga o split maps. Desligar vale sempre; ligar exige um mapa aberto à esquerda.
  // Não age enquanto se digita, nem com Ctrl, Cmd ou Alt.
  useEffect(() => {
    if (!viewerOpen || !showLibrary) return undefined;
    const onKey = (e) => {
      if (e.key.toLowerCase() !== "s" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      if (!split && !previewEntry) return;
      toggleSplit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, showLibrary, split, previewEntry]);
  useEffect(() => {
    if (!viewerOpen || !showLibrary) return undefined;
    const onKey = (e) => {
      if (e.key.toLowerCase() !== "l" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      toggleLibrary();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, showLibrary]);

  // Caminho do <input webkitdirectory>, usado quando o navegador não tem o seletor de pasta.
  const onPick = (e) => {
    showFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  // Botão de escolher um mapa na janela vazia, no app Tauri (o navegador usa o <input> de ViewerEmpty).
  const onChooseNative = async () => {
    let file;
    try {
      file = await pickMapFileNative();
    } catch (err) {
      reportReadError(err, "errors.readFile");
      return;
    }
    if (file) openFiles([file]);
  };

  const onLoadClick = async () => {
    if (!canPickDirectory()) {
      inputRef.current.click();
      return;
    }
    let handle;
    try {
      handle = await pickDirectory();
    } catch {
      return; // escolha cancelada
    }
    if (!handle) return; // diálogo nativo fechado sem escolher
    try {
      showFiles(await readDirectory(handle));
      // Só o caminho nativo (Tauri) tem um caminho para lembrar; no navegador a pasta não fica guardada.
      if (typeof handle === "string") saveLastFolder(handle);
    } catch (err) {
      reportReadError(err);
    }
  };

  const clearFolders = () => {
    setFolders(null);
    setPreviewEntry(null);
    setViewerEmpty(false);
  };

  // App Tauri: uma pasta que o macOS entregou (arrastada para o ícone do app) carrega na hora e tem
  // prioridade; sem entrega, reabre a última pasta carregada. Com o app aberto, uma pasta entregue
  // depois também carrega. Toda pasta carregada fica lembrada. Se a última sumiu ou não pode ser
  // lida, esquece o caminho e avisa.
  useEffect(() => {
    if (!isTauri()) return undefined;
    let alive = true;
    let stopListening = null;
    const openNative = async (path, { remembered = false } = {}) => {
      try {
        await allowFolder(path);
        const files = await readDirectory(path);
        if (!alive) return;
        showFiles(files);
        saveLastFolder(path);
      } catch (err) {
        if (remembered) forgetLastFolder();
        if (alive) reportReadError(err);
      }
    };
    (async () => {
      // Escuta antes de pegar a entrega pendente: uma pasta que chegue nesse intervalo não se perde.
      const stop = await onOpenedFolder(async () => {
        const path = await takeOpenedFolder();
        if (path && alive) openNative(path);
      });
      if (!alive) {
        stop();
        return;
      }
      stopListening = stop;
      const opened = await takeOpenedFolder();
      if (!alive) return;
      if (opened) {
        openNative(opened);
        return;
      }
      const last = readLastFolder();
      if (last) openNative(last, { remembered: true });
    })();
    return () => {
      alive = false;
      stopListening?.();
    };
    // showFiles e reportReadError só trocam estado e mostram aviso; o efeito roda só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrastar uma pasta para a janela: mostra a área de soltar e abre a pasta ao soltar.
  // Um mapa solto (imagem ou PDF) abre na janela de visualização, sem carregar a pasta dele.
  useEffect(() => {
    const hasFilesIn = (e) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onDragEnter = (e) => {
      if (hasFilesIn(e)) setDropping(true);
    };
    const onDragOver = (e) => {
      if (!hasFilesIn(e)) return;
      e.preventDefault(); // sem isto o navegador não aceita o soltar
    };
    const onDragLeave = (e) => {
      // Só fecha quando o ponteiro sai da janela de vez (relatedTarget vazio).
      if (!e.relatedTarget) setDropping(false);
    };
    const onDrop = async (e) => {
      if (!hasFilesIn(e)) return;
      e.preventDefault();
      setDropping(false);
      const item = Array.from(e.dataTransfer.items ?? []).find((it) => it.kind === "file");
      // Arquivo solto: lido já, enquanto o evento ainda tem os arquivos.
      if (!item || item.webkitGetAsEntry?.()?.isDirectory !== true) {
        openFiles(e.dataTransfer.files ?? []);
        return;
      }
      try {
        const files = await readDroppedDirectory(item);
        if (files) showFiles(files);
      } catch (err) {
        reportReadError(err);
      }
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
    // showFiles só troca estado; a lista de dependências fica vazia de propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadButton = (
    <div className="dock__actions">
      <PixelButton className="pixel-btn--glass" onClick={onLoadClick} title={t("app.loadFolder")}>
        <PlaneTakeoff className="pixel-btn__icon" strokeWidth={2} aria-hidden="true" />
        <span>{t("app.loadFolder")}</span>
      </PixelButton>
    </div>
  );

  return (
    <main className={`app app--home${hasFolders ? " app--loaded" : ""}`}>
      <header className="app__bar">
        <div className="app__controls">
          <LanguageSwitch />
          <HelpButton />
          <ThemeButton theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      {/* O X fica à esquerda do campo: aparecer ao carregar não empurra o campo nem o botão de carregar. */}
      <footer className="dock">
        <img className="dock__logo" src={logo} alt="AeroMap Airspace Maps" draggable={false} />
        {folders && (
          <div className="dock__clear">
            <PixelButton className="pixel-btn--icon pixel-btn--bare" onClick={clearFolders} aria-label={t("app.clearFolders")} title={t("app.clearFolders")}>
              <X className="pixel-btn__icon" strokeWidth={2} aria-hidden="true" />
            </PixelButton>
          </div>
        )}
        <Search folders={folders ?? []} onPreview={openPreview} view={view} onViewChange={setViewMode} />
        {loadButton}
      </footer>
      {folders && !hasFolders && (
        <p className="app__hint">{t("app.noFiles")}</p>
      )}

      <input
        ref={inputRef}
        data-testid="folder-input"
        type="file"
        webkitdirectory=""
        multiple
        hidden
        onChange={onPick}
      />

      {viewerOpen && (
        <Modal
          label={previewEntry ? t("preview.dialog", { name: previewEntry.name }) : t("viewer.title")}
          className={viewFull ? "modal--preview modal--full" : showLibrary ? `modal--preview modal--library${libraryOpen ? "" : " is-collapsed"}` : "modal--preview"}
          onClose={closePreview}
        >
          <div className="viewer-split" style={{ "--split": splitRatio }}>
            {/* O mapa aberto fica montado mesmo com a pré-visualização na frente (zoom e medições não se perdem). */}
            <div
              className={`viewer-main${splitShown ? " viewer-main--split" : ""}${splitShown && activePane === "left" ? " is-active" : ""}`}
              onMouseDownCapture={() => setActivePane("left")}
            >
              {previewEntry ? (
                <Preview
                  key={previewSeq}
                  entry={previewEntry}
                  hasPrev={false}
                  hasNext={false}
                  onPrev={() => {}}
                  onNext={() => {}}
                  onClose={closePreview}
                  fullscreen={viewFull}
                  onToggleFullscreen={() => setViewFull(!viewFull)}
                  libraryOpen={libraryOpen}
                  onToggleLibrary={showLibrary ? toggleLibrary : undefined}
                  splitOn={splitShown}
                  onToggleSplit={showLibrary ? toggleSplit : undefined}
                  active={activePane === "left"}
                />
              ) : (
                <ViewerEmpty
                  onClose={closePreview}
                  onFiles={openFiles}
                  onChoose={isTauri() ? onChooseNative : undefined}
                />
              )}
            </div>
            {splitShown && <SplitDivider ratio={splitRatio} onRatio={setSplitRatio} />}
            {splitShown && (
              <div
                className={`viewer-main viewer-main--split viewer-main--right${activePane === "right" ? " is-active" : ""}${rightHover ? " is-under" : ""}`}
                onMouseDownCapture={() => setActivePane("right")}
              >
                {rightEntry ? (
                  <Preview
                    key={rightSeq}
                    entry={rightEntry}
                    hasPrev={false}
                    hasNext={false}
                    onPrev={() => {}}
                    onNext={() => {}}
                    onClose={toggleSplit}
                    active={activePane === "right"}
                    hideSplit
                  />
                ) : (
                  <div className="viewer-split__empty">
                    <p>{t("split.empty")}</p>
                  </div>
                )}
                {rightHover && <HoverPreview key={mapKeyOf(rightHover)} entry={rightHover} />}
              </div>
            )}
            {showLibrary && (
              <aside className="viewer-library">
                <div className="viewer-library__inner">
                  <Search docked folders={folders} onPreview={openPreview} view={libraryView} onViewChange={setLibraryView} onHover={splitShown ? setHoverEntry : undefined} />
                </div>
              </aside>
            )}
          </div>
        </Modal>
      )}

      {dropping && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay__text">
            <span className="drop-overlay__title">{t("app.dropTitle")}</span>
            <span className="drop-overlay__hint">{t("app.dropHint")}</span>
          </div>
        </div>
      )}

      <Toaster position="bottom-center" theme={theme === "day" ? "light" : "dark"} closeButton />
    </main>
  );
}
