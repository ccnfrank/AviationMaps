import { ROOT_NAME } from "./groupFiles";

// Conteúdo de uma pasta na busca, um nível de cada vez. `files` são os mapas de uma pasta carregada
// (relPath relativo a ela) e `dir` é o caminho aberto dentro dela: "" é a raiz da pasta,
// "dia2" ou "dia2/sul" são subpastas. Devolve as subpastas diretas (com a contagem de mapas
// de tudo que fica dentro delas) e só os mapas que estão diretamente em `dir`.
export function listDir(files, dir = "") {
  const prefix = dir ? `${dir}/` : "";
  const subdirs = new Map();
  const maps = [];
  for (const entry of files) {
    if (!entry.relPath.startsWith(prefix)) continue;
    const rest = entry.relPath.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash < 0) {
      maps.push(entry);
      continue;
    }
    const name = rest.slice(0, slash);
    const sub = subdirs.get(name) ?? { name, path: prefix + name, count: 0 };
    sub.count += 1;
    subdirs.set(name, sub);
  }
  const sorted = [...subdirs.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { subdirs: sorted, maps };
}

// Pasta de cima de `dir`: "dia2/sul" -> "dia2", "dia2" -> "".
export function parentDir(dir) {
  const i = dir.lastIndexOf("/");
  return i < 0 ? "" : dir.slice(0, i);
}

// Chave de uma pasta nos favoritos: o caminho dela a partir da pasta carregada, "dia2" ou "dia2/sul".
// `dir` é o caminho dentro da pasta carregada, como em listDir; "" é a própria pasta.
export function folderKeyOf(folderName, dir = "") {
  return dir ? `${folderName}/${dir}` : folderName;
}

// Todas as pastas das pastas carregadas, em todos os níveis, com a contagem de mapas que ficam dentro
// de cada uma (também os de subpastas). `key` é a chave de favorito, `label` o nome completo ("dia2 / sul"),
// e `folderIndex` e `dir` dizem como abrir a pasta, como o nível aberto da busca. Os arquivos soltos
// na pasta carregada (ROOT_NAME) não entram: não são uma pasta.
export function listAllDirs(folders) {
  const dirs = new Map();
  folders.forEach((folder, folderIndex) => {
    if (folder.name === ROOT_NAME) return;
    const topKey = folderKeyOf(folder.name);
    dirs.set(topKey, { key: topKey, label: folder.name, folderIndex, dir: "", count: folder.files.length });
    for (const entry of folder.files) {
      let dir = "";
      for (const part of entry.relPath.split("/").slice(0, -1)) {
        dir = dir ? `${dir}/${part}` : part;
        const key = folderKeyOf(folder.name, dir);
        const item = dirs.get(key) ?? { key, label: [folder.name, ...dir.split("/")].join(" / "), folderIndex, dir, count: 0 };
        item.count += 1;
        dirs.set(key, item);
      }
    }
  });
  return [...dirs.values()].sort((a, b) => a.key.localeCompare(b.key));
}
