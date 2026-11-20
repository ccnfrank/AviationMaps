import { Mountain, Plane, Ship } from "lucide-react";
import { useTranslation } from "react-i18next";
import { parseScale, scaleReadout } from "../lib/scale";

// Tipos de mapa: cada um escolhe as unidades do resultado (aviação e náutico em milhas náuticas).
const MAP_TYPES = [
  { id: "aviation", labelKey: "scale.aviation", Icon: Plane },
  { id: "sea", labelKey: "scale.sea", Icon: Ship },
  { id: "land", labelKey: "scale.land", Icon: Mountain },
];

// Ferramenta da escala: escolhe o tipo de mapa e digita a escala. Mostra quanto vale 1 cm no mapa.
// `type` é o tipo escolhido (ou null) e `text` o que foi digitado; quem guarda os dois é quem usa.
export default function ScaleTool({ type, onType, text, onText }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const denominator = parseScale(text);
  const invalid = text.trim() !== "" && denominator == null;
  const readout = denominator != null ? scaleReadout(denominator, type) : null;
  const format = (value) => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);

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
      <output className="scale-tool__readout" aria-live="polite">
        {readout ? (
          <>
            <span>{t("scale.equals", { value: `${format(readout.primary.value)} ${readout.primary.unit}` })}</span>
            {readout.secondary && (
              <span className="scale-tool__alt">{`≈ ${format(readout.secondary.value)} ${readout.secondary.unit}`}</span>
            )}
          </>
        ) : (
          <span className="scale-tool__alt">{t("scale.empty")}</span>
        )}
      </output>
    </div>
  );
}
