// NOTAM e ROTAER pela API da AISWEB (DECEA), a fonte oficial no Brasil. A API pede a ApiKey e a ApiPass,
// que cada pessoa pede ao DECEA: elas ficam no armazenamento local da janela, como as rotas salvas.
// A busca vai para o Rust (comando fetch_aisweb), pelo mesmo motivo do METAR: a API não libera CORS.
// Aqui o XML da API vira objetos; o que não veio na resposta fica como "" ou null.
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./folderAccess";

// A consulta só existe no app de desktop; no navegador a janela avisa e não consulta.
export const isAisAvailable = () => isTauri();

// Erro que o Rust devolve quando a AISWEB recusa a ApiKey ou a ApiPass.
export const INVALID_CREDENTIALS = "INVALID_CREDENTIALS";

// Credencial: letras, números e hífen, até 64 caracteres (a mesma regra do Rust).
const CREDENTIAL = /^[A-Za-z0-9-]{1,64}$/;
export const isValidCredential = (text) => CREDENTIAL.test(String(text ?? "").trim());

const CREDENTIALS_KEY = "mapareader.aisweb";

// Credenciais guardadas, ou null. Registro estranho no armazenamento é ignorado.
export function loadCredentials() {
  try {
    const saved = JSON.parse(localStorage.getItem(CREDENTIALS_KEY) || "null");
    if (saved && isValidCredential(saved.apiKey) && isValidCredential(saved.apiPass)) {
      return { apiKey: saved.apiKey.trim(), apiPass: saved.apiPass.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

// Guarda as credenciais. Sem armazenamento, devolve false: elas valem só nesta janela.
export function saveCredentials({ apiKey, apiPass }) {
  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ apiKey: apiKey.trim(), apiPass: apiPass.trim() }));
    return true;
  } catch {
    return false;
  }
}

// Data do NOTAM no formato AAMMDDHHMM, em UTC (ex.: 2611271800). Sem data válida: null.
export function parseAisDate(raw) {
  const match = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(raw ?? "").trim());
  if (!match) return null;
  const [yy, mm, dd, hh, mi] = match.slice(1).map(Number);
  if (mm < 1 || mm > 12) return null;
  return Date.UTC(2000 + yy, mm - 1, dd, hh, mi);
}

// Texto XML → elemento raiz. Sem texto: null. XML quebrado dá erro, e a janela mostra a falha.
function parseXml(text) {
  if (!text || !text.trim()) return null;
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) throw new Error("XML inválido");
  return doc.documentElement;
}

// Só os filhos diretos: a API repete nomes em níveis diferentes (ex.: "name" do aeródromo e da organização).
const children = (el, name) => [...el.children].filter((c) => c.localName === name);
const child = (el, name) => children(el, name)[0] ?? null;
const textOf = (el, name) => (child(el, name)?.textContent ?? "").trim();

// Lista de NOTAM do código (um "item" por aviso). Resposta sem avisos: lista vazia.
export function parseNotams(xml) {
  const root = parseXml(xml);
  const list = root ? child(root, "notam") : null;
  if (!list) return [];
  return children(list, "item").map((item) => {
    const to = textOf(item, "c");
    return {
      id: textOf(item, "id"),
      number: textOf(item, "n"),
      code: textOf(item, "cod"),
      location: textOf(item, "loc"),
      // Na resposta real, o código ICAO do aeródromo vem em icaoairport_id; "aero" é o nome do aeródromo.
      airport: textOf(item, "icaoairport_id"),
      airportName: textOf(item, "aero"),
      validFrom: parseAisDate(textOf(item, "b")),
      validTo: parseAisDate(to),
      permanent: to === "PERM",
      // Limites vêm em lower/upper; f/g da Q-line ficam vazios nas respostas reais, então servem de reserva.
      lower: textOf(item, "lower") || textOf(item, "f"),
      upper: textOf(item, "upper") || textOf(item, "g"),
      text: textOf(item, "e"),
    };
  });
}

// Medida da pista, com a unidade que a API informar no atributo "unit". A API não manda unidade nas pistas,
// e no ROTAER elas são em metros (ex.: Congonhas 17L/35R tem 1495 m), então metro é o padrão.
function measureOf(el) {
  if (!el) return "";
  const value = el.textContent.trim();
  if (!value) return "";
  return `${value} ${el.getAttribute("unit") || "m"}`;
}

function runwayOf(el) {
  const thresholds = child(el, "thr") ? children(el, "thr") : [];
  return {
    ident: textOf(el, "ident"),
    length: measureOf(child(el, "length")),
    width: measureOf(child(el, "width")),
    // "surface" traz o material (ASPH); "surface_c" traz o código de resistência do pavimento (PCN), que não é para leigos.
    surface: textOf(el, "surface") || textOf(el, "surface_c"),
    thresholds: thresholds.map((thr) => textOf(thr, "ident")).filter(Boolean),
  };
}

// Ficha do aeródromo no ROTAER digital. Sem o código na resposta (o aeródromo não existe no ROTAER): null.
export function parseRotaer(xml) {
  const root = parseXml(xml);
  if (!root || !child(root, "AeroCode")) return null;
  const org = child(root, "org");
  const runways = child(root, "runways");
  const remarks = child(root, "rmk");
  const complements = child(root, "compls");
  // Funcionamento: o texto do elemento; sem texto, a API costuma trazer a observação no atributo "compl".
  const hours = child(root, "workinghour");
  return {
    code: textOf(root, "AeroCode"),
    name: textOf(root, "name"),
    city: textOf(root, "city"),
    state: textOf(root, "uf"),
    status: textOf(root, "status"),
    type: textOf(root, "type"),
    typeUtil: textOf(root, "typeUtil"),
    category: textOf(root, "cat"),
    altitudeFt: textOf(root, "altFt"),
    lat: textOf(root, "lat"),
    lng: textOf(root, "lng"),
    utc: textOf(root, "utc"),
    workingHours: (hours?.textContent.trim() || hours?.getAttribute("compl") || "").trim(),
    organization: org ? textOf(org, "name") : "",
    fir: textOf(root, "fir"),
    runways: runways ? children(runways, "runway").map(runwayOf) : [],
    remarks: remarks ? children(remarks, "rmkText").map((el) => el.textContent.trim()).filter(Boolean) : [],
    complements: complements ? children(complements, "compl").map((el) => el.textContent.trim()).filter(Boolean) : [],
  };
}

// Pede uma área da API pelo Rust e devolve o XML bruto (vazio quando não há dado).
const query = (area, icao, creds) =>
  invoke("fetch_aisweb", { area, icao, apiKey: creds.apiKey, apiPass: creds.apiPass });

export async function fetchNotams(icao, creds) {
  return parseNotams(await query("notam", icao, creds));
}

export async function fetchRotaer(icao, creds) {
  return parseRotaer(await query("rotaer", icao, creds));
}
