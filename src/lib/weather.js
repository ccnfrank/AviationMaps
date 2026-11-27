// METAR e TAF pela API do aviationweather.gov (sem chave). No app Tauri a busca é feita pelo Rust
// (comandos fetch_metar e fetch_taf), porque a API não libera CORS para páginas de outra origem.
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./folderAccess";

// A consulta só existe no app de desktop; no navegador a janela avisa e não consulta.
export const isWeatherAvailable = () => isTauri();

// Código ICAO: quatro letras ou números, em maiúsculas.
const ICAO = /^[A-Z0-9]{4}$/;
export const normalizeIcao = (text) => String(text ?? "").trim().toUpperCase();
export const isValidIcao = (code) => ICAO.test(code);

// Resposta em texto → primeiro item da lista (a consulta é de um código só). Sem corpo ou lista vazia: null.
function firstReport(text) {
  if (!text) return null;
  const list = JSON.parse(text);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

// Observação atual do aeródromo (objeto METAR da API), ou null se não há METAR para o código.
export async function fetchMetar(icao) {
  return firstReport(await invoke("fetch_metar", { icao }));
}

// Previsão do aeródromo (objeto TAF da API), ou null se não há TAF para o código.
export async function fetchTaf(icao) {
  return firstReport(await invoke("fetch_taf", { icao }));
}
