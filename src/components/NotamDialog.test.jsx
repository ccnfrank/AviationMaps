import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotamDialog from "./NotamDialog";
import { INVALID_CREDENTIALS, fetchNotams, fetchRotaer, isAisAvailable } from "../lib/aisweb";

// A consulta vai para o Rust no app; aqui ela é trocada por respostas fixas. Validação e credenciais são as de verdade.
vi.mock("../lib/aisweb", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isAisAvailable: vi.fn(() => true),
    fetchNotams: vi.fn(),
    fetchRotaer: vi.fn(),
  };
});

const CREDS = { apiKey: "123456", apiPass: "abcd-1234" };

const ROTAER = {
  code: "SBSP",
  name: "Congonhas",
  city: "Sao Paulo",
  state: "SP",
  status: "Operacional",
  type: "AD",
  typeUtil: "Publico",
  category: "Civil",
  altitudeFt: "2631",
  lat: "-23.6261",
  lng: "-46.6564",
  utc: "-3",
  workingHours: "H24",
  organization: "Infraero",
  fir: "SBAO",
  runways: [{ ident: "17/35", length: "1940 m", width: "45 m", surface: "ASPH", thresholds: ["17", "35"] }],
  remarks: ["Observacao de teste"],
  complements: [],
};

const NOTAMS = [
  {
    id: "1001",
    number: "A0123/26",
    code: "QFALT",
    location: "SBSP",
    airport: "SBSP",
    validFrom: Date.UTC(2026, 10, 27, 12, 0),
    validTo: Date.UTC(2026, 11, 1, 18, 0),
    permanent: false,
    lower: "SFC",
    upper: "050",
    text: "AERODROMO FECHADO PARA OPERACOES",
  },
];

function renderDialog() {
  const onClose = vi.fn();
  render(<NotamDialog onClose={onClose} />);
  return { onClose };
}

const icaoField = () => screen.getByRole("textbox", { name: "Aerodrome ICAO code" });
const search = (code) => {
  fireEvent.change(icaoField(), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(isAisAvailable).mockReturnValue(true);
  vi.mocked(fetchRotaer).mockReset();
  vi.mocked(fetchNotams).mockReset();
});

describe("credenciais da AISWEB", () => {
  it("sem credenciais salvas, pede ApiKey e ApiPass antes de qualquer busca", () => {
    renderDialog();
    expect(screen.getByLabelText("ApiKey")).toBeInTheDocument();
    expect(screen.getByLabelText("ApiPass")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Aerodrome ICAO code" })).toBeNull();
  });

  it("salvar as credenciais guarda neste computador e abre a busca", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("ApiKey"), { target: { value: " 123456 " } });
    fireEvent.change(screen.getByLabelText("ApiPass"), { target: { value: "abcd-1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(icaoField()).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("mapareader.aisweb"))).toEqual(CREDS);
  });

  it("credencial com caractere estranho não é salva", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("ApiKey"), { target: { value: "12&34" } });
    fireEvent.change(screen.getByLabelText("ApiPass"), { target: { value: "abcd" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Use only letters, numbers and hyphens in both fields.")).toBeInTheDocument();
    expect(localStorage.getItem("mapareader.aisweb")).toBeNull();
  });

  it("com credenciais salvas, Trocar credenciais abre o formulário preenchido e Cancelar volta", () => {
    localStorage.setItem("mapareader.aisweb", JSON.stringify(CREDS));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Change credentials" }));
    expect(screen.getByLabelText("ApiKey")).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(icaoField()).toBeInTheDocument();
  });
});

describe("busca por ICAO", () => {
  beforeEach(() => localStorage.setItem("mapareader.aisweb", JSON.stringify(CREDS)));

  it("mostra a ficha do ROTAER e os NOTAM do código, em maiúsculas", async () => {
    vi.mocked(fetchRotaer).mockResolvedValue(ROTAER);
    vi.mocked(fetchNotams).mockResolvedValue(NOTAMS);
    renderDialog();
    search("sbsp");
    expect(await screen.findByText("AERODROMO FECHADO PARA OPERACOES")).toBeInTheDocument();
    expect(fetchRotaer).toHaveBeenCalledWith("SBSP", CREDS);
    expect(fetchNotams).toHaveBeenCalledWith("SBSP", CREDS);
    expect(screen.getByText("Operacional")).toBeInTheDocument();
    expect(screen.getByText("17/35")).toBeInTheDocument();
    expect(screen.getByText("A0123/26")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "NOTAM (1)" })).toBeInTheDocument();
  });

  it("código sem 4 caracteres não consulta a AISWEB", () => {
    renderDialog();
    search("SB");
    expect(screen.getByRole("alert")).toHaveTextContent("Type the ICAO code with 4 letters or numbers");
    expect(fetchRotaer).not.toHaveBeenCalled();
    expect(fetchNotams).not.toHaveBeenCalled();
  });

  it("sem NOTAM e sem ROTAER, avisa que não há dados para o código", async () => {
    vi.mocked(fetchRotaer).mockResolvedValue(null);
    vi.mocked(fetchNotams).mockResolvedValue([]);
    renderDialog();
    search("ZZZZ");
    expect(await screen.findByText("No ROTAER data for ZZZZ.")).toBeInTheDocument();
    expect(screen.getByText("No NOTAM for ZZZZ.")).toBeInTheDocument();
  });

  it("falha de uma consulta não esconde a outra", async () => {
    vi.mocked(fetchRotaer).mockRejectedValue(new Error("rede"));
    vi.mocked(fetchNotams).mockResolvedValue(NOTAMS);
    renderDialog();
    search("SBSP");
    expect(await screen.findByText("A0123/26")).toBeInTheDocument();
    expect(screen.getByText("Could not fetch right now. Check the connection and try again.")).toBeInTheDocument();
  });

  it("credencial recusada pela AISWEB volta ao formulário com o aviso", async () => {
    vi.mocked(fetchRotaer).mockRejectedValue(INVALID_CREDENTIALS);
    vi.mocked(fetchNotams).mockRejectedValue(INVALID_CREDENTIALS);
    renderDialog();
    search("SBSP");
    expect(await screen.findByText("AISWEB refused these credentials. Check the ApiKey and ApiPass and save again.")).toBeInTheDocument();
    expect(screen.getByLabelText("ApiKey")).toHaveValue("123456");
  });
});

describe("fora do app de desktop", () => {
  it("avisa que a consulta só funciona no app e não mostra o campo", () => {
    vi.mocked(isAisAvailable).mockReturnValue(false);
    renderDialog();
    expect(screen.getByText("The lookup works in the desktop app.")).toBeInTheDocument();
    expect(screen.queryByLabelText("ApiKey")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Aerodrome ICAO code" })).toBeNull();
  });
});
