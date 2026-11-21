import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, PanelRight, Sun, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatSize } from "../lib/format";
import { getPreviewKind } from "../lib/previewKind";
import { getImageBlob } from "../lib/media/decodeImage";
import { toDisplayUrl } from "../lib/displayUrl";
import {
  PDF_CM_PER_UNIT, addDeclination, angleOf, chainLength, cmPerUnitFromCalibration, cmPerUnitFromDpi, formatNumber,
  parseDeclination, readImageDpi,
} from "../lib/measure";
import { distanceNm, formatBearing, routeLinks } from "../lib/route";
import PdfPages from "./PdfPages";
import PanView from "./PanView";
import ImageStage from "./ImageStage";
import { CalibrateButton, CalibrationField, ClearButton, MeasureToggle, PlotToggle } from "./MeasureTools";
import { DeclinationInput, ProtractorToggle } from "./Protractor";
import ScaleTool from "./ScaleTool";
import { formatDistance, groundMeters, parseScale } from "../lib/scale";
import StepSlider from "./StepSlider";

// Zoom e brilho para foto e PDF. Mapas grandes em PDF precisam de bastante zoom.
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
// Passo dos botões − e +; o slider anda em frações para ficar suave.
const ZOOM_STEP = 0.5;
// Brilho em porcentagem: 100% é a imagem como está.
const BRIGHTNESS_MIN = 50;
const BRIGHTNESS_MAX = 150;
const BRIGHTNESS_DEFAULT = 100;
const BRIGHTNESS_STEP = 5; // de 5 em 5 os botões passam por 75%, e o slider anda de 1 em 1

