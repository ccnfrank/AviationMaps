// Rotas salvas no app. Ficam no armazenamento local da janela, como a última pasta, e só valem para o
// mapa em que foram feitas: as coordenadas são da imagem ou da página do PDF. O mapa é identificado pelo
// nome e pelo tamanho do arquivo. Sem armazenamento disponível, nada é guardado e a função avisa com null/false.
const KEY = "mapareader.savedRoutes";

// Chave do mapa: o mesmo arquivo (mesmo nome e tamanho) sempre tem as mesmas rotas.
export function mapKeyOf(entry) {
  return `${entry.name}|${entry.size ?? ""}`;
}

// Só entra o que tem o formato de uma rota; registros estranhos no armazenamento são ignorados.
function isRoute(r) {
  return Boolean(r) && typeof r.id === "string" && typeof r.mapKey === "string" && typeof r.name === "string"
    && Array.isArray(r.plots) && Array.isArray(r.winds) && typeof r.savedAt === "number";
}

function readAll() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter(isRoute) : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// Rotas deste mapa, da mais nova para a mais antiga.
export function listRoutes(mapKey) {
  return readAll()
    .filter((r) => r.mapKey === mapKey)
    .sort((a, b) => b.savedAt - a.savedAt);
}

// Guarda a rota do mapa com o nome dado. `route` traz pontos, ventos e os ajustes que mudam as contas
// (desvio com o lado, escala e tipo do mapa). Devolve a rota salva, ou null se o armazenamento recusou.
export function saveRoute(mapKey, name, route) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    mapKey,
    name,
    savedAt: Date.now(),
    plots: route.plots,
    winds: route.winds,
    declination: route.declination ?? "",
    declinationSide: route.declinationSide ?? "W",
    scaleText: route.scaleText ?? "",
    mapType: route.mapType ?? null,
  };
  return writeAll([...readAll(), record]) ? record : null;
}

// Apaga uma rota pelo id. Devolve false se o armazenamento recusou a gravação.
export function deleteRoute(id) {
  return writeAll(readAll().filter((r) => r.id !== id));
}
