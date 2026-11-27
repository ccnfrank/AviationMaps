import { useCallback, useEffect, useMemo, useState } from "react";

// Mapas favoritos. Ficam no armazenamento local da janela, como as rotas salvas, e identificam o mapa
// pela mesma chave delas (nome e tamanho do arquivo, ver mapKeyOf em savedRoutes.js): o favorito vale
// para o mesmo mapa em qualquer pasta. Sem armazenamento disponível, nada é guardado.
const KEY = "mapareader.favorites";
// Evento da janela: cada lugar que mostra favoritos (a busca da tela inicial e a da visualização) se
// atualiza quando outro muda um favorito.
const EVENT = "mapareader:favorites";

function readKeys() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

function writeKeys(keys) {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    // sem armazenamento: o favorito não fica guardado
  }
}

// Os favoritos (um Set de chaves de mapa) e a função que liga ou desliga um deles.
export function useFavorites() {
  const [keys, setKeys] = useState(readKeys);

  useEffect(() => {
    const sync = () => setKeys(readKeys());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const favorites = useMemo(() => new Set(keys), [keys]);

  const toggleFavorite = useCallback((key) => {
    const current = readKeys();
    writeKeys(current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { favorites, toggleFavorite };
}
