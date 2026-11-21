// Acesso a pastas, em três modos:
// - App Tauri (macOS): diálogo nativo de pasta e leitura pelo plugin de fs. Os arquivos viram
//   objetos File com `webkitRelativePath`, então o resto do app não percebe a diferença.
// - Chromium: File System Access API (diálogo nativo de pasta).
// - Os demais: <input webkitdirectory> (ver App.jsx) e arrastar a pasta para a janela.
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import { MAP_EXTENSIONS, getPreviewKind } from "./previewKind";

export const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const canPickDirectory = () =>
  isTauri() || (typeof window !== "undefined" && typeof window.showDirectoryPicker === "function");

// Devolve a pasta escolhida (handle do navegador ou caminho nativo), ou null se o usuário cancelou.
export async function pickDirectory() {
  if (isTauri()) {
    // recursive: true libera as subpastas no escopo do fs; sem isto, só a pasta escolhida seria lida.
    const path = await open({ directory: true, multiple: false, recursive: true, title: "Map Reader" });
    return path ?? null;
  }
  return window.showDirectoryPicker({ mode: "read" });
}

// Só no app Tauri: diálogo nativo para escolher um mapa (imagem ou PDF). Devolve o arquivo lido,
// ou null se o usuário cancelou. No navegador, quem chama usa um <input type="file"> (ver ViewerEmpty).
export async function pickMapFileNative() {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Map Reader", extensions: MAP_EXTENSIONS }],
    title: "Map Reader",
  });
  if (!path) return null;
  const name = path.split(/[\\/]/).filter(Boolean).pop();
  return new File([await readFile(path)], name);
}

// Só no app Tauri: libera de novo, no escopo de leitura, uma pasta lembrada de outra execução.
// Ver allow_folder em src-tauri/src/lib.rs.
export async function allowFolder(path) {
  await invoke("allow_folder", { path });
}

// Lê a pasta inteira e devolve Files com `webkitRelativePath` no mesmo formato do
// <input webkitdirectory> ("raiz/sub/arquivo"), para o groupFiles tratar tudo igual.
export async function readDirectory(handle) {
  if (typeof handle === "string") return readNativeDirectory(handle);

  const files = [];
  async function walk(dir, prefix) {
    for await (const entry of dir.values()) {
      const path = `${prefix}/${entry.name}`;
      if (entry.kind === "directory") {
        await walk(entry, path);
      } else {
        const file = await entry.getFile();
        Object.defineProperty(file, "webkitRelativePath", { value: path });
        files.push(file);
      }
    }
  }
  await walk(handle, handle.name);
  return files;
}

// Leitura nativa (Tauri). Só lê o que o app mostra (imagens e PDF): vídeos, zips e o resto
// da pasta são pulados antes de carregar os bytes, para não encher a memória à toa.
async function readNativeDirectory(rootPath) {
  const rootName = rootPath.split(/[\\/]/).filter(Boolean).pop();
  const files = [];
  async function walk(dirPath, prefix) {
    for (const entry of await readDir(dirPath)) {
      const path = `${dirPath}/${entry.name}`;
      const relative = `${prefix}/${entry.name}`;
      if (entry.isDirectory) {
        await walk(path, relative);
      } else if (entry.isFile && getPreviewKind(entry.name) !== "unsupported") {
        const bytes = await readFile(path);
        const file = new File([bytes], entry.name);
        Object.defineProperty(file, "webkitRelativePath", { value: relative });
        files.push(file);
      }
    }
  }
  await walk(rootPath, rootName);
  return files;
}

// Lê uma pasta arrastada para o navegador (DataTransfer.webkitGetAsEntry) e devolve os
// arquivos no mesmo formato de `readDirectory`. Se o item não for pasta, devolve null.
export async function readDroppedDirectory(dataTransferItem) {
  const root = dataTransferItem.webkitGetAsEntry?.();
  if (!root || !root.isDirectory) return null;

  // readEntries devolve em lotes; é preciso chamar até vir um lote vazio.
  const listChildren = (dir) => new Promise((resolve, reject) => {
    const reader = dir.createReader();
    const all = [];
    const next = () => reader.readEntries((batch) => {
      if (batch.length === 0) resolve(all);
      else {
        all.push(...batch);
        next();
      }
    }, reject);
    next();
  });

  const files = [];
  // `parent` é o caminho da pasta de cima; a raiz não tem pai, então o caminho começa no nome dela.
  const walk = async (entry, parent) => {
    const path = parent ? `${parent}/${entry.name}` : entry.name;
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      Object.defineProperty(file, "webkitRelativePath", { value: path });
      files.push(file);
      return;
    }
    for (const child of await listChildren(entry)) {
      if (child.name.startsWith(".")) continue;
      await walk(child, path);
    }
  };
  await walk(root, "");
  return files;
}
