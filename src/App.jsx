import { useEffect, useRef, useState } from "react";
import { PlaneTakeoff, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useTranslation } from "react-i18next";
import Modal from "./components/Modal";
import PixelButton from "./components/PixelButton";
import Preview from "./components/Preview";
import Search from "./components/Search";
import LanguageSwitch from "./components/LanguageSwitch";
import { canPickDirectory, pickDirectory, readDirectory, readDroppedDirectory } from "./lib/folderAccess";
import { ROOT_NAME, groupFiles } from "./lib/groupFiles";
import { getPreviewKind } from "./lib/previewKind";

// Mapa Reader: a página inicial do Media Manager, só com mapas. Carrega uma pasta (pelo botão ou
// soltando-a na janela). A busca mostra os mapas (imagens e PDF) que casam com o texto, logo
// abaixo do campo, e cada um abre na janela de visualização. Os outros arquivos são ignorados.
export default function App() {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [folders, setFolders] = useState(null); // null: nenhuma pasta carregada ainda
  const [previewEntry, setPreviewEntry] = useState(null);
  const [previewSeq, setPreviewSeq] = useState(0);
  const [dropping, setDropping] = useState(false);
  const [viewMode, setViewMode] = useState(null); // null: padrão da pasta carregada
  const hasFolders = (folders?.length ?? 0) > 0;
  // Com subpastas, a busca abre em lista (uma linha por subpasta); sem elas, em grade.
  const hasSubfolders = (folders ?? []).some((f) => f.name !== ROOT_NAME);
  const view = viewMode ?? (hasSubfolders ? "list" : "grid");

  // Só os mapas entram na lista: imagens e PDF. Vídeo, áudio, zip e o resto da pasta somem aqui.
  const showFiles = (files) => {
    const maps = files.filter((f) => getPreviewKind(f.name) !== "unsupported");
    setFolders(maps.length ? groupFiles(maps) : []);
    setViewMode(null);
  };

  const reportReadError = (err) => {
    toast.error(t("errors.readFolder"), { description: err?.message ?? String(err) });
  };

  const openPreview = (entry) => {
    setPreviewSeq((n) => n + 1);
    setPreviewEntry(entry);
  };

  // Caminho do <input webkitdirectory>, usado quando o navegador não tem o seletor de pasta.
  const onPick = (e) => {
    showFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
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
    try {
      showFiles(await readDirectory(handle));
    } catch (err) {
      reportReadError(err);
    }
  };

  const clearFolders = () => {
    setFolders(null);
    setPreviewEntry(null);
  };

  // Arrastar uma pasta para a janela: mostra a área de soltar e abre a pasta ao soltar.
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
      if (!item) return;
      try {
        const files = await readDroppedDirectory(item);
        if (!files) {
          toast.error(t("errors.notFolder"));
          return;
        }
        showFiles(files);
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
        </div>
      </header>

      {/* O X fica à esquerda do campo: aparecer ao carregar não empurra o campo nem o botão de carregar. */}
      <footer className="dock">
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

      {previewEntry && (
        <Modal
          label={t("preview.dialog", { name: previewEntry.name })}
          className="modal--preview"
          onClose={() => setPreviewEntry(null)}
        >
          <Preview
            key={previewSeq}
            entry={previewEntry}
            hasPrev={false}
            hasNext={false}
            onPrev={() => {}}
            onNext={() => {}}
            onClose={() => setPreviewEntry(null)}
          />
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

      <Toaster position="bottom-center" theme="dark" closeButton />
    </main>
  );
}
