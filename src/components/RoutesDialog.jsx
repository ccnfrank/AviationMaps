import { useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";

// Janela das rotas salvas do mapa aberto: salva a rota atual com um nome, e abre ou apaga uma já salva.
// `routes` são só as deste mapa, da mais nova para a mais antiga. `canSave` diz se há pontos plotados.
// Abrir uma rota troca a rota que está no mapa agora; quem decide isso é quem abriu a janela.
// A busca filtra a lista pelo nome enquanto se digita, sem diferenciar maiúsculas (como a busca de mapas).
export default function RoutesDialog({ routes, canSave, onSave, onLoad, onDelete, onClose }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [failed, setFailed] = useState(false);

  const stamp = (ms) => new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" }).format(ms);
  // Nome vazio: a rota leva a data e a hora. Se o armazenamento recusar, a janela avisa e mantém o nome.
  // Ao salvar, a busca é limpa, para a rota nova aparecer na lista.
  const submit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    const saved = onSave(name.trim() || stamp(Date.now()));
    setFailed(!saved);
    if (saved) {
      setName("");
      setQuery("");
    }
  };

  const needle = query.trim().toLowerCase();
  const shown = needle ? routes.filter((route) => route.name.toLowerCase().includes(needle)) : routes;

  const summary = (route) => {
    const parts = [stamp(route.savedAt), t("routes.points", { count: route.plots.length })];
    if (route.winds.length > 0) parts.push(t("routes.winds", { count: route.winds.length }));
    return parts.join(" · ");
  };

  return (
    <Modal label={t("routes.title")} className="modal--routes" onClose={onClose}>
      <header className="routes__head">
        <h2 className="routes__title">{t("routes.title")}</h2>
        <button type="button" className="tool-toggle" onClick={onClose} aria-label={t("common.close")} title={t("common.close")}>
          <X strokeWidth={2} aria-hidden="true" />
        </button>
      </header>
      <form className="routes__save" onSubmit={submit}>
        <input
          className="routes__input"
          type="text"
          aria-label={t("routes.nameAria")}
          placeholder={t("routes.namePlaceholder")}
          maxLength={60}
          value={name}
          disabled={!canSave}
          onChange={(e) => {
            setName(e.target.value);
            setFailed(false);
          }}
        />
        <button type="submit" className="routes__btn" disabled={!canSave}>{t("routes.save")}</button>
      </form>
      {failed && <p role="alert" className="routes__error">{t("routes.saveError")}</p>}
      {routes.length > 0 && (
        <>
          <div className="routes__search">
            <Search strokeWidth={1.8} aria-hidden="true" />
            <input
              className="routes__input"
              type="search"
              aria-label={t("routes.search")}
              placeholder={t("routes.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {shown.length === 0 ? (
            <p className="routes__empty">{t("routes.noMatch")}</p>
          ) : (
            <ul className="routes__list">
              {shown.map((route) => (
                <li key={route.id} className="routes__item">
                  <div className="routes__info">
                    <span className="routes__name">{route.name}</span>
                    <span className="routes__meta">{summary(route)}</span>
                  </div>
                  <button type="button" className="routes__btn" onClick={() => onLoad(route)}>{t("routes.open")}</button>
                  <button
                    type="button"
                    className="tool-toggle"
                    onClick={() => onDelete(route.id)}
                    aria-label={t("routes.deleteNamed", { name: route.name })}
                    title={t("routes.delete")}
                  >
                    <Trash2 strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
