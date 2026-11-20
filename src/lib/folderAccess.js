// Acesso a pastas no navegador, em dois modos:
// - Chromium: File System Access API (diálogo nativo de pasta).
// - Os demais: <input webkitdirectory> (ver App.jsx) e arrastar a pasta para a janela.
export const canPickDirectory = () =>
  typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

export async function pickDirectory() {
  return window.showDirectoryPicker({ mode: "read" });
}

// Lê a pasta inteira e devolve Files com `webkitRelativePath` no mesmo formato do
// <input webkitdirectory> ("raiz/sub/arquivo"), para o groupFiles tratar tudo igual.
export async function readDirectory(handle) {
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
