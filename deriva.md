# Cálculo de correção de deriva e conversão para heading magnético

## Objetivo

Determinar o **heading magnético** necessário para manter um **track
verdadeiro de 090°**, considerando vento e variação magnética.

> **Exemplo didático:** track desejado 090°, TAS 90 kt, vento de 030° a
> 17 kt e variação magnética de 23° E.

------------------------------------------------------------------------

## 1. Organize os dados

| Dado                               | Valor    |
|------------------------------------|----------|
| True Track (TT) desejado           | 090°     |
| True Airspeed (TAS)                | 90 kt    |
| Direção do vento (de onde vem)     | 030°     |
| Velocidade do vento                | 17 kt    |
| Variação magnética                 | 23° E    |

**Importante:** a direção do vento é informada como a direção **de onde
o vento vem**. Portanto, vento de 030° sopra em direção a 210°.

**Importante:** no app, o **TT** é a direção da linha que vai de um ponto
ao outro do mapa.

**Importante:** depois de plotar o vento, o **nariz do avião aponta para o
True Heading (TH)**, sobre a linha verdadeira do mapa. A declinação não
muda o nariz: ela só acrescenta os valores magnéticos ao lado.

**Importante:** a variação magnética é informada no campo de desvio, sem
sinal, com o lado **E** (leste) ou **W** (oeste), no botão ao lado. Também
dá para digitar **-** antes do número para leste e **+** para oeste: `-23`
é 23° E.

## 2. Calcule o ângulo entre o vento e a rota

-   Track desejado: 090°
-   Vento: 030°
-   Diferença angular: 090° − 030° = **60°**

O vento vem da esquerda da rota. Logo, a correção será para a esquerda.

## 3. Calcule a componente de vento cruzado

Use:

$$XW = V_{vento} \times \sin(\text{ângulo})$$

Substituindo:

$$XW = 17 \times \sin(60°) \approx 14{,}7 \text{ kt}$$

A componente lateral do vento é, portanto, aproximadamente **14,7 kt**,
vindo da esquerda.

## 4. Calcule o Wind Correction Angle (WCA)

Use:

$$WCA = \arcsin\left(\frac{XW}{TAS}\right)$$

Substituindo:

$$WCA = \arcsin\left(\frac{14{,}7}{90}\right) \approx 9{,}4°$$

Como o vento vem da esquerda, vire o nariz da aeronave para a esquerda
da rota: a correção é **−9,4°**.

## 5. Calcule o True Heading (TH)

$$TH = TT + WCA \text{ (com sinal)}$$

$$TH = 090° - 9{,}4° = 080{,}6°$$

Arredondando: **True Heading ≈ 081°**.

## 6. Converta para Magnetic Heading (MH)

A variação magnética é **23° E**.

Regra tradicional:

-   **East is least:** subtraia a variação E.
-   **West is best:** some a variação W.

Assim:

$$MH = TH - 23° = 080{,}6° - 23° = 057{,}6°$$

Arredondando: **Magnetic Heading ≈ 058°**.

No app, o mesmo cálculo é feito com o desvio **com sinal**:
`MH = TH + desvio`, onde o desvio é **negativo para E** e **positivo para
W**. Assim, 23° E é digitado como E 23 (ou `-23`), e o desvio vale −23.

## 7. Resultado do exemplo

| Etapa                              | Resultado            |
|------------------------------------|----------------------|
| True Track (TT)                    | 090°                 |
| Ângulo entre vento e rota          | 60°                  |
| Componente de vento cruzado        | 14,7 kt              |
| Wind Correction Angle (WCA)        | 9,4° para a esquerda |
| True Heading (TH)                  | 080,6°               |
| Variação magnética                 | 23° E                |
| **Magnetic Heading (MH)**          | **057,6° ≈ 058°**    |

**Resposta do exemplo:** o Magnetic Heading calculado é aproximadamente
**058°**.

------------------------------------------------------------------------

## 8. Sequência para memorizar

**True Track → correção de deriva (WCA) → True Heading → variação
magnética → Magnetic Heading → desvio da bússola (se aplicável) →
Compass Heading.**

-   **Variação magnética (variation):** diferença entre norte verdadeiro
    e norte magnético. É indicada na carta e varia conforme a
    localização.
