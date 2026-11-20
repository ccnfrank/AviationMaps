import { useEffect, useState } from "react";
import { getPreviewKind } from "../lib/previewKind";
import { getThumb } from "../lib/media/thumbs";

// Miniatura de um mapa: a imagem reduzida, ou o primeiro quadro do PDF. Quando não dá para
// desenhar (formato que o navegador não abriu ou erro), mostra um bloco com a extensão.
// A imagem vem da fila de miniaturas (lib/media/thumbs.js), que só roda para o que está na tela.
export default function Thumb({ entry }) {
  const kind = getPreviewKind(entry.name);
  const canDraw = Boolean(entry.file) && kind !== "unsupported";
  const [failed, setFailed] = useState(!canDraw);
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!canDraw) return undefined;
    let alive = true;
    let objectUrl = null;
    getThumb(entry.file, kind, () => alive).then(
      (blob) => {
        if (!alive) return;
        if (!blob) {
          setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry, canDraw, kind]);

  if (failed || !url) {
    return (
      <div className={`thumb-tile tone--${entry.type}`} aria-hidden="true">
        <span className="thumb-tile__ext">{entry.ext || "·"}</span>
      </div>
    );
  }
  return (
    <img
      className="thumb-img"
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
