import { filterFiles } from "./filterFiles";

const files = [
  { name: "cena01.mp4", relPath: "dia1/cena01.mp4", type: "video" },
  { name: "chuva.wav", relPath: "chuva.wav", type: "audio" },
  { name: "ref.png", relPath: "ref.png", type: "image" },
];

test("busca ignora maiúsculas e olha o caminho", () => {
  expect(filterFiles(files, "CENA", "all")).toHaveLength(1);
  expect(filterFiles(files, "dia1", "all")).toHaveLength(1);
});
test("filtra por tipo", () => expect(filterFiles(files, "", "audio").map((f) => f.name)).toEqual(["chuva.wav"]));
test("combina busca e tipo", () => expect(filterFiles(files, "cena", "audio")).toEqual([]));
test("query vazia devolve tudo", () => expect(filterFiles(files, "", "all")).toHaveLength(3));
