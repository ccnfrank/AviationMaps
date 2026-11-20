import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import "@fontsource-variable/instrument-sans";
import "./styles.css";

createRoot(document.getElementById("root")).render(<App />);
