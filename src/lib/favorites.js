import { useCallback, useEffect, useMemo, useState } from "react";

// Favoritos de mapas e de pastas. Ficam no armazenamento local da janela, como as rotas salvas, em
// listas separadas. Um mapa é identificado pela mesma chave das rotas (nome e tamanho do arquivo, ver
// mapKeyOf em savedRoutes.js): o favorito vale para o mesmo mapa em qualquer pasta. Uma pasta é o
// caminho dela dentro da pasta carregada ("dia2", "dia2/sul", ver folderKeyOf em browseDir.js).
// Sem armazenamento disponível, nada é guardado.
const MAP_KEY = "mapareader.favorites";
const FOLDER_KEY = "mapareader.favoriteFolders";
// Evento da janela: cada lugar que mostra favoritos (a busca da tela inicial e a da visualização) se
// atualiza quando outro muda um favorito.
const EVENT = "mapareader:favorites";

function readList(storageKey) {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(list) ? list.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

function writeList(storageKey, list) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch {
    // sem armazenamento: o favorito não fica guardado
  }
}

// Liga ou desliga uma chave numa das listas e avisa os outros lugares da janela.
function toggleIn(storageKey, key) {
  const current = readList(storageKey);
  writeList(storageKey, current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);
  window.dispatchEvent(new Event(EVENT));
}

// Os favoritos de mapas e de pastas (cada um um Set de chaves) e as funções que ligam ou desligam um.
export function useFavorites() {
  const [mapKeys, setMapKeys] = useState(() => readList(MAP_KEY));
  const [folderKeys, setFolderKeys] = useState(() => readList(FOLDER_KEY));

  useEffect(() => {
    const sync = () => {
      setMapKeys(readList(MAP_KEY));
      setFolderKeys(readList(FOLDER_KEY));
    };
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const favorites = useMemo(() => new Set(mapKeys), [mapKeys]);
  const favoriteFolders = useMemo(() => new Set(folderKeys), [folderKeys]);
  const toggleFavorite = useCallback((key) => toggleIn(MAP_KEY, key), []);
  const toggleFavoriteFolder = useCallback((key) => toggleIn(FOLDER_KEY, key), []);

  return { favorites, toggleFavorite, favoriteFolders, toggleFavoriteFolder };
}
