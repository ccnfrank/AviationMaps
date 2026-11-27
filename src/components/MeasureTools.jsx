import { useState } from "react";
import { CloudSun, FileDown, MapPin, Ruler, RotateCcw, Save, Trash2, Crosshair, Check, Wind, X } from "lucide-react";
import { useTranslation } from "react-i18next";

// Botão de ícone que liga o plotar pontos: cada clique no mapa marca um ponto numerado.
export function PlotToggle({ enabled, onToggle }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="tool-toggle"
      aria-pressed={enabled}
      onClick={onToggle}
      aria-label={t("points.toggle")}
      title={t("points.title")}
    >
      <MapPin strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

// Botão de ícone que liga o vento: cada clique no mapa abre a entrada de direção e velocidade.
export function WindToggle({ enabled, onToggle }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="tool-toggle"
      aria-pressed={enabled}
      onClick={onToggle}
      aria-label={t("wind.toggle")}
      title={t("wind.title")}
    >
      <Wind strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

// Botão de ícone de função que ainda não existe: só o ícone, desabilitado até a função chegar.
function PendingButton({ label, title, children }) {
  return (
    <button type="button" className="tool-toggle" disabled aria-label={label} title={title}>
      {children}
    </button>
  );
}

// Avião preenchido: a silhueta do lucide `plane`, que já aponta para nordeste.
const PLANE_PATH = "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";
// Mapinha do lucide `map` (dobrado), em traço.
const MAP_PATHS = [
  "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",
  "M15 5.764v15",
  "M9 3.236v15",
];
// Um mapinha, com um avião preenchido voando por cima, à direita.
function MapPlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g transform="translate(8 15) scale(0.7) translate(-12 -12)" fill="none" stroke="currentColor" strokeWidth={1.8 / 0.7} strokeLinecap="round" strokeLinejoin="round">
        {MAP_PATHS.map((d) => <path key={d} d={d} />)}
      </g>
      <g transform="translate(18 6.5) scale(0.52) translate(-12 -12)">
        <path d={PLANE_PATH} fill="currentColor" stroke="currentColor" strokeWidth={0.8 / 0.52} strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// Botão de ícone do METAR, só o ícone por enquanto: a função vem depois.
export function MetarButton() {
  const { t } = useTranslation();
  return (
    <PendingButton label={t("metar.button")} title={t("metar.tooltip")}>
      <CloudSun strokeWidth={1.8} aria-hidden="true" />
    </PendingButton>
  );
}

// Outros mapas: só o ícone por enquanto. Vai abrir uma janela flutuante com outros mapas, feita depois.
export function OtherMapsButton() {
  const { t } = useTranslation();
  return (
    <PendingButton label={t("maps.button")} title={t("maps.tooltip")}>
      <MapPlaneIcon />
    </PendingButton>
  );
}

// Botão de ícone que liga a medição, em cm. Mesmo jeito do botão do transferidor, na barra de ferramentas.
export function MeasureToggle({ enabled, onToggle }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="tool-toggle"
      aria-pressed={enabled}
      onClick={onToggle}
      aria-label={t("measure.toggle")}
      title={t("measure.title")}
    >
      <Ruler strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

// Calibra a escala de uma imagem sem resolução gravada: o próximo traço desenhado é a referência.
// Fica ativo enquanto espera o traço; clicar de novo desliga.
export function CalibrateButton({ active, onToggle }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="tool-toggle"
      aria-pressed={active}
      onClick={onToggle}
      aria-label={t("measure.calibrate")}
      title={t("measure.calibrateHint")}
    >
      <Crosshair strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

// Campo do tamanho real do traço de calibração, na própria barra (sem janela).
export function CalibrationField({ px, onApply, onCancel }) {
  const { t } = useTranslation();
  const [known, setKnown] = useState("");
  const parsed = Number(String(known).replace(",", "."));
  const apply = (e) => {
    e.preventDefault();
    if (!(parsed > 0)) return;
    onApply(parsed);
    setKnown("");
  };
  return (
    <form className="measure-calibrate" onSubmit={apply}>
      <span className="measure-calibrate__px">{t("measure.calibrateLine", { px: Math.round(px) })}</span>
      <input
        type="text"
        inputMode="decimal"
        className="measure-calibrate__input"
        aria-label={t("measure.calibrateLabel")}
        placeholder={t("measure.calibrateLabel")}
        value={known}
        onChange={(e) => setKnown(e.target.value)}
        autoFocus
      />
      <button type="submit" className="tool-toggle" aria-label={t("measure.apply")} disabled={!(parsed > 0)}>
        <Check strokeWidth={2} aria-hidden="true" />
      </button>
      <button type="button" className="tool-toggle" aria-label={t("common.cancel")} onClick={onCancel}>
        <X strokeWidth={2} aria-hidden="true" />
      </button>
    </form>
  );
}

// Apaga todas as medições da janela (Backspace apaga só a última). `label` troca o texto, para os pontos.
export function ClearButton({ onClick, label }) {
  const { t } = useTranslation();
  const text = label ?? t("measure.clear");
  return (
    <button type="button" className="tool-toggle" onClick={onClick} aria-label={text} title={text}>
      <Trash2 strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

// Botão de ícone que abre as rotas salvas: salva a rota atual do mapa, ou abre uma já salva (janela própria). Tecla R.
export function RoutesButton({ onClick }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="tool-toggle"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={t("routes.button")}
      title={`${t("routes.tooltip")} (R)`}
    >
      <Save strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

// Botão de ícone que exporta a rota (trecho por trecho) em CSV. Fica sempre na barra; sem rota, desabilitado.
export function ExportRouteButton({ onClick, disabled = false }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="tool-toggle" onClick={onClick} disabled={disabled} aria-label={t("route.export.button")} title={t("route.export.button")}>
      <FileDown strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

// Botão de ícone que limpa tudo no mapa: medições, pontos, ventos e transferidor. Sem nada para limpar, desabilitado.
export function ResetButton({ onClick, disabled = false }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="tool-toggle" onClick={onClick} disabled={disabled} aria-label={t("preview.resetAll")} title={t("preview.resetAll")}>
      <RotateCcw strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
