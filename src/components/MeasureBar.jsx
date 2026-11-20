import { useState } from "react";
import { Ruler, Trash2, Crosshair, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

// Interruptor da medição. Fica dentro da cápsula de zoom, para não mudar a altura da janela.
export function MeasureSwitch({ enabled, onToggle }) {
  const { t } = useTranslation();
  return (
    <button type="button" role="switch" aria-checked={enabled} className="measure-switch" onClick={onToggle}>
      <span className="measure-switch__track" aria-hidden="true"><span className="measure-switch__knob" /></span>
      <Ruler strokeWidth={1.8} aria-hidden="true" />
      <span className="measure-switch__text">{t("measure.toggle")}</span>
    </button>
  );
}

// Painel da medição. Mostra uma unidade só (px ou cm), escolhida aqui. Flutua sobre a imagem,
// então abri-lo não empurra o conteúdo. Toda a lógica fica na pré-visualização.
export default function MeasureBar({
  enabled, canCalibrate, canCm, unit, onUnitChange, sizeText, scaleNote,
  calibrating, calibrationPx, onCalibrateStart, onCalibrateApply, onCalibrateCancel,
  draftText, hasDraft, lastText, lastDetail, hasItems, onClear, onFinish,
}) {
  const { t } = useTranslation();
  const [known, setKnown] = useState("");
  if (!enabled) return null;

  const parsed = Number(String(known).replace(",", "."));
  const apply = (e) => {
    e.preventDefault();
    if (!(parsed > 0)) return;
    onCalibrateApply(parsed);
    setKnown("");
  };

  return (
    <div className="measure-bar" role="group" aria-label={t("measure.region")}>
      <div className="measure-bar__body">
        <div className="measure-bar__row">
          {sizeText && (
            <span className="measure-chip">
              <span className="measure-chip__label">{t("measure.size")}</span>
              <span className="measure-chip__value">{sizeText}</span>
            </span>
          )}
          {scaleNote && <span className="measure-bar__note">{scaleNote}</span>}
          <div className="measure-bar__actions">
            <div className="measure-unit" role="group" aria-label={t("measure.unit")}>
              <button
                type="button"
                aria-pressed={unit === "px"}
                className={unit === "px" ? "is-active" : ""}
                onClick={() => onUnitChange("px")}
              >
                px
              </button>
              <button
                type="button"
                aria-pressed={unit === "cm"}
                className={unit === "cm" ? "is-active" : ""}
                onClick={() => onUnitChange("cm")}
                disabled={!canCm}
                title={canCm ? "cm" : t("measure.cmUnavailable")}
              >
                cm
              </button>
            </div>
            {canCalibrate && !calibrating && calibrationPx == null && (
              <button type="button" className="measure-bar__btn" onClick={onCalibrateStart}>
                <Crosshair strokeWidth={1.8} aria-hidden="true" />
                {t("measure.calibrate")}
              </button>
            )}
            {hasDraft && (
              <button type="button" className="measure-bar__btn" onClick={onFinish}>
                <Check strokeWidth={2} aria-hidden="true" />
                {t("measure.finish")}
              </button>
            )}
            <button type="button" className="measure-bar__btn" onClick={onClear} disabled={!hasItems && !hasDraft}>
              <Trash2 strokeWidth={1.8} aria-hidden="true" />
              {t("measure.clear")}
            </button>
          </div>
        </div>

        {hasDraft && draftText && (
          <div className="measure-result is-live">
            <span className="measure-result__main">{draftText}</span>
            <span className="measure-result__detail">{t("measure.drawing")}</span>
          </div>
        )}

        {calibrating && <p className="measure-bar__hint">{t("measure.calibrateHint")}</p>}

        {calibrationPx != null && (
          <form className="measure-bar__calibrate" onSubmit={apply}>
            <span className="measure-bar__calibrate-text">
              {t("measure.calibrateLine", { px: Math.round(calibrationPx) })}
            </span>
            <input
              type="text"
              inputMode="decimal"
              className="measure-bar__input"
              aria-label={t("measure.calibrateLabel")}
              placeholder={t("measure.calibrateLabel")}
              value={known}
              onChange={(e) => setKnown(e.target.value)}
              autoFocus
            />
            <button type="submit" className="measure-bar__btn measure-bar__btn--primary" disabled={!(parsed > 0)}>
              {t("measure.apply")}
            </button>
            <button type="button" className="measure-bar__btn" onClick={onCalibrateCancel}>
              {t("common.cancel")}
            </button>
          </form>
        )}

        {!hasDraft && lastText && (
          <div className="measure-result" aria-live="polite">
            <span className="measure-result__main">{lastText}</span>
            {lastDetail && <span className="measure-result__detail">{lastDetail}</span>}
          </div>
        )}

        {!hasDraft && !lastText && !calibrating && <p className="measure-bar__hint">{t("measure.empty")}</p>}
      </div>
    </div>
  );
}
