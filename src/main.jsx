import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import "@fontsource-variable/instrument-sans";
import "./styles.css";
import { applyTheme, readTheme } from "./lib/theme";

// Liga o tema salvo antes de desenhar, para o modo dia não piscar com o escuro.
applyTheme(readTheme());
createRoot(document.getElementById("root")).render(<App />);
