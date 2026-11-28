import { beforeEach, describe, expect, it } from "vitest";
import { isValidCredential, loadCredentials, parseAisDate, parseNotams, parseRotaer, saveCredentials } from "./aisweb";

// Trechos no formato que a API da AISWEB devolve (copiados de respostas reais de SBSP, reduzidos).
const NOTAM_XML = `<?xml version="1.0" encoding="UTF-8"?><aisweb>
  <notam id="x" total="2">
    <item id="1001">
      <id>1001</id><icaoairport_id>SBSP</icaoairport_id><cod>QFALT</cod><status>ACTIVE</status><cat>OTR</cat>
      <n>A0123/26</n><number>123</number><loc>SBSP</loc><aero>Congonhas - Deputado Freitas Nobre</aero>
      <b>2611271200</b><c>2612011800</c><f/><g/><lower>000</lower><upper>050</upper>
      <e><![CDATA[AERODROMO FECHADO PARA OPERACOES]]></e>
    </item>
    <item id="1002">
      <id>1002</id><icaoairport_id>SBSP</icaoairport_id><cod>QMRLC</cod><status>ACTIVE</status><loc>SBSP</loc>
      <b>2611270000</b><c>PERM</c><e><![CDATA[PISTA 17/35 COM BALIZAMENTO REDUZIDO]]></e>
    </item>
  </notam>
</aisweb>`;

const ROTAER_XML = `<?xml version="1.0" encoding="UTF-8"?><aisweb>
  <status>Active</status>
  <AeroCode>SBSP</AeroCode>
  <name><![CDATA[Congonhas - Deputado Freitas Nobre]]></name>
  <city><![CDATA[São Paulo]]></city>
  <uf>SP</uf>
  <lat>-23.626111111111</lat>
  <lng>-46.656388888889</lng>
  <org><name>AENA BRASIL</name><type>ORG</type><military>CIVIL</military></org>
  <workinghour compl=""/>
  <type>AD</type>
  <typeUtil>PUB</typeUtil>
  <cat>NAC</cat>
  <utc>-3</utc>
  <altFt>2634</altFt>
  <fir>SBBS</fir>
  <compls count="2">
    <compl cod="2.14" n="1"><![CDATA[MEHT: a. RWY 17R - 66FT]]></compl>
    <compl cod="2.19" n="2"><![CDATA[NO AVBL além de 25NM]]></compl>
  </compls>
  <rmk count="1"><rmkText cod="2.3"><![CDATA[AD HR SER 0900-0200.]]></rmkText></rmk>
  <runways count="1">
    <runway compl="">
      <type>RWY</type>
      <ident>17L/35R</ident>
      <surface compl="">ASPH</surface>
      <length compl="">1495</length>
      <width compl="">45</width>
      <surface_c compl="">270/F/A/X/T</surface_c>
      <thr compl=""><ident>17L</ident></thr>
      <thr compl=""><ident>35R</ident></thr>
    </runway>
  </runways>
</aisweb>`;

describe("NOTAM", () => {
  it("lê cada aviso com número, Q-code, validade em UTC, limites e texto", () => {
    const [first, second] = parseNotams(NOTAM_XML);
    expect(first).toMatchObject({
      id: "1001",
      number: "A0123/26",
      code: "QFALT",
      location: "SBSP",
      airport: "SBSP",
      airportName: "Congonhas - Deputado Freitas Nobre",
      lower: "000",
      upper: "050",
      text: "AERODROMO FECHADO PARA OPERACOES",
      permanent: false,
    });
    expect(first.validFrom).toBe(Date.UTC(2026, 10, 27, 12, 0));
    expect(first.validTo).toBe(Date.UTC(2026, 11, 1, 18, 0));
    expect(second.permanent).toBe(true);
    expect(second.validTo).toBeNull();
  });

  it("resposta sem avisos vira lista vazia", () => {
    expect(parseNotams('<aisweb><notam total="0"/></aisweb>')).toEqual([]);
    expect(parseNotams("")).toEqual([]);
  });

  it("XML quebrado dá erro, para a janela mostrar a falha", () => {
    expect(() => parseNotams("<aisweb><notam")).toThrow();
  });
});

describe("ROTAER", () => {
  it("lê a ficha do aeródromo, as pistas e as observações", () => {
    const rotaer = parseRotaer(ROTAER_XML);
    expect(rotaer).toMatchObject({
      code: "SBSP",
      name: "Congonhas - Deputado Freitas Nobre",
      city: "São Paulo",
      state: "SP",
      status: "Active",
      type: "AD",
      typeUtil: "PUB",
      category: "NAC",
      altitudeFt: "2634",
      utc: "-3",
      workingHours: "",
      fir: "SBBS",
      organization: "AENA BRASIL",
      remarks: ["AD HR SER 0900-0200."],
      complements: ["MEHT: a. RWY 17R - 66FT", "NO AVBL além de 25NM"],
    });
    expect(rotaer.runways).toEqual([
      { ident: "17L/35R", length: "1495 m", width: "45 m", surface: "ASPH", thresholds: ["17L", "35R"] },
    ]);
  });

  it("sem o código do aeródromo na resposta, devolve null", () => {
    expect(parseRotaer('<aisweb><notam total="0"/></aisweb>')).toBeNull();
    expect(parseRotaer("")).toBeNull();
  });
});

describe("data do NOTAM", () => {
  it("lê AAMMDDHHMM em UTC; PERM e datas fora do formato viram null", () => {
    expect(parseAisDate("2611271200")).toBe(Date.UTC(2026, 10, 27, 12, 0));
    expect(parseAisDate("PERM")).toBeNull();
    expect(parseAisDate("")).toBeNull();
    expect(parseAisDate("2613011200")).toBeNull();
  });
});

describe("credenciais da AISWEB", () => {
  beforeEach(() => localStorage.clear());

  it("aceita só letras, números e hífen", () => {
    expect(isValidCredential("123456")).toBe(true);
    expect(isValidCredential("abcd-1234")).toBe(true);
    expect(isValidCredential("")).toBe(false);
    expect(isValidCredential("abc&apiPass=x")).toBe(false);
    expect(isValidCredential("abc def")).toBe(false);
  });

  it("guarda e lê as credenciais neste computador", () => {
    expect(saveCredentials({ apiKey: " 123456 ", apiPass: "abcd-1234" })).toBe(true);
    expect(loadCredentials()).toEqual({ apiKey: "123456", apiPass: "abcd-1234" });
  });

  it("registro estranho no armazenamento é ignorado", () => {
    localStorage.setItem("mapareader.aisweb", JSON.stringify({ apiKey: "x&y", apiPass: "1" }));
    expect(loadCredentials()).toBeNull();
    localStorage.setItem("mapareader.aisweb", "não é json");
    expect(loadCredentials()).toBeNull();
  });
});
