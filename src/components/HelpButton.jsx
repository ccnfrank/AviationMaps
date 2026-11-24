import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import HelpDialog from "./HelpDialog";

// Ícone de ajuda ao lado do seletor de idioma: abre a documentação do app.
export default function HelpButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="tool-toggle"
        onClick={() => setOpen(true)}
        aria-label={t("help.button")}
        title={t("help.button")}
      >
        <CircleHelp strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && <HelpDialog onClose={() => setOpen(false)} />}
    </>
  );
}
