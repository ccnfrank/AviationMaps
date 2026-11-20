import { useTranslation } from "react-i18next";
import { LANGUAGES, setLanguage } from "../i18n";

// Seletor EN | PT. O idioma ativo fica marcado; a escolha é guardada neste navegador.
export default function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;
  return (
    <div className="lang-switch" role="group" aria-label={t("language.label")}>
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          aria-pressed={current === code}
          aria-label={t(`language.${code}`)}
          onClick={() => setLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
