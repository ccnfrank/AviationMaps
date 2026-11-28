import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import { isValidIcao, normalizeIcao } from "../lib/weather";
import {
  INVALID_CREDENTIALS,
  fetchNotams,
  fetchRotaer,
  isAisAvailable,
  isValidCredential,
  loadCredentials,
  saveCredentials,
} from "../lib/aisweb";

// Janela do NOTAM e do ROTAER: digita o código ICAO e vê a ficha do aeródromo (ROTAER) e os NOTAM dele.
// As credenciais da AISWEB são pedidas antes da primeira busca e ficam guardadas neste computador.
// A busca roda só ao enviar o campo. Respostas de buscas antigas são descartadas, como no METAR.
export default function NotamDialog({ onClose }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const available = isAisAvailable();
  const [creds, setCreds] = useState(loadCredentials);
  const [editingCreds, setEditingCreds] = useState(creds === null);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | invalid | loading | done | refused
  const [result, setResult] = useState(null); // { icao, rotaer, rotaerFailed, notams, notamsFailed }
  const inputRef = useRef(null);
  const latest = useRef(0);

  // Foco no campo quando ele aparece. Vem depois do foco inicial da janela (que vai para o X), então ganha.
  const searchVisible = available && creds !== null && !editingCreds;
  useEffect(() => {
    if (searchVisible) inputRef.current?.focus();
  }, [searchVisible]);

  // Credenciais salvas, ou só nesta janela quando o armazenamento não está disponível.
  const saveCreds = (next) => {
    saveCredentials(next);
    setCreds({ apiKey: next.apiKey.trim(), apiPass: next.apiPass.trim() });
    setEditingCreds(false);
    setPhase("idle");
  };

  const submit = async (e) => {
    e.preventDefault();
    const icao = normalizeIcao(code);
    setCode(icao);
    if (!searchVisible) return;
    if (!isValidIcao(icao)) {
      latest.current += 1; // uma consulta anterior ainda em curso não vale mais
      setResult(null);
      setPhase("invalid");
      return;
    }
    const id = ++latest.current;
    setPhase("loading");
    setResult(null);
    const [rotaer, notams] = await Promise.allSettled([fetchRotaer(icao, creds), fetchNotams(icao, creds)]);
    if (id !== latest.current) return;
    // A AISWEB recusou a chave: a janela volta às credenciais, com o aviso, em vez de mostrar uma falha genérica.
    const refused = [rotaer, notams].some((r) => r.status === "rejected" && r.reason === INVALID_CREDENTIALS);
    if (refused) {
      setResult(null);
      setPhase("refused");
      setEditingCreds(true);
      return;
    }
    setResult({
      icao,
      rotaer: rotaer.status === "fulfilled" ? rotaer.value : null,
      rotaerFailed: rotaer.status === "rejected",
      notams: notams.status === "fulfilled" ? notams.value : [],
      notamsFailed: notams.status === "rejected",
    });
    setPhase("done");
  };

  return (
    <Modal label={t("notam.title")} className="modal--notam" onClose={onClose}>
      <header className="notam__head">
        <h2 className="notam__title">{t("notam.title")}</h2>
        <button type="button" className="tool-toggle" onClick={onClose} aria-label={t("common.close")} title={t("common.close")}>
          <X strokeWidth={2} aria-hidden="true" />
        </button>
      </header>
      {!available && (
        <div className="notam__body">
          <p className="notam__status notam__status--error">{t("notam.desktopOnly")}</p>
        </div>
      )}
      {available && editingCreds && (
        <CredentialsForm
          initial={creds}
          refused={phase === "refused"}
          onSave={saveCreds}
          onCancel={creds ? () => setEditingCreds(false) : null}
        />
      )}
      {searchVisible && (
        <>
          <form className="notam__form" onSubmit={submit}>
            <input
              ref={inputRef}
              className="notam__input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={4}
              aria-label={t("notam.icaoAria")}
              placeholder={t("notam.icaoPlaceholder")}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (phase === "invalid") setPhase("idle");
              }}
            />
            <button type="submit" className="notam__btn" disabled={phase === "loading"}>
              {t("notam.search")}
            </button>
          </form>
          <button type="button" className="notam__link" onClick={() => setEditingCreds(true)}>
            {t("notam.change")}
          </button>
        </>
      )}
      {available && !editingCreds && (
        <div className="notam__body" aria-live="polite">
          {phase === "invalid" && <p role="alert" className="notam__status notam__status--error">{t("notam.invalid")}</p>}
          {phase === "loading" && <p className="notam__status">{t("notam.loading")}</p>}
          {phase === "done" && result && (
            <>
              <p className="notam__station">
                <strong>{result.icao}</strong>
                {result.rotaer?.name && <span> · {result.rotaer.name}</span>}
              </p>
              <RotaerSection icao={result.icao} rotaer={result.rotaer} failed={result.rotaerFailed} />
              <NotamSection icao={result.icao} notams={result.notams} failed={result.notamsFailed} language={language} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// Formulário das credenciais da AISWEB. Sem credenciais salvas, é o primeiro passo; com elas, pode ser cancelado.
function CredentialsForm({ initial, refused, onSave, onCancel }) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [apiPass, setApiPass] = useState(initial?.apiPass ?? "");
  const [invalid, setInvalid] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!isValidCredential(apiKey) || !isValidCredential(apiPass)) {
      setInvalid(true);
      return;
    }
    onSave({ apiKey, apiPass });
  };

  return (
    <form className="notam__creds" onSubmit={submit}>
      <h3 className="notam__heading">{t("notam.credentials.title")}</h3>
      <p className="notam__status">{t("notam.credentials.hint")}</p>
      {refused && <p role="alert" className="notam__status notam__status--error">{t("notam.credentials.refused")}</p>}
      {invalid && <p role="alert" className="notam__status notam__status--error">{t("notam.credentials.invalid")}</p>}
      <label className="notam__field">
        <span>{t("notam.credentials.apiKey")}</span>
        <input
          className="notam__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </label>
      <label className="notam__field">
        <span>{t("notam.credentials.apiPass")}</span>
        <input
          className="notam__input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={apiPass}
          onChange={(e) => setApiPass(e.target.value)}
        />
      </label>
      <div className="notam__creds-actions">
        {onCancel && (
          <button type="button" className="notam__btn" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        )}
        <button type="submit" className="notam__btn">
          {t("notam.credentials.save")}
        </button>
      </div>
    </form>
  );
}

// Data e hora em UTC, como o NOTAM e o METAR escrevem (ex.: "27/11, 18:00 UTC"). Sem valor: "—".
function formatUtc(language, ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const when = new Intl.DateTimeFormat(language, {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  }).format(ms);
  return `${when} UTC`;
}

function Section({ title, children }) {
  return (
    <section className="notam__section">
      <h3 className="notam__heading">{title}</h3>
      {children}
    </section>
  );
}

function Facts({ rows }) {
  return (
    <dl className="notam__facts">
      {rows.map(([label, value]) => (
        <div key={label} className="notam__fact">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Ficha do aeródromo: dados gerais, pistas e observações do ROTAER.
function RotaerSection({ icao, rotaer, failed }) {
  const { t } = useTranslation();
  const title = t("notam.rotaerTitle");
  if (failed) return <Section title={title}><p className="notam__status notam__status--error">{t("notam.failed")}</p></Section>;
  if (!rotaer) return <Section title={title}><p className="notam__status">{t("notam.noRotaer", { icao })}</p></Section>;
  const rows = [
    [t("notam.facts.city"), [rotaer.city, rotaer.state].filter(Boolean).join(" / ") || "—"],
    [t("notam.facts.status"), rotaer.status || "—"],
    [t("notam.facts.type"), [rotaer.type, rotaer.typeUtil].filter(Boolean).join(" · ") || "—"],
    [t("notam.facts.category"), rotaer.category || "—"],
    [t("notam.facts.altitude"), rotaer.altitudeFt ? `${rotaer.altitudeFt} ft` : "—"],
    [t("notam.facts.coordinates"), rotaer.lat && rotaer.lng ? `${rotaer.lat}, ${rotaer.lng}` : "—"],
    [t("notam.facts.utc"), rotaer.utc ? `UTC ${rotaer.utc}` : "—"],
    [t("notam.facts.hours"), rotaer.workingHours || "—"],
    [t("notam.facts.organization"), rotaer.organization || "—"],
    [t("notam.facts.fir"), rotaer.fir || "—"],
  ];
  const notes = [...rotaer.complements, ...rotaer.remarks];
  return (
    <Section title={title}>
      <Facts rows={rows} />
      {rotaer.runways.length > 0 && (
        <>
          <h4 className="notam__subheading">{t("notam.runways")}</h4>
          <ul className="notam__list">
            {rotaer.runways.map((runway, index) => (
              <li key={`${runway.ident}-${index}`} className="notam__item">
                <span className="notam__number">{runway.ident || "—"}</span>
                {[runway.length && `${t("notam.length")} ${runway.length}`, runway.width && `${t("notam.width")} ${runway.width}`, runway.surface]
                  .filter(Boolean)
                  .map((part) => <span key={part} className="notam__meta"> · {part}</span>)}
                {runway.thresholds.length > 0 && (
                  <span className="notam__meta"> · {t("notam.thresholds")} {runway.thresholds.join(" / ")}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {notes.length > 0 && (
        <>
          <h4 className="notam__subheading">{t("notam.remarks")}</h4>
          <ul className="notam__list">
            {notes.map((note, index) => (
              <li key={index} className="notam__item notam__note">{note}</li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

// NOTAM do código: número, Q-code, validade em UTC, local, limites e o texto do aviso.
function NotamSection({ icao, notams, failed, language }) {
  const { t } = useTranslation();
  const title = t("notam.notamTitle");
  if (failed) return <Section title={title}><p className="notam__status notam__status--error">{t("notam.failed")}</p></Section>;
  if (notams.length === 0) return <Section title={title}><p className="notam__status">{t("notam.noNotam", { icao })}</p></Section>;
  return (
    <Section title={`${title} (${notams.length})`}>
      <ol className="notam__list">
        {notams.map((notam, index) => {
          const validity = notam.permanent
            ? `${formatUtc(language, notam.validFrom)} – ${t("notam.permanent")}`
            : `${formatUtc(language, notam.validFrom)} – ${formatUtc(language, notam.validTo)}`;
          const rows = [
            [t("notam.validity"), validity],
            [t("notam.location"), notam.location || notam.airport || "—"],
          ];
          if (notam.lower || notam.upper) rows.push([t("notam.limits"), `${notam.lower || "—"} – ${notam.upper || "—"}`]);
          return (
            <li key={`${notam.id}-${index}`} className="notam__item">
              <div className="notam__item-head">
                <span className="notam__number">{notam.number || notam.id || "—"}</span>
                {notam.code && <span className="notam__meta">{notam.code}</span>}
              </div>
              <Facts rows={rows} />
              <pre className="notam__text">{notam.text}</pre>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
