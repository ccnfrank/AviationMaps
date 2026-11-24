import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

// Alterna entre o modo noite (escuro, padrão) e o modo dia (claro). Mostra o ícone do modo para onde vai.
export default function ThemeButton({ theme, onToggle }) {
  const { t } = useTranslation();
  const toDay = theme !== "day";
  const label = toDay ? t("theme.toDay") : t("theme.toNight");
  return (
    <button type="button" className="tool-toggle" onClick={onToggle} aria-label={label} title={label}>
      {toDay ? <Sun strokeWidth={1.8} aria-hidden="true" /> : <Moon strokeWidth={1.8} aria-hidden="true" />}
    </button>
  );
}
