import { getExtension, getFileType } from "./fileTypes";

export const ROOT_NAME = "(raiz)";

export function groupFiles(files) {
  const map = new Map();
  for (const file of files) {
    const parts = file.webkitRelativePath.split("/").slice(1);
    if (parts.length === 0 || parts.some((p) => p.startsWith("."))) continue;
    const folderName = parts.length === 1 ? ROOT_NAME : parts[0];
    const rel = parts.length === 1 ? parts : parts.slice(1);
    const name = parts[parts.length - 1];
    if (!map.has(folderName)) map.set(folderName, []);
    map.get(folderName).push({
      name,
      relPath: rel.join("/"),
      ext: getExtension(name),
      type: getFileType(name),
      size: file.size,
      file,
    });
  }
  return [...map.entries()]
    .map(([name, entries]) => ({
      name,
      fileCount: entries.length,
      totalSize: entries.reduce((sum, e) => sum + e.size, 0),
      files: entries.sort((a, b) => a.relPath.localeCompare(b.relPath)),
    }))
    .sort((a, b) => {
      if (a.name === ROOT_NAME) return 1;
      if (b.name === ROOT_NAME) return -1;
      return a.name.localeCompare(b.name);
    });
}

// Divide os arquivos de uma pasta pelas subpastas (primeiro nível). Os caminhos
// ficam relativos à subpasta; os arquivos soltos na pasta vão para ROOT_NAME, por último.
export function groupBySubdir(files) {
  const map = new Map();
  for (const file of files) {
    const i = file.relPath.indexOf("/");
    const name = i < 0 ? ROOT_NAME : file.relPath.slice(0, i);
    const relPath = i < 0 ? file.relPath : file.relPath.slice(i + 1);
    if (!map.has(name)) map.set(name, []);
    map.get(name).push({ ...file, relPath });
  }
  return [...map.entries()]
    .map(([name, entries]) => ({
      name,
      fileCount: entries.length,
      totalSize: entries.reduce((sum, e) => sum + e.size, 0),
      files: entries.sort((a, b) => a.relPath.localeCompare(b.relPath)),
    }))
    .sort((a, b) => {
      if (a.name === ROOT_NAME) return 1;
      if (b.name === ROOT_NAME) return -1;
      return a.name.localeCompare(b.name);
    });
}
