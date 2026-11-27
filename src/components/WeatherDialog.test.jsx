import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WeatherDialog from "./WeatherDialog";
import { fetchMetar, fetchTaf, isWeatherAvailable } from "../lib/weather";

// A busca vai para o Rust no app; aqui ela é trocada por respostas fixas. A validação do código é a de verdade.
vi.mock("../lib/weather", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isWeatherAvailable: vi.fn(() => true),
    fetchMetar: vi.fn(),
    fetchTaf: vi.fn(),
  };
});

// Respostas com a forma da API do aviationweather.gov (campos conferidos numa consulta real a SBSP).
const METAR = {
  icaoId: "SBSP",
  obsTime: 1795766400,
  temp: 17,
  dewp: 16,
  wdir: 140,
  wspd: 6,
  visib: "6+",
  altim: 1021,
  rawOb: "METAR SBSP 270800Z AUTO 14006KT 9999 FEW022 BKN032 17/16 Q1021",
  name: "Sao Paulo/Congonhas, SP, BR",
  clouds: [{ cover: "FEW", base: 2200 }, { cover: "BKN", base: 3200 }],
  fltCat: "VFR",
};

const TAF = {
  icaoId: "SBSP",
  issueTime: "2026-11-27T08:00:00.000Z",
  validTimeFrom: 1795780800,
  validTimeTo: 1795824000,
  rawTAF: "TAF SBSP 270800Z 2712/2724 14010KT 9999 BKN009 BECMG 2712/2715 BKN016",
  name: "Sao Paulo/Congonhas",
  fcsts: [
    { timeFrom: 1795780800, timeTo: 1795824000, fcstChange: null, probability: null, wdir: 140, wspd: 10, visib: "6+", clouds: [{ cover: "BKN", base: 900 }], wxString: null },
    { timeFrom: 1795780800, timeTo: 1795791600, fcstChange: "BECMG", probability: null, wdir: "VRB", wspd: 4, visib: "6+", clouds: [{ cover: "BKN", base: 1600 }], wxString: "RA" },
  ],
};

function renderDialog(props = {}) {
  const onClose = vi.fn();
  render(<WeatherDialog onClose={onClose} {...props} />);
  return { onClose };
}

const field = () => screen.getByRole("textbox", { name: "Airport ICAO code" });
const search = (code) => {
  fireEvent.change(field(), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
};

beforeEach(() => {
  vi.mocked(fetchMetar).mockReset();
  vi.mocked(fetchTaf).mockReset();
  vi.mocked(isWeatherAvailable).mockReset();
  vi.mocked(isWeatherAvailable).mockReturnValue(true);
});

describe("janela de METAR e TAF", () => {
  it("consulta em maiúsculas e mostra METAR e TAF com o texto original e os dados decodificados", async () => {
    vi.mocked(fetchMetar).mockResolvedValue(METAR);
    vi.mocked(fetchTaf).mockResolvedValue(TAF);
    renderDialog();
    search("sbsp");

    expect(await screen.findByText(METAR.rawOb)).toBeInTheDocument();
    expect(fetchMetar).toHaveBeenCalledWith("SBSP");
    expect(fetchTaf).toHaveBeenCalledWith("SBSP");
    expect(screen.getByText(TAF.rawTAF)).toBeInTheDocument();
    expect(screen.getByText(/Sao Paulo\/Congonhas, SP, BR/)).toBeInTheDocument();
    expect(screen.getByText("140° · 6 kt")).toBeInTheDocument();
    expect(screen.getByText("FEW 2200 ft, BKN 3200 ft")).toBeInTheDocument();
    expect(screen.getByText("17 °C / 16 °C")).toBeInTheDocument();
    expect(screen.getByText("1021 hPa")).toBeInTheDocument();
    expect(screen.getByText("VFR")).toBeInTheDocument();
  });

  it("mostra os períodos da TAF, com o vento variável e o tempo do BECMG", async () => {
    vi.mocked(fetchMetar).mockResolvedValue(METAR);
    vi.mocked(fetchTaf).mockResolvedValue(TAF);
    renderDialog();
    search("SBSP");

    expect(await screen.findByText("BECMG")).toBeInTheDocument();
    expect(screen.getByText("Base")).toBeInTheDocument();
    expect(screen.getByText("variable · 4 kt")).toBeInTheDocument();
    expect(screen.getByText("RA")).toBeInTheDocument();
  });

  it("código com menos de quatro caracteres avisa e não consulta", () => {
    renderDialog();
    search("SB");
    expect(screen.getByRole("alert")).toHaveTextContent("Type the ICAO code with 4 letters or numbers, e.g. SBSP.");
    expect(fetchMetar).not.toHaveBeenCalled();
    expect(fetchTaf).not.toHaveBeenCalled();
  });

  it("sem METAR nem TAF para o código, cada seção diz isso", async () => {
    vi.mocked(fetchMetar).mockResolvedValue(null);
    vi.mocked(fetchTaf).mockResolvedValue(null);
    renderDialog();
    search("ZZZZ");

    expect(await screen.findByText("No recent METAR for ZZZZ.")).toBeInTheDocument();
    expect(screen.getByText("No TAF for ZZZZ.")).toBeInTheDocument();
  });

  it("falha de uma consulta aparece só na seção dela; a outra segue mostrando", async () => {
    vi.mocked(fetchMetar).mockRejectedValue("HTTP 429 Too Many Requests");
    vi.mocked(fetchTaf).mockResolvedValue(TAF);
    renderDialog();
    search("SBSP");

    expect(await screen.findByText(TAF.rawTAF)).toBeInTheDocument();
    expect(screen.getByText("Could not fetch right now. Check the connection and try again.")).toBeInTheDocument();
    expect(screen.queryByText(METAR.rawOb)).not.toBeInTheDocument();
  });

  it("fora do app de desktop, avisa, desabilita o campo e não consulta", () => {
    vi.mocked(isWeatherAvailable).mockReturnValue(false);
    renderDialog();
    expect(screen.getByText("The lookup works in the desktop app.")).toBeInTheDocument();
    expect(field()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
  });

  it("Plotar no mapa entrega a estação do METAR; sem onPlace, o botão não aparece", async () => {
    vi.mocked(fetchMetar).mockResolvedValue(METAR);
    vi.mocked(fetchTaf).mockResolvedValue(TAF);
    const onPlace = vi.fn();
    const { unmount } = render(<WeatherDialog onClose={vi.fn()} onPlace={onPlace} />);
    search("SBSP");
    fireEvent.click(await screen.findByRole("button", { name: "Plot on map" }));
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ icao: "SBSP", raw: METAR.rawOb, fltCat: "VFR", wdir: 140, wspd: 6 }));
    unmount();

    renderDialog();
    search("SBSP");
    await screen.findByText(METAR.rawOb);
    expect(screen.queryByRole("button", { name: "Plot on map" })).not.toBeInTheDocument();
  });

  it("Esc fecha a janela", () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
