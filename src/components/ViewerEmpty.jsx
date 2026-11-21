import { useRef } from "react";
import { FileUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import PixelButton from "./PixelButton";
import { ACCEPT } from "../lib/previewKind";

// Janela de visualização sem mapa, aberta pelo atalho V. O mapa (imagem ou PDF) entra arrastando
// o arquivo para cá ou pelo botão, sem precisar carregar uma pasta inteira.
// `onFiles` recebe a lista de arquivos do <input>. `onChoose`, se vier (app Tauri), abre o diálogo
// nativo no lugar do <input>.
export default function ViewerEmpty({ onClose, onFiles, onChoose }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);

  const choose = () => {
    if (onChoose) onChoose();
    else inputRef.current?.click();
  };
  const onInput = (e) => {
    onFiles(e.target.files ?? []);
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
  };

  return (
    <div className="viewer-empty">
      <button type="button" className="viewer-empty__close" onClick={onClose} aria-label={t("common.close")} title={t("common.close")}>
        <X strokeWidth={2} aria-hidden="true" />
      </button>
      <div className="viewer-empty__zone">
        <FileUp className="viewer-empty__icon" strokeWidth={1.6} aria-hidden="true" />
        <p className="viewer-empty__title">{t("viewer.emptyTitle")}</p>
        <p className="viewer-empty__hint">{t("viewer.emptyHint")}</p>
        <PixelButton className="pixel-btn--glass" onClick={choose}>
          <span>{t("viewer.choose")}</span>
        </PixelButton>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} hidden data-testid="file-input" onChange={onInput} />
    </div>
  );
}
