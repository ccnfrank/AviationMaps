import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, Minimize, PanelRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatSize } from "../lib/format";
import { BRIGHTNESS_DEFAULT, BRIGHTNESS_MAX, BRIGHTNESS_MIN, ZOOM_MAX, ZOOM_MIN, clamp } from "../lib/viewRange";
import { getPreviewKind } from "../lib/previewKind";
import { getImageBlob } from "../lib/media/decodeImage";
import { toDisplayUrl } from "../lib/displayUrl";
import {
  PDF_CM_PER_UNIT, addDeclination, angleOf, chainLength, cmPerUnitFromCalibration, cmPerUnitFromDpi, formatNumber,
  declinationFrom, readImageDpi,
} from "../lib/measure";
import { distanceNm, formatBearing, routeLinks } from "../lib/route";
import PdfPages from "./PdfPages";
import PanView from "./PanView";
import ImageStage from "./ImageStage";
import { CalibrateButton, CalibrationField, ClearButton, ExportRouteButton, MeasureToggle, MetarButton, OtherMapsButton, PlotToggle, ResetButton, RoutesButton, WindToggle } from "./MeasureTools";
import RoutesDialog from "./RoutesDialog";
import { deleteRoute, listRoutes, mapKeyOf, saveRoute } from "../lib/savedRoutes";
import { legFigures } from "../lib/routeLegs";
import { routeCsv } from "../lib/routeExport";
import { saveTextFile } from "../lib/saveFile";
import { DeclinationInput, ProtractorToggle } from "./Protractor";
import ScaleTool from "./ScaleTool";
import { formatDistance, groundMeters, parseScale } from "../lib/scale";