// Janela de visualização de um arquivo. Quem usa deve dar uma `key` por arquivo, assim o estado
// (zoom, brilho, medições) começa limpo a cada troca. `entry` é { name, size, file }.
// `fullscreen` e `onToggleFullscreen` vêm de quem abre a janela (App), que muda o tamanho do modal.
// `libraryOpen` e `onToggleLibrary` controlam o painel de mapas ao lado; o botão só aparece com `onToggleLibrary`.
export default function Preview({
  entry, hasPrev, hasNext, onPrev, onNext, onClose, fullscreen = false, onToggleFullscreen,
  libraryOpen = false, onToggleLibrary,
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const kind = getPreviewKind(entry.name);
  const [url, setUrl] = useState(null);             // só imagem: URL de exibição
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [brightness, setBrightness] = useState(BRIGHTNESS_DEFAULT);
  const [error, setError] = useState(null);

  // Medição (imagem e PDF), sempre em cm. A escala vem do arquivo (DPI), de uma calibração do
  // usuário, ou é exata no PDF. Sem escala, a medição é desenhada mas não ganha texto.
  // Cada medição é uma cadeia de cliques, em unidades da superfície (px da imagem, pt no PDF).
  const [measureOn, setMeasureOn] = useState(false);
  const [lines, setLines] = useState([]);          // medições concluídas: { id, surface, points }
  const [draft, setDraft] = useState(null);        // medição em andamento: { surface, points, cursor }
  const [dpi, setDpi] = useState(null);
  const [calib, setCalib] = useState(null);        // { cmPerUnit } da calibração da imagem
  const [calibrating, setCalibrating] = useState(false); // a próxima medição calibra a escala
  const [calibLine, setCalibLine] = useState(null);      // medição de calibração, esperando o tamanho real
  // Transferidor: modo próprio, exclusivo com a medição. O centro (pivot) vem do primeiro clique,
  // a seta segue o ponteiro, e o segundo clique fixa o ângulo.
  const [protractorOn, setProtractorOn] = useState(false);
  const [protractor, setProtractor] = useState(null);    // { surface, pivot, cursor, locked }
  const [declination, setDeclination] = useState("");    // texto digitado: desvio magnético em graus, com sinal
  const [mapType, setMapType] = useState(null);          // escala: "aviation", "sea" ou "land" (null: sem tipo)
  const [scaleText, setScaleText] = useState("");        // escala digitada, p. ex. "1:1000000"
  // Pontos plotados: cada clique marca um ponto numerado. { id, surface, x, y } em unidades da superfície.
  const [plotOn, setPlotOn] = useState(false);
  const [plots, setPlots] = useState([]);

  // Carrega a imagem (decodifica os formatos que o navegador não mostra).
  useEffect(() => {
    if (!entry.file) {
      setError(t("preview.readError"));
      return undefined;
    }
    if (kind !== "image") return undefined;
    let alive = true;
    let revoke = null;
    getImageBlob(entry.file).then(
      (source) => {
        if (!alive) return;
        const display = toDisplayUrl(source);
        revoke = display.revoke;
        setUrl(display.url);
      },
      () => alive && setError(t("preview.decodeImage")),
    );
    return () => {
      alive = false;
      revoke?.();
    };
    // `t` só muda com o idioma, e a mensagem de erro não precisa recarregar a imagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, kind]);

  // Setas do teclado trocam de arquivo, exceto quando o foco está num campo.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext]);

  const fail = (msg) => () => setError(msg);

  // Resolução gravada no arquivo (só imagens): vira a escala px -> cm.
  useEffect(() => {
    if (kind !== "image" || !entry.file) return undefined;
    let alive = true;
    readImageDpi(entry.file).then((value) => alive && setDpi(value));
    return () => { alive = false; };
  }, [entry, kind]);

  const measurable = kind !== "unsupported" && !error;
  const imageCm = calib?.cmPerUnit ?? cmPerUnitFromDpi(dpi);
  const unitCm = (surface) => (surface === "img" ? imageCm : PDF_CM_PER_UNIT);
  // Rótulo de um trecho medido. Com escala digitada, mostra a distância real (no tipo do mapa);
  // sem ela, o tamanho em cm no papel. Null quando a superfície ainda não tem escala em cm.
  const denominator = parseScale(scaleText);
  const formatFor = (surface) => (px) => {
    const cm = unitCm(surface);
    if (cm == null) return null;
    const paperCm = px * cm;
    return denominator == null
      ? `${formatNumber(paperCm, 2, language)} cm`
      : formatDistance(groundMeters(paperCm, denominator), mapType, language);
  };

  // Rota dos pontos plotados, numa superfície: cada trecho traz o rumo (acima da linha) e a distância
  // em milhas náuticas (abaixo), quando há escala. Com declinação, o rumo magnético vai junto.
  const declinationValue = parseDeclination(declination);
  const routeOf = (surface) => {
    const cm = unitCm(surface);
    const denom = parseScale(scaleText);
    return routeLinks(plots, surface).map((link) => {
      const trueTrack = angleOf(link.from, link.to);
      const magnetic = declinationValue == null ? null : addDeclination(trueTrack, declinationValue);
      const nm = distanceNm(link.px, cm, denom);
      return {
        key: link.key,
        from: link.from,
        to: link.to,
        trackText: `${formatBearing(trueTrack)}${magnetic == null ? "" : ` · ${formatBearing(magnetic)} ${t("route.magnetic")}`}`,
        distance: nm == null ? null : t("route.nm", { value: formatNumber(nm, 1, language) }),
        nm,
      };
    });
  };
  // Total da rota: soma dos trechos com distância, em todas as superfícies.
  const routeSurfaces = [...new Set(plots.map((p) => p.surface))];
  const routeNm = routeSurfaces.reduce((sum, s) => sum + routeOf(s).reduce((acc, l) => acc + (l.nm ?? 0), 0), 0);
  const hasRouteNm = routeSurfaces.some((s) => routeOf(s).some((l) => l.nm != null));

  // Pontos chegam pela camada de medição (um por clique). Cliques repetidos no mesmo lugar são ignorados.
  const addPoint = (surface, p) => {
    if (protractorOn) {
      protractorClick(surface, p);
      return;
    }
    if (draft && draft.surface !== surface) {
      finishDraft();
      setDraft({ surface, points: [p], cursor: p });
      return;
    }
    if (!draft) {
      setDraft({ surface, points: [p], cursor: p });
      return;
    }
    const last = draft.points[draft.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1) return;
    setDraft({ ...draft, points: [...draft.points, p], cursor: p });
  };

  const moveCursor = (surface, p) => {
    if (protractorOn) {
      protractorMove(surface, p);
      return;
    }
    setDraft((d) => (d && d.surface === surface ? { ...d, cursor: p } : d));
  };

  // Clique no transferidor: sem centro (ou já fixado), o clique põe o centro; com centro, fixa o ângulo.
  const protractorClick = (surface, p) => {
    setProtractor((pr) => (pr && pr.surface === surface && pr.pivot && !pr.locked
      ? { ...pr, cursor: p, locked: true }
      : { surface, pivot: p, cursor: p, locked: false }));
  };

  // Movimento: sem centro, o anel acompanha o ponteiro; com centro, a seta acompanha. Depois de fixado, não muda.
  const protractorMove = (surface, p) => {
    setProtractor((pr) => {
      if (!pr) return { surface, pivot: null, cursor: p, locked: false };
      if (pr.locked) return pr;
      if (pr.pivot && pr.surface !== surface) return pr;
      return { ...pr, surface, cursor: p };
    });
  };

  const clearProtractor = () => setProtractor(null);

  // Conclui a medição em andamento: uma linha com ao menos dois pontos vira medição, ou calibração.
  const finishDraft = () => {
    if (draft && draft.points.length >= 2) {
      const line = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, surface: draft.surface, points: draft.points };
      if (calibrating) {
        setCalibLine({ ...line, id: "calib" });
        setCalibrating(false);
      } else {
        setLines((list) => [...list, line]);
      }
    }
    setDraft(null);
  };

  const applyCalibration = (knownCm) => {
    if (!calibLine) return;
    const perUnit = cmPerUnitFromCalibration(knownCm, chainLength(calibLine.points));
    if (perUnit) {
      setCalib({ cmPerUnit: perUnit });
      setLines((list) => [...list, { ...calibLine, id: `${Date.now()}-${list.length}` }]);
    }
    setCalibLine(null);
  };

  const cancelCalibration = () => {
    setCalibLine(null);
    setCalibrating(false);
  };

  const clearAll = () => {
    setLines([]);
    setDraft(null);
  };

  const toggleMeasure = () => {
    const next = !measureOn;
    setMeasureOn(next);
    if (next) {
      setProtractorOn(false);
      setProtractor(null);
      setPlotOn(false);
    } else {
      setDraft(null);
      cancelCalibration();
    }
  };

  const toggleProtractor = () => {
    const next = !protractorOn;
    setProtractorOn(next);
    setProtractor(null);
    if (next) {
      setMeasureOn(false);
      setDraft(null);
      cancelCalibration();
      setPlotOn(false);
    }
  };

  // Plotar pontos: exclusivo com a medição e o transferidor. Cada clique na superfície marca um ponto.
  const togglePlot = () => {
    const next = !plotOn;
    setPlotOn(next);
    if (next) {
      setMeasureOn(false);
      setDraft(null);
      cancelCalibration();
      setProtractorOn(false);
      setProtractor(null);
    }
  };
  const addPlot = (surface, p) => {
    setPlots((list) => [...list, { id: `${Date.now()}-${list.length}`, surface, x: p.x, y: p.y }]);
  };
  const clearPlots = () => setPlots([]);

  // Backspace apaga o último ponto plotado (com o plotar ligado e sem campo em foco).
  useEffect(() => {
    if (!plotOn) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if ((e.key === "Backspace" || e.key === "Delete") && plots.length) {
        e.preventDefault();
        setPlots((list) => list.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [plotOn, plots.length]);

  // Esc com o transferidor na tela apaga o anel ou a seta, sem fechar a janela.
  useEffect(() => {
    if (!protractorOn) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if (e.key === "Escape" && protractor) {
        e.preventDefault();
        e.stopPropagation();
        setProtractor(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [protractorOn, protractor]);

  // Dados do transferidor para a camada: o texto do ângulo só aparece com centro e ponteiro.
  const protractorProps = protractorOn && protractor
    ? {
      surface: protractor.surface,
      pivot: protractor.pivot,
      cursor: protractor.cursor,
      locked: protractor.locked,
      declination: parseDeclination(declination),
      text: protractor.pivot && protractor.cursor
        ? `${formatNumber(angleOf(protractor.pivot, protractor.cursor), 1, language)}°`
        : null,
    }
    : null;

  // Teclado com a medição ligada. Esc conclui a medição em andamento sem fechar a janela
  // (captura antes do listener da janela). Backspace desfaz o último ponto, ou a última medição.
  useEffect(() => {
    if (!measureOn) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if (e.key === "Escape" && draft) {
        e.preventDefault();
        e.stopPropagation();
        finishDraft();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (draft) {
          e.preventDefault();
          setDraft((d) => (d.points.length > 1 ? { ...d, points: d.points.slice(0, -1) } : null));
        } else if (lines.length) {
          e.preventDefault();
          setLines((list) => list.slice(0, -1));
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // finishDraft muda com draft e calibrating, que já estão nas dependências.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureOn, draft, lines.length, calibrating]);

  // Linhas exibidas: as concluídas e, durante a calibração, a linha que aguarda o tamanho real.
  const measureProps = {
    enabled: (measureOn || protractorOn || plotOn) && !error,
    lines: calibLine ? [...lines, calibLine] : lines,
    draft,
    protractor: protractorProps,
    format: formatFor,
    onPoint: addPoint,
    onMove: moveCursor,
    onFinish: protractorOn ? clearProtractor : plotOn ? () => {} : finishDraft,
    plotting: plotOn,
    plots,
    onPlot: addPlot,
    routeOf,
  };

  let body;
  if (kind === "unsupported") {
    body = <p className="preview__note">{t("preview.unsupported")}</p>;
  } else if (error) {
    body = <p className="preview__note">{error}</p>;
  } else if (kind === "pdf") {
    body = (
      <PdfPages
        file={entry.file}
        name={entry.name}
        zoom={zoom}
        brightness={brightness}
        measure={measureProps}
      />
    );
  } else if (!url) {
    body = <p className="preview__note">{t("preview.loading")}</p>;
  } else {
    // Com zoom, a imagem ganha a largura do zoom. A área sempre pode ser arrastada.
    body = (
      <PanView grabbable className="pan-view--media">
        <ImageStage
          src={url}
          alt={entry.name}
          zoom={zoom}
          brightness={brightness}
          measure={measureProps}
          onError={fail(t("preview.browserFormat"))}
        />
      </PanView>
    );
  }

  return (
    <div className="preview">
      <div className="preview__stage">
        {body}
      </div>
      {measurable && (
        // Todas as ferramentas da visualização numa linha só: transferidor, medir, brilho e zoom.
        // As ferramentas da medição (calibrar, apagar) aparecem ao lado do botão medir, só quando ligada.
        <div className="view-tools" role="toolbar" aria-label={t("preview.tools")}>
          <ProtractorToggle enabled={protractorOn} onToggle={toggleProtractor} />
          <DeclinationInput value={declination} onChange={setDeclination} />
          <MeasureToggle enabled={measureOn} onToggle={toggleMeasure} />
          {measureOn && kind === "image" && !calibLine && (
            <CalibrateButton active={calibrating} onToggle={() => setCalibrating((on) => !on)} />
          )}
          {measureOn && calibLine && (
            <CalibrationField
              px={chainLength(calibLine.points)}
              onApply={applyCalibration}
              onCancel={cancelCalibration}
            />
          )}
          {measureOn && (lines.length > 0 || draft) && <ClearButton onClick={clearAll} />}
          <span className="view-tools__sep" aria-hidden="true" />
          <ScaleTool type={mapType} onType={setMapType} text={scaleText} onText={setScaleText} />
          <PlotToggle enabled={plotOn} onToggle={togglePlot} />
          {plotOn && plots.length > 0 && <ClearButton label={t("points.clear")} onClick={clearPlots} />}
          <span className="view-tools__sep" aria-hidden="true" />
          <StepSlider
            label={t("preview.brightness")}
            decLabel={t("preview.brightnessDown")}
            incLabel={t("preview.brightnessUp")}
            resetLabel={t("preview.brightnessReset")}
            leading={<Sun className="tool-group__icon" strokeWidth={1.8} aria-hidden="true" />}
            value={brightness}
            min={BRIGHTNESS_MIN}
            max={BRIGHTNESS_MAX}
            step={1}
            buttonStep={BRIGHTNESS_STEP}
            defaultValue={BRIGHTNESS_DEFAULT}
            format={(v) => `${Math.round(v)}%`}
            onChange={setBrightness}
          />
          <span className="view-tools__sep" aria-hidden="true" />
          <StepSlider
            label={t("preview.zoom")}
            decLabel={t("preview.zoomOut")}
            incLabel={t("preview.zoomIn")}
            resetLabel={t("preview.zoomReset")}
            value={zoom}
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.1}
            precision={1}
            buttonStep={ZOOM_STEP}
            defaultValue={ZOOM_MIN}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={setZoom}
          />
        </div>
      )}
      <nav className="preview__nav" aria-label={t("preview.switchFile")}>
        <button type="button" onClick={onPrev} disabled={!hasPrev} aria-label={t("preview.previous")}><ChevronLeft strokeWidth={2} /></button>
        <div className="preview__meta">
          <span className="preview__name">{entry.name}</span>
          <span className="preview__size">{formatSize(entry.size)}</span>
          {plotOn && hasRouteNm && (
            <span className="preview__route">{`${t("route.total")}: ${t("route.nm", { value: formatNumber(routeNm, 1, language) })}`}</span>
          )}
        </div>
        <button type="button" onClick={onNext} disabled={!hasNext} aria-label={t("preview.next")}><ChevronRight strokeWidth={2} /></button>
        {onToggleLibrary && (
          <button
            type="button"
            onClick={onToggleLibrary}
            aria-pressed={libraryOpen}
            aria-label={t("preview.library")}
            title={`${t("preview.library")} (L)`}
          >
            <PanelRight strokeWidth={2} />
          </button>
        )}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")}
            title={fullscreen ? t("preview.exitFullscreen") : t("preview.fullscreen")}
          >
            {fullscreen ? <Minimize strokeWidth={2} /> : <Maximize strokeWidth={2} />}
          </button>
        )}
        <button type="button" onClick={onClose} aria-label={t("common.close")}><X strokeWidth={2} /></button>
      </nav>
    </div>
  );
}
