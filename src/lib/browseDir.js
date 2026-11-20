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
