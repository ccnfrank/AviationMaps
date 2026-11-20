import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import pt from "./locales/pt.json";

// Idiomas disponíveis. A escolha fica guardada neste navegador; sem ela, vale o idioma do sistema.
export const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "pt", label: "PT" },
];
const KEY = "mapareader.language";

export function readLanguage() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "pt") return saved;
  } catch {
    // sem armazenamento: vale o idioma do sistema
  }
  const system = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return system.toLowerCase().startsWith("pt") ? "pt" : "en";
}

export function setLanguage(code) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // sem armazenamento: a escolha vale só nesta sessão
  }
  i18n.changeLanguage(code);
}

i18n.on("languageChanged", (code) => {
  if (typeof document !== "undefined") document.documentElement.lang = code;
});

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, pt: { translation: pt } },
  lng: readLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