-   **Desvio da bússola (deviation):** erro causado por campos
    magnéticos da própria aeronave. É obtido na tabela/cartão de desvios
    da bússola.
-   Não confunda variação magnética com desvio da bússola.

------------------------------------------------------------------------

## 9. Como o app faz o cálculo

### Plotar um vento

1.  Ligue a ferramenta **Vento** e clique no mapa. O formulário abre no
    ponto, e o **transferidor** aparece ali.
2.  Mova o mouse: os graus aparecem ao vivo. Aponte o transferidor para
    **onde o vento vem**.
3.  Clique de novo: esse ângulo (inteiro) vira a **direção** do vento, e
    a seta para de acompanhar o mouse.
4.  Digite a **velocidade** (nós ou km/h) e, se quiser, a **TAS**. Confirme
    com **Add wind**.
5.  O rótulo no mapa mostra só **direção e velocidade** (ex.: `211° · 15
    kt`). A TAS fica no formulário e na rota.

Se você clicar no mapa de novo, depois de fixar a direção, começa um novo
vento no novo ponto.

### Calcular o trecho

-   Cada trecho usa o **vento mais perto do seu meio**, com a **TAS desse
    vento**.
-   O **track verdadeiro** do trecho é o ângulo do ponto A para o ponto B.
-   Vento marcado como **magnético (°M)** é convertido para verdadeiro:
    `verdadeiro = magnético − desvio`.
-   A correção de deriva (seções 2 a 5) dá o **TH** e a velocidade sobre o
    solo.
-   A rota mostra o **HDG** (TH) e, com desvio, o **MH** ao lado. O
    **nariz do avião** aponta para o TH.
-   Se o vento cruzado for maior que a TAS, a rota avisa. Sem TAS, a rota
    pede a TAS.

### Desvio magnético

-   Campo ao lado do transferidor: digite a variação sem sinal e escolha
    **E** ou **W** no botão. Começa em **W**.
-   Ou digite **-** antes do número para leste e **+** para oeste.
-   O desvio com sinal entra nos cálculos e no transferidor (a segunda
    agulha mostra ângulo + desvio).

### Salvar e abrir rotas

-   O ícone de **ler/salvar** (ou a tecla **R**), antes do exportar, abre a
    janela das rotas salvas do mapa.
-   **Salvar:** digite um nome (vazio usa a data e a hora) e clique em
    **Salvar rota atual**. Fica guardado: os pontos (com os nomes), os ventos
    (com TAS e referência), o desvio com o lado e a escala.
-   **Abrir:** substitui a rota que está no mapa agora. A lista mostra só as
    rotas deste mapa.
-   **Buscar:** o campo de busca filtra a lista pelo nome enquanto você
    digita.
-   **Apagar:** a lixeira ao lado da rota.
-   As rotas ficam no armazenamento do app, neste dispositivo. O mapa é
    identificado pelo nome e pelo tamanho do arquivo.

### Apagar

-   **Option (Alt) + clique** num ponto plotado, numa seta de vento ou no
    rótulo do vento apaga só esse item.

## 10. Exemplos verificados no app

| Caso                                                       | Resultado                                              |
|------------------------------------------------------------|--------------------------------------------------------|
| TT 090°, vento 030° a 17 kt, TAS 90 kt, variação 23° E     | WCA −9,4°, TH 080,6°, MH 057,6° (≈ 058°)               |
| TT 090°, vento 046° a 11 kt, TAS 90 kt, variação 23° W     | WCA −4,9°, TH 085,1° (nariz em 085°), MH 108,1° (≈ 108°), velocidade sobre o solo 81,8 kt |

No segundo caso, o nariz do avião fica em **085°**, mesmo com o desvio W
digitado. O **108°** aparece na rota como valor magnético.

## 11. Convenções do app

-   Ângulos: 0° é o norte, e o ângulo cresce no sentido horário.
-   Vento: a direção é **de onde o vento sopra**. A seta no mapa aponta
    para onde ele vai.
-   Desvio com sinal (interno): magnético = verdadeiro + desvio. Leste é
    negativo, oeste é positivo.
-   Lado da variação: botão E/W no campo de desvio, ou sinal digitado
    (`-` = E, `+` = W).
-   Ajustes de zoom, brilho e a ajuda completa estão na janela de ajuda do
    app (botão de ajuda na tela inicial).
