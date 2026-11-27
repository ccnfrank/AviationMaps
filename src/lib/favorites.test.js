import { act, renderHook } from "@testing-library/react";
import { useFavorites } from "./favorites";

beforeEach(() => localStorage.clear());

test("liga e desliga um favorito, guardado no armazenamento local", () => {
  const { result } = renderHook(() => useFavorites());
  expect(result.current.favorites.size).toBe(0);
  act(() => result.current.toggleFavorite("cena01.png|10"));
  expect(result.current.favorites.has("cena01.png|10")).toBe(true);
  expect(JSON.parse(localStorage.getItem("mapareader.favorites"))).toEqual(["cena01.png|10"]);
  act(() => result.current.toggleFavorite("cena01.png|10"));
  expect(result.current.favorites.has("cena01.png|10")).toBe(false);
});

test("uma mudança aparece em todos os lugares que mostram favoritos", () => {
  const first = renderHook(() => useFavorites());
  const second = renderHook(() => useFavorites());
  act(() => first.result.current.toggleFavorite("mapa.pdf|99"));
  expect(second.result.current.favorites.has("mapa.pdf|99")).toBe(true);
});

test("registros que não são texto no armazenamento são ignorados", () => {
  localStorage.setItem("mapareader.favorites", JSON.stringify(["ok|1", 7, null]));
  const { result } = renderHook(() => useFavorites());
  expect([...result.current.favorites]).toEqual(["ok|1"]);
});

test("armazenamento com JSON inválido começa vazio", () => {
  localStorage.setItem("mapareader.favorites", "{não é json");
  const { result } = renderHook(() => useFavorites());
  expect(result.current.favorites.size).toBe(0);
});
