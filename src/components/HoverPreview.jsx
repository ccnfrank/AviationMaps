import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatSize } from "../lib/format";
import { getPreviewKind } from "../lib/previewKind";
import { getImageBlob } from "../lib/media/decodeImage";
import { renderPdfThumb } from "../lib/media/pdfThumb";
import { getThumb } from "../lib/media/thumbs";

// Maior lado da versão nítida do mapa (px). Maior que a miniatura da lista, menor que o mapa aberto.
const HOVER_SIDE = 1600;

// Pré-visualização do mapa sob o mouse, na janela de visualização. Só mostra o mapa: sem ferramentas
// nem medições, que continuam no mapa aberto. Clicar no mapa da lista é que o abre de fato.
// A miniatura da lista aparece na hora (quase sempre já está em cache); a versão nítida chega depois.
export default function HoverPreview({ entry }) {
  const { t } = useTranslation();
  const kind = getPreviewKind(entry.name);
  const [thumb, setThumb] = useState(null);
  const [sharp, setSharp] = useState(null);
  const [settled, setSettled] = useState(false); // as duas tentativas já terminaram

  useEffect(() => {
    if (!entry.file || kind === "unsupported") {
      setSettled(true);
      return undefined;
    }
    let alive = true;
    const urls = [];
    const toUrl = (blob) => {
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return url;
    };
    const small = getThumb(entry.file, kind, () => alive)
      .then((blob) => {
        if (alive && blob) setThumb(toUrl(blob));
      })
      .catch(() => {});
    const big = (kind === "pdf" ? renderPdfThumb(entry.file, HOVER_SIDE) : getImageBlob(entry.file, { maxSide: HOVER_SIDE }))
      .then((blob) => {
        if (alive && blob) setSharp(toUrl(blob));
      })
      .catch(() => {});
    Promise.all([small, big]).then(() => {
      if (alive) setSettled(true);
    });
    return () => {
      alive = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [entry, kind]);

  const shown = sharp ?? thumb;
  return (
    <div className="preview hover-preview">
      <div className="preview__stage">
        {shown ? (
          <img className="preview__media" src={shown} alt={entry.name} draggable={false} />
        ) : settled ? (
          <p className="preview__note">{t("preview.readError")}</p>
        ) : null}
      </div>
      <div className="preview__nav">
        <div className="preview__meta">
          <span className="preview__name">{entry.name}</span>
          <span className="preview__size">{formatSize(entry.size)}</span>
        </div>
      </div>
    </div>
  );
}
