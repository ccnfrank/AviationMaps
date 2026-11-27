import { Fragment, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import { stationFromMetar } from "../lib/metarStation";
import { fetchMetar, fetchTaf, isValidIcao, isWeatherAvailable, normalizeIcao } from "../lib/weather";

// Janela do METAR e da TAF: digita o código ICAO do aeródromo e vê a observação atual e a previsão.
// A consulta roda só ao enviar o campo, não a cada tecla. Respostas de buscas antigas são descartadas.
// `onPlace` (opcional) recebe a estação do METAR para pôr no mapa; quem chama decide como colocá-la.
export default function WeatherDialog({ onClose, onPlace }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const available = isWeatherAvailable();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | invalid | loading | done
  const [result, setResult] = useState(null); // { icao, metar, taf, metarFailed, tafFailed }
  const inputRef = useRef(null);
  const latest = useRef(0);

  // Foco no campo ao abrir. Vem depois do foco inicial da janela (que vai para o X), então ganha.
  useEffect(() => {
    if (available) inputRef.current?.focus();
  }, [available]);

  const submit = async (e) => {
    e.preventDefault();
    const icao = normalizeIcao(code);
    setCode(icao);
    if (!available) return;
    if (!isValidIcao(icao)) {
      latest.current += 1; // uma consulta anterior ainda em curso não vale mais
      setResult(null);
      setPhase("invalid");
      return;
    }
    const id = ++latest.current;
    setPhase("loading");
    setResult(null);
    const [metar, taf] = await Promise.allSettled([fetchMetar(icao), fetchTaf(icao)]);
    if (id !== latest.current) return;
    setResult({
      icao,
      metar: metar.status === "fulfilled" ? metar.value : null,
      metarFailed: metar.status === "rejected",
      taf: taf.status === "fulfilled" ? taf.value : null,
      tafFailed: taf.status === "rejected",
    });
    setPhase("done");
  };

  const station = result?.metar?.name ?? result?.taf?.name;

  return (
    <Modal label={t("weather.title")} className="modal--weather" onClose={onClose}>
      <header className="weather__head">
        <h2 className="weather__title">{t("weather.title")}</h2>
        <button type="button" className="tool-toggle" onClick={onClose} aria-label={t("common.close")} title={t("common.close")}>
          <X strokeWidth={2} aria-hidden="true" />
        </button>
      </header>
      <form className="weather__form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="weather__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={4}
          aria-label={t("weather.icaoAria")}
          placeholder={t("weather.icaoPlaceholder")}
          value={code}
          disabled={!available}
          onChange={(e) => {
            setCode(e.target.value);
            if (phase === "invalid") setPhase("idle");
          }}
        />
        <button type="submit" className="weather__btn" disabled={!available || phase === "loading"}>
          {t("weather.search")}
        </button>
      </form>
      <div className="weather__body" aria-live="polite">
        {!available && <p className="weather__status weather__status--error">{t("weather.desktopOnly")}</p>}
        {phase === "invalid" && <p role="alert" className="weather__status weather__status--error">{t("weather.invalid")}</p>}
        {phase === "loading" && <p className="weather__status">{t("weather.loading")}</p>}
        {phase === "done" && result && (
          <>
            <p className="weather__station">
              <strong>{result.icao}</strong>
              {station && <span> · {station}</span>}
            </p>
            <MetarSection icao={result.icao} metar={result.metar} failed={result.metarFailed} language={language} onPlace={onPlace} />
            <TafSection icao={result.icao} taf={result.taf} failed={result.tafFailed} language={language} />
          </>
        )}
      </div>
    </Modal>
  );
}

// Data e hora em UTC, como o METAR e a TAF escrevem (ex.: "27/11, 08:00 UTC"). Sem valor válido: "—".
function formatUtc(language, ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const when = new Intl.DateTimeFormat(language, {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  }).format(ms);
  return `${when} UTC`;
}

// A API dá horários em segundos (UNIX). Sem valor, fica null: null * 1000 seria 1970.
const secondsToMs = (seconds) => (seconds == null ? null : seconds * 1000);

// Valor com a unidade ("17 °C"), ou "—" quando a API não trouxe o campo.
const measure = (value, unit) => (value == null ? "—" : `${value} ${unit}`);

// Vento: "140° · 6 kt (rajada 20 kt)". VRB vira "variável"; vento zero vira "calmo".
function windText(t, wdir, wspd, wgst) {
  if (wdir == null && wspd == null) return "—";
  if (wspd === 0) return t("weather.calm");
  const dir = wdir == null ? "—" : wdir === "VRB" ? t("weather.variable") : `${wdir}°`;
  const speed = wspd == null ? "" : ` · ${wspd} kt`;
  const gust = wgst == null ? "" : ` (${t("weather.gust", { speed: wgst })})`;
  return `${dir}${speed}${gust}`;
}

// Visibilidade em milhas terrestres (sm). "6+" quer dizer mais de 6 milhas.
const visibilityText = (visib) => measure(visib, "sm");

// Nuvens: "FEW 2200 ft, BKN 3200 ft". Camada sem base (CLR, CAVOK) mostra só o código.
function cloudsText(t, clouds) {
  if (clouds == null) return "—";
  if (clouds.length === 0) return t("weather.noClouds");
  return clouds.map((c) => (c.base == null ? c.cover : `${c.cover} ${c.base} ft`)).join(", ");
}

function Section({ title, children }) {
  return (
    <section className="weather__section">
      <h3 className="weather__heading">{title}</h3>
      {children}
    </section>
  );
}

function Facts({ rows }) {
  return (
    <dl className="weather__facts">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function MetarSection({ icao, metar, failed, language, onPlace }) {
  const { t } = useTranslation();
  const title = t("weather.metarTitle");
  if (failed) return <Section title={title}><p className="weather__status weather__status--error">{t("weather.failed")}</p></Section>;
  if (!metar) return <Section title={title}><p className="weather__status">{t("weather.noMetar", { icao })}</p></Section>;
  const rows = [
    [t("weather.observed"), formatUtc(language, secondsToMs(metar.obsTime))],
    [t("weather.wind"), windText(t, metar.wdir, metar.wspd, metar.wgst)],
    [t("weather.visibility"), visibilityText(metar.visib)],
    [t("weather.clouds"), cloudsText(t, metar.clouds)],
  ];
  if (metar.wxString) rows.push([t("weather.weather"), metar.wxString]);
  rows.push(
    [t("weather.temperature"), `${measure(metar.temp, "°C")} / ${measure(metar.dewp, "°C")}`],
    [t("weather.altimeter"), measure(metar.altim, "hPa")],
    [t("weather.flightCategory"), metar.fltCat ?? "—"],
  );
  return (
    <Section title={title}>
      <Facts rows={rows} />
      <h4 className="weather__subheading">{t("weather.rawMetar")}</h4>
      <pre className="weather__raw">{metar.rawOb}</pre>
      {onPlace && (
        <button
          type="button"
          className="weather__btn weather__plot"
          title={t("weather.plotTitle")}
          onClick={() => onPlace(stationFromMetar(metar))}
        >
          {t("weather.plot")}
        </button>
      )}
    </Section>
  );
}

// Um período da previsão: a base, ou uma mudança (TEMPO, BECMG, FM, PROB30).
function TafPeriod({ period, language }) {
  const { t } = useTranslation();
  const tags = [period.probability == null ? null : `PROB${period.probability}`, period.fcstChange].filter(Boolean);
  const label = tags.length > 0 ? tags.join(" ") : t("weather.base");
  const rows = [
    [t("weather.period"), `${formatUtc(language, secondsToMs(period.timeFrom))} – ${formatUtc(language, secondsToMs(period.timeTo))}`],
    [t("weather.wind"), windText(t, period.wdir, period.wspd, period.wgst)],
    [t("weather.visibility"), visibilityText(period.visib)],
    [t("weather.clouds"), cloudsText(t, period.clouds)],
  ];
  if (period.wxString) rows.push([t("weather.weather"), period.wxString]);
  return (
    <li className="weather__period">
      <div className="weather__period-head">{label}</div>
      <Facts rows={rows} />
    </li>
  );
}

function TafSection({ icao, taf, failed, language }) {
  const { t } = useTranslation();
  const title = t("weather.tafTitle");
  if (failed) return <Section title={title}><p className="weather__status weather__status--error">{t("weather.failed")}</p></Section>;
  if (!taf) return <Section title={title}><p className="weather__status">{t("weather.noTaf", { icao })}</p></Section>;
  const rows = [
    [t("weather.issued"), formatUtc(language, Date.parse(taf.issueTime))],
    [t("weather.valid"), `${formatUtc(language, secondsToMs(taf.validTimeFrom))} – ${formatUtc(language, secondsToMs(taf.validTimeTo))}`],
  ];
  return (
    <Section title={title}>
      <Facts rows={rows} />
      <h4 className="weather__subheading">{t("weather.rawTaf")}</h4>
      <pre className="weather__raw">{taf.rawTAF}</pre>
      {taf.fcsts?.length > 0 && (
        <>
          <h4 className="weather__subheading">{t("weather.forecast")}</h4>
          <ol className="weather__periods">
            {taf.fcsts.map((period, index) => (
              <TafPeriod key={index} period={period} language={language} />
            ))}
          </ol>
        </>
      )}
    </Section>
  );
}
