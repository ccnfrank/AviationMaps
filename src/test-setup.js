import "@testing-library/jest-dom/vitest";
// Idioma e textos iguais aos do app, para os testes usarem o mesmo inglês de sempre.
import "./i18n";

// jsdom não implementa canvas; o botão de pixels cai no modo sem canvas nos testes.
HTMLCanvasElement.prototype.getContext = () => null;

// jsdom não implementa URLs de objeto (usadas pela pré-visualização).
URL.createObjectURL = () => "blob:mock";
URL.revokeObjectURL = () => {};
