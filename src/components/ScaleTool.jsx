import { Mountain, Plane, Ship } from "lucide-react";
import { useTranslation } from "react-i18next";
import { parseScale } from "../lib/scale";

// Tipos de mapa: definem as unidades das medidas (aviação e náutico em milhas náuticas).
const MAP_TYPES = [
  { id: "aviation", labelKey: "scale.aviation", Icon: Plane },
  { id: "sea", labelKey: "scale.sea", Icon: Ship },
  { id: "land", labelKey: "scale.land", Icon: Mountain },
];

// Escala do mapa: escolhe o tipo e digita a escala. As medidas em cm viram distância real.
// `type` é o tipo escolhido (ou null) e `text` o que foi digitado; quem guarda os dois é quem usa.
export default function ScaleTool({ type, onType, text, onText }) {
  const { t } = useTranslation();
  const invalid = text.trim() !== "" && parseScale(text) == null;

  return (
    <div className="scale-tool" role="group" aria-label={t("scale.group")}>
      <div className="scale-tool__types" role="group" aria-label={t("scale.type")}>
        {MAP_TYPES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className="tool-toggle"
            aria-pressed={type === id}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => onType(type === id ? null : id)}
          >
            <Icon strokeWidth={1.8} aria-hidden="true" />
          </button>
        ))}
      </div>
      <input
        type="text"
        inputMode="numeric"
        className="scale-tool__input"
        aria-label={t("scale.label")}
        aria-invalid={invalid || undefined}
        placeholder="1:1000000"
        title={t("scale.title")}
        value={text}
        onChange={(e) => onText(e.target.value)}
      />
    </div>
  );
}
