// Layout de um gráfico de assentos em hemiciclo (como o da Câmara), com um
// ponto por cadeira distribuído em arcos concêntricos. Não usa nenhuma
// biblioteca de gráficos — a geometria é toda calculada aqui.

export type Seat = { x: number; y: number; row: number };

const ROWS = 9;
const MARGIN_ANGLE = 0.09; // radianos de folga em cada ponta do arco

/** Posições (x, y) de `total` cadeiras, ordenadas da esquerda para a direita. */
export function layoutHemicycle(
  total: number,
  { width = 640, height = 340, rInner = 78, rOuter = 300 } = {},
): Seat[] {
  const cx = width / 2;
  const cy = height - 4;

  const radii = Array.from(
    { length: ROWS },
    (_, i) => rInner + (i * (rOuter - rInner)) / (ROWS - 1),
  );

  // Cadeiras por fileira proporcionais ao comprimento do arco (∝ raio),
  // ajustadas pelo método dos maiores restos para somar exatamente `total`.
  const weights = radii.map((r) => r);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / weightSum);
  const floors = raw.map(Math.floor);
  let remaining = total - floors.reduce((a, b) => a + b, 0);
  const remainders = raw
    .map((value, i) => ({ i, frac: value - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const seatsPerRow = [...floors];
  for (let k = 0; k < remaining; k++) {
    seatsPerRow[remainders[k].i] += 1;
  }
  remaining = 0;

  const seats: Seat[] = [];
  radii.forEach((r, row) => {
    const count = seatsPerRow[row];
    if (count <= 0) return;
    for (let j = 0; j < count; j++) {
      const theta =
        count === 1
          ? Math.PI / 2
          : MARGIN_ANGLE +
            (j * (Math.PI - 2 * MARGIN_ANGLE)) / (count - 1);
      // Arredondado: Math.cos/Math.sin podem devolver o último bit
      // diferente entre o Node (servidor) e o navegador, o que sozinho já
      // basta para o React acusar erro de hidratação num atributo numérico.
      seats.push({
        x: Math.round((cx + r * Math.cos(theta)) * 100) / 100,
        y: Math.round((cy - r * Math.sin(theta)) * 100) / 100,
        row,
      });
    }
  });

  // Da esquerda (theta ≈ π) para a direita (theta ≈ 0): recalcula o ângulo
  // pela posição x já calculada, mais simples que carregar theta adiante.
  return seats.sort((a, b) => a.x - b.x || a.y - b.y);
}

/**
 * Posição aproximada de cada partido no espectro esquerda-direita, só para
 * ordenar o desenho do hemiciclo da esquerda para a direita (como o gráfico
 * de assentos costuma ser lido). Não é uma medição científica: é uma
 * simplificação com base em classificações usuais da imprensa e de estudos
 * de ciência política sobre o Congresso — bancadas têm alas internas e a
 * posição de um partido muda ao longo do tempo. Partido fora da lista entra
 * no meio.
 */
const PARTY_LEFT_RIGHT = [
  "PSOL",
  "PC do B",
  "PT",
  "PDT",
  "PSB",
  "REDE",
  "PV",
  "SOLIDARIEDADE",
  "CIDADANIA",
  "AVANTE",
  "PODE",
  "MDB",
  "PSD",
  "PSDB",
  "PROS",
  "PTB",
  "PP",
  "UNIÃO",
  "REPUBLICANOS",
  "PSC",
  "PATRIOTA",
  "PL",
  "NOVO",
];

export const PARTY_SPECTRUM_SIZE = PARTY_LEFT_RIGHT.length;

export function partyLeftRightRank(party: string): number {
  const index = PARTY_LEFT_RIGHT.indexOf(party);
  return index === -1 ? PARTY_LEFT_RIGHT.length / 2 : index;
}

const LEFT_HUE = 355; // vermelho
const RIGHT_HUE = 215; // azul

/**
 * Cor no degradê vermelho (esquerda) → magenta/roxo (centro) → azul
 * (direita), pela posição do partido em `partyLeftRightRank`. Interpola só
 * o matiz (mantendo saturação alta), para não desbotar num cinza no meio do
 * espectro como um degradê em RGB faria. A luminosidade alterna entre
 * partidos vizinhos para separar quem cai perto no espectro.
 */
export function politicalColor(rank: number, spectrumSize: number) {
  const t = spectrumSize <= 1 ? 0 : rank / (spectrumSize - 1);
  const hue = LEFT_HUE + (RIGHT_HUE - LEFT_HUE) * t;
  const lightness = Math.round(rank) % 2 === 0 ? 38 : 50;
  return `hsl(${hue.toFixed(1)}, 68%, ${lightness}%)`;
}

/** Cores fixas para os dois maiores partidos, por pedido: PT em vermelho, PL em azul. */
export const PARTY_COLOR_OVERRIDES: Record<string, string> = {
  PT: "#c0392b",
  PL: "#31587a",
};