// Cada + ou − muda o zoom meio passo, e o brilho 5 pontos. Os limites ficam em lib/viewRange.
const ZOOM_STEP = 0.5;
const BRIGHTNESS_STEP = 5;
// Sentido de cada tecla: +1 aumenta, −1 diminui. Pelo caractere (zoom) ou pelo código (brilho com Alt).
const KEY_DIRECTION = { "+": 1, "=": 1, "-": -1 };
const CODE_DIRECTION = { Equal: 1, NumpadAdd: 1, Minus: -1, NumpadSubtract: -1 };

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
  const [declination, setDeclination] = useState("");    // texto digitado: variação magnética em graus, sem sinal
  const [declinationSide, setDeclinationSide] = useState("W"); // lado da variação: "E" (leste) ou "W" (oeste)
  const [mapType, setMapType] = useState(null);          // escala: "aviation", "sea" ou "land" (null: sem tipo)
  const [scaleText, setScaleText] = useState("");        // escala digitada, p. ex. "1:1000000"
  // Pontos plotados: cada clique marca um ponto numerado. { id, surface, x, y } em unidades da superfície.
  const [plotOn, setPlotOn] = useState(false);
  const [plots, setPlots] = useState([]);
  // Vento: cada clique no mapa abre a entrada; ao confirmar, uma seta fica no ponto.
  const [windOn, setWindOn] = useState(false);
  const [winds, setWinds] = useState([]);           // setas: { id, surface, x, y, dir, speed, magnetic, tas }; tas em nós, opcional, de cada vento
  const [windPending, setWindPending] = useState(null); // { surface, x, y, dir? }: aguardando direção, velocidade e TAS
  // Transferidor do vento: o centro é o clique que abre o formulário; o ponteiro aponta de onde o vento vem.
  // O segundo clique fixa o ângulo (vira a direção) e deixa a seta parada. { surface, pivot, cursor, locked }.
  const [windAim, setWindAim] = useState(null);
  const [windEditId, setWindEditId] = useState(null);   // seta em correção (duplo clique): id
  const [speedUnit, setSpeedUnit] = useState("kt");     // unidade da velocidade do vento e da TAS nos formulários: "kt" ou "kmh"
  // Rotas salvas: só as deste mapa (a chave do arquivo). A janela abre com a tecla R ou pelo botão da barra.
  const mapKey = mapKeyOf(entry);
  const [savedRoutes, setSavedRoutes] = useState(() => listRoutes(mapKey));
  const [routesOpen, setRoutesOpen] = useState(false);

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

  // Setas do teclado trocam de arquivo, exceto quando o foco está num campo ou numa janela de rotas aberta.
  useEffect(() => {
    const onKey = (e) => {
      if (routesOpen || e.target.closest?.("input, textarea")) return;
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      else if (e.key === "ArrowRight" && hasNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext, routesOpen]);

  const fail = (msg) => () => setError(msg);

  // Resolução gravada no arquivo (só imagens): vira a escala px -> cm.
  useEffect(() => {
    if (kind !== "image" || !entry.file) return undefined;
    let alive = true;
    readImageDpi(entry.file).then((value) => alive && setDpi(value));
    return () => { alive = false; };
  }, [entry, kind]);

  const measurable = kind !== "unsupported" && !error;

  // Atalhos de zoom e brilho, sem campo em foco:
  // + e − mudam o zoom; Alt (Option) com + e − muda o brilho. O zoom usa o caractere da tecla;
  // o brilho usa o código da tecla, porque o Option troca o caractere no Mac.
  useEffect(() => {
    if (!measurable) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey) return; // Cmd/Ctrl + é do navegador (zoom da página)
      if (e.altKey) {
        const dir = CODE_DIRECTION[e.code];
        if (!dir) return;
        setBrightness((b) => clamp(b + dir * BRIGHTNESS_STEP, BRIGHTNESS_MIN, BRIGHTNESS_MAX));
        return;
      }
      const dir = KEY_DIRECTION[e.key];
      if (!dir) return;
      setZoom((z) => clamp(z + dir * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measurable]);

  // Tecla R: abre as rotas salvas do mapa. Sem campo em foco, sem Cmd, Ctrl ou Alt, e sem a janela já aberta.
  useEffect(() => {
    if (!measurable) return undefined;
    const onKey = (e) => {
      if (e.key.toLowerCase() !== "r" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (routesOpen || e.target.closest?.("input, textarea, [contenteditable]")) return;
      setRoutesOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [measurable, routesOpen]);

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
  // Desvio com sinal (leste negativo, oeste positivo): é ele que entra nos cálculos e no transferidor.
  const declinationValue = declinationFrom(declination, declinationSide);
  const routeOf = (surface) => {
    const ctx = {
      winds: winds.filter((w) => w.surface === surface),
      declination: declinationValue,
      cmPerUnit: unitCm(surface),
      denominator: parseScale(scaleText),
    };
    return routeLinks(plots, surface).map((link) => {
      const f = legFigures(link, ctx);
      let headingText = null;
      if (f.wind && f.tas == null) headingText = t("route.needTas");
      else if (f.wind && !f.correction) headingText = t("route.windAboveTas");
      if (f.correction) {
        headingText = `${t("route.heading")} ${formatBearing(f.headingTrue)}${f.headingMag == null ? "" : ` · ${formatBearing(f.headingMag)} ${t("route.magnetic")}`}`;
      }
      const track = `${formatBearing(f.trueTrack)}${f.magTrack == null ? "" : ` · ${formatBearing(f.magTrack)} ${t("route.magnetic")}`}`;
      return {
        key: link.key,
        from: link.from,
        to: link.to,
        trackText: headingText ? `${track} · ${headingText}` : track,
        distance: f.nm == null ? null : t("route.nm", { value: formatNumber(f.nm, 1, language) }),
        nm: f.nm,
        // Avião sobre o trecho: o nariz aponta para a proa verdadeira do cálculo (ou o rumo, sem vento).
        // Fica no vento mais perto, ou no meio do trecho sem vento.
        heading: f.noseHeading,
        anchor: f.wind ? { x: f.wind.x, y: f.wind.y } : f.mid,
        // Rumo verdadeiro do trecho, e como corrigi-lo pelo duplo clique: o segundo ponto anda sobre a nova direção.
        track: f.trueTrack,
        onTrack: (deg) => setLegTrack(link, deg),
      };
    });
  };
  // Exporta a rota em CSV, trecho por trecho, em todas as superfícies: rumos, distância, vento, TAS, correção e proa.
  const exportRoute = async () => {
    const n = (v, digits = 1) => (v == null ? "" : formatNumber(v, digits, language));
    const rows = [[
      t("route.export.leg"), t("route.export.surface"), t("route.export.from"), t("route.export.to"),
      t("route.export.track"), t("route.export.trackMag"), t("route.export.distance"),
      t("route.export.windDir"), t("route.export.windSpeed"), t("route.export.windRef"), t("route.export.tas"),
      t("route.export.drift"), t("route.export.heading"), t("route.export.headingMag"), t("route.export.gs"), t("route.export.note"),
    ]];
    const name = (p) => p.name ?? String(plots.indexOf(p) + 1);
    let leg = 0;
    for (const surface of [...new Set(plots.map((p) => p.surface))]) {
      const ctx = {
        winds: winds.filter((w) => w.surface === surface),
        declination: declinationValue,
        cmPerUnit: unitCm(surface),
        denominator: parseScale(scaleText),
      };
      const surfaceLabel = surface === "img" ? t("route.export.image") : `${t("route.export.page")} ${Number(surface.split(":")[1]) + 1}`;
      for (const link of routeLinks(plots, surface)) {
        leg += 1;
        const f = legFigures(link, ctx);
        let note = "";
        if (f.wind && f.tas == null) note = t("route.needTas");
        else if (f.wind && !f.correction) note = t("route.windAboveTas");
        rows.push([
          leg, surfaceLabel, name(link.from), name(link.to),
          n(f.trueTrack), n(f.magTrack), n(f.nm),
          f.wind ? n(f.wind.dir) : "", f.wind ? n(f.wind.speed) : "", f.wind ? (f.wind.magnetic ? "M" : "V") : "",
          n(f.tas),
          n(f.correction?.wca), n(f.headingTrue), n(f.headingMag), n(f.correction?.groundSpeed),
          note,
        ]);
      }
    }
    const fileName = `${entry.name.replace(/\.[^.]+$/, "")} - ${t("route.export.fileSuffix")}.csv`;
    await saveTextFile(routeCsv(rows, language), fileName);
  };

  // Rotas salvas: guarda a rota do mapa (pontos, ventos e os ajustes das contas) com o nome dado.
  // Devolve false se o armazenamento recusou; a lista da janela volta a ler o que ficou guardado.
  const saveCurrentRoute = (name) => {
    const saved = saveRoute(mapKey, name, { plots, winds, declination, declinationSide, scaleText, mapType });
    setSavedRoutes(listRoutes(mapKey));
    return saved !== null;
  };
  // Abrir uma rota salva põe os pontos, os ventos e os ajustes dela no lugar da rota atual. Ids novos evitam repetição.
  const loadSavedRoute = (route) => {
    const stamp = Date.now();
    setPlots(route.plots.map((p, i) => ({ ...p, id: `${stamp}-p${i}` })));
    setWinds(route.winds.map((w, i) => ({ ...w, id: `${stamp}-w${i}` })));
    setDeclination(route.declination);
    setDeclinationSide(route.declinationSide);
    setScaleText(route.scaleText);
    setMapType(route.mapType);
    setWindPending(null);
    setWindAim(null);
    setWindEditId(null);
    setRoutesOpen(false);
  };
  const removeSavedRoute = (id) => {
    deleteRoute(id);
    setSavedRoutes(listRoutes(mapKey));
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
    if (windOn) {
      // Transferidor do vento: a seta acompanha o ponteiro até o segundo clique.
      setWindAim((a) => (a && a.surface === surface && !a.locked ? { ...a, cursor: p } : a));
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
  // Reset: limpa tudo no mapa (medições, calibração pendente, transferidor, pontos plotados e ventos).
  // Os modos ligados (medir, plotar, vento...) e a escala ficam como estão.
  const resetAll = () => {
    setLines([]);
    setDraft(null);
    cancelCalibration();
    setProtractor(null);
    setPlots([]);
    setWinds([]);
    setWindPending(null);
    setWindAim(null);
    setWindEditId(null);
  };
  const hasAnything = lines.length > 0 || draft != null || protractor != null || plots.length > 0 || winds.length > 0 || windPending != null;

  const toggleMeasure = () => {
    const next = !measureOn;
    setMeasureOn(next);
    if (next) {
      setProtractorOn(false);
      setProtractor(null);
      setPlotOn(false);
      setWindOn(false);
      setWindPending(null);
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
      setWindOn(false);
      setWindPending(null);
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
      setWindOn(false);
      setWindPending(null);
    }
  };
  const addPlot = (surface, p) => {
    setPlots((list) => [...list, { id: `${Date.now()}-${list.length}`, surface, x: p.x, y: p.y }]);
  };
  const clearPlots = () => setPlots([]);
  // Option + clique no ponto apaga só esse ponto.
  const deletePlot = (id) => setPlots((list) => list.filter((p) => p.id !== id));
  // Nome do ponto (até 8 letras). Vazio volta ao número do ponto.
  const renamePlot = (id, name) => {
    setPlots((list) => list.map((p) => (p.id === id ? { ...p, name: name || undefined } : p)));
  };
  // Arrastar um ponto plotado: a posição nova vem em unidades da superfície (a camada já limita à superfície).
  const movePlot = (id, p) => {
    setPlots((list) => list.map((q) => (q.id === id ? { ...q, x: p.x, y: p.y } : q)));
  };
  // Corrige o rumo de um trecho: o segundo ponto anda sobre a nova direção, mantendo a distância.
  const setLegTrack = (link, deg) => {
    const rad = (deg * Math.PI) / 180;
    const x = link.from.x + Math.sin(rad) * link.px;
    const y = link.from.y - Math.cos(rad) * link.px;
    setPlots((list) => list.map((p) => (p.id === link.to.id ? { ...p, x, y } : p)));
  };

  // Vento: exclusivo com as outras ferramentas. Clicar no mapa marca o ponto; o campo pede direção e velocidade.
  const toggleWind = () => {
    const next = !windOn;
    setWindOn(next);
    setWindPending(null);
    setWindAim(null);
    if (next) {
      setMeasureOn(false);
      setDraft(null);
      cancelCalibration();
      setProtractorOn(false);
      setProtractor(null);
      setPlotOn(false);
    }
  };
  // Clique no mapa com vento ligado. Com o transferidor do vento solto, o clique fixa o ângulo do centro
  // ao ponteiro e preenche a direção. Sem ele, abre o formulário no ponto e começa o transferidor ali.
  const windClick = (surface, p) => {
    setWindEditId(null);
    if (windAim && windAim.surface === surface && !windAim.locked && windPending) {
      if (Math.hypot(p.x - windAim.pivot.x, p.y - windAim.pivot.y) < 1) return;
      const dir = Math.round(angleOf(windAim.pivot, p)) % 360;
      setWindAim({ ...windAim, cursor: p, locked: true });
      setWindPending({ ...windPending, dir });
      return;
    }
    setWindPending({ surface, x: p.x, y: p.y });
    setWindAim({ surface, pivot: p, cursor: p, locked: false });
  };
  // Duplo clique numa seta: abre a correção dela. Direção, velocidade, referência e TAS.
  const editWind = (id) => {
    setWindPending(null);
    setWindAim(null);
    setWindEditId(id);
  };
  const submitWindEdit = ({ dir, speed, magnetic = false, tas = null }) => {
    if (windEditId == null) return;
    setWinds((list) => list.map((w) => (w.id === windEditId ? { ...w, dir, speed, magnetic, tas } : w)));
    setWindEditId(null);
  };
  const cancelWindEdit = () => setWindEditId(null);
  // Cada vento leva a sua direção, velocidade, referência e TAS (em nós; null se não digitada).
  const submitWind = ({ dir, speed, magnetic = false, tas = null }) => {
    if (!windPending) return;
    const { surface, x, y } = windPending;
    setWinds((list) => [...list, { id: `${Date.now()}-${list.length}`, surface, x, y, dir, speed, magnetic, tas }]);
    setWindPending(null);
    setWindAim(null);
  };
  // Unidade dos formulários de vento (nós ou km/h), também usada nos rótulos das setas.
  const toggleWindUnit = () => setSpeedUnit((u) => (u === "kt" ? "kmh" : "kt"));
  const cancelWind = () => {
    setWindPending(null);
    setWindAim(null);
  };
  const clearWinds = () => {
    setWinds([]);
    setWindPending(null);
    setWindAim(null);
  };
  // Option + clique na seta (ou no rótulo) apaga só esse vento; se ele estava em correção, fecha a correção.
  const deleteWind = (id) => {
    setWinds((list) => list.filter((w) => w.id !== id));
    setWindEditId((current) => (current === id ? null : current));
  };

  // Backspace com o vento ligado: primeiro cancela a entrada em andamento; depois apaga a última seta.
  useEffect(() => {
    if (!windOn) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if ((e.key === "Backspace" || e.key === "Delete") && (windPending || winds.length)) {
        e.preventDefault();
        if (windPending) setWindPending(null);
        else setWinds((list) => list.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [windOn, windPending, winds.length]);

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

  // Transferidor do vento para a camada: o ângulo aparece em graus inteiros, enquanto o ponteiro se move.
  const windAimProps = windOn && windAim
    ? {
      surface: windAim.surface,
      pivot: windAim.pivot,
      cursor: windAim.cursor,
      locked: windAim.locked,
      text: `${Math.round(angleOf(windAim.pivot, windAim.cursor)) % 360}°`,
    }
    : null;

  // Dados do transferidor para a camada: o texto do ângulo só aparece com centro e ponteiro.
  const protractorProps = protractorOn && protractor
    ? {
      surface: protractor.surface,
      pivot: protractor.pivot,
      cursor: protractor.cursor,
      locked: protractor.locked,
      declination: declinationValue,
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
    enabled: (measureOn || protractorOn || plotOn || windOn) && !error,
    lines: calibLine ? [...lines, calibLine] : lines,
    draft,
    protractor: protractorProps,
    format: formatFor,
    onPoint: addPoint,
    onMove: moveCursor,
    onFinish: protractorOn ? clearProtractor : plotOn || windOn ? () => {} : finishDraft,
    plotting: plotOn,
    plots,
    onPlot: addPlot,
    onRenamePlot: renamePlot,
    onMovePlot: movePlot,
    onDeletePlot: deletePlot,
    routeOf,
    windOn,
    windUnit: speedUnit,
    winds,
    windPending,
    windAim: windAimProps,
    onWind: windClick,
    onWindSubmit: submitWind,
    onWindCancel: cancelWind,
    onDeleteWind: deleteWind,
    windEdit: {
      id: windEditId,
      onUnit: toggleWindUnit,
      onEdit: editWind,
      onSubmit: submitWindEdit,
      onCancel: cancelWindEdit,
    },
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
        onZoom={setZoom}
        brightness={brightness}
        onBrightness={setBrightness}
        measure={measureProps}
      />
    );
  } else if (!url) {
    body = <p className="preview__note">{t("preview.loading")}</p>;
  } else {
    // Com zoom, a imagem ganha a largura do zoom. A área sempre pode ser arrastada.
    body = (
      <PanView
        grabbable
        className="pan-view--media"
        zoom={zoom}
        onZoom={setZoom}
        brightness={brightness}
        onBrightness={setBrightness}
      >
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
        // Todas as ferramentas da visualização numa linha só: transferidor, medir, escala e pontos.
        // As ferramentas da medição (calibrar, apagar) aparecem ao lado do botão medir, só quando ligada.
        <div className="view-tools" role="toolbar" aria-label={t("preview.tools")}>
          <ProtractorToggle enabled={protractorOn} onToggle={toggleProtractor} />
          <DeclinationInput value={declination} onChange={setDeclination} side={declinationSide} onSide={setDeclinationSide} />
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
          {/* METAR e outros mapas: só o ícone por enquanto. As funções vêm depois. */}
          <MetarButton />
          <WindToggle enabled={windOn} onToggle={toggleWind} />
          {windOn && winds.length > 0 && <ClearButton label={t("wind.clear")} onClick={clearWinds} />}
          <OtherMapsButton />
          {/* Rotas salvas, exportar e reset ficam no fim da barra, nesta ordem; o reset é o último, à direita. */}
          <RoutesButton onClick={() => setRoutesOpen(true)} />
          <ExportRouteButton onClick={exportRoute} disabled={plots.length < 2} />
          <ResetButton onClick={resetAll} disabled={!hasAnything} />
        </div>
      )}
      {routesOpen && (
        <RoutesDialog
          routes={savedRoutes}
          canSave={plots.length > 0}
          onSave={saveCurrentRoute}
          onLoad={loadSavedRoute}
          onDelete={removeSavedRoute}
          onClose={() => setRoutesOpen(false)}
        />
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
