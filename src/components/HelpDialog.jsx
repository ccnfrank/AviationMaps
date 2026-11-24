import { Fragment } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";

// Teclas de um atalho. `keys` são alternativas (ex.: + ou =); cada alternativa é uma combinação (Alt + +).
function Keys({ keys }) {
  const { t } = useTranslation();
  return keys.map((combo, i) => (
    <Fragment key={i}>
      {i > 0 && <span className="help__or">{t("help.or")}</span>}
      {combo.map((key, j) => (
        <Fragment key={j}>
          {j > 0 && <span className="help__plus" aria-hidden="true">+</span>}
          <kbd className="help__key">{key}</kbd>
        </Fragment>
      ))}
    </Fragment>
  ));
}

// Documentação do app: como abrir mapas, cada ferramenta e todos os atalhos.
// O texto vem dos arquivos de idioma (help.sections), então muda com o idioma escolhido.
export default function HelpDialog({ onClose }) {
  const { t } = useTranslation();
  const sections = t("help.sections", { returnObjects: true });
  return (
    <Modal label={t("help.title")} className="modal--help" onClose={onClose}>
      <header className="help__head">
        <h2 className="help__title">{t("help.title")}</h2>
        <button type="button" className="tool-toggle" onClick={onClose} aria-label={t("common.close")} title={t("common.close")}>
          <X strokeWidth={2} aria-hidden="true" />
        </button>
      </header>
      <div className="help__body">
        {sections.map((section, i) => (
          <section key={i} className="help__section">
            <h3 className="help__heading">{section.title}</h3>
            {section.paragraphs?.map((text, j) => <p key={j}>{text}</p>)}
            {section.items && (
              <ul className="help__list">
                {section.items.map((text, j) => <li key={j}>{text}</li>)}
              </ul>
            )}
            {section.shortcuts && (
              <dl className="help__shortcuts">
                {section.shortcuts.map((shortcut, j) => (
                  <Fragment key={j}>
                    <dt><Keys keys={shortcut.keys} /></dt>
                    <dd>{shortcut.text}</dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </section>
        ))}
      </div>
    </Modal>
  );
}
