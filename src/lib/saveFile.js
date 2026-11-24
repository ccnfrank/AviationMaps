import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "./folderAccess";

// Salva um texto como arquivo. No app Tauri, abre o diálogo nativo de salvar; no navegador, baixa o arquivo.
// Devolve false se o usuário cancelou o diálogo.
export async function saveTextFile(text, name, mime = "text/csv;charset=utf-8") {
  if (isTauri()) {
    const path = await save({ defaultPath: name, filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
