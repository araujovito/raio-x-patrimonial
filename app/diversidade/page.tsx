import type { Metadata } from "next";

import DiversidadePagina from "../DiversidadePagina";
import { latestLegislature } from "../lib/legislaturas";

export const metadata: Metadata = {
  title: "Diversidade",
  description: `Busque um deputado federal eleito em ${latestLegislature.year} e veja gênero, raça e como o estado dele se compara na representatividade da Câmara.`,
};

export default function DiversidadePage() {
  return <DiversidadePagina legislature={latestLegislature} />;
}
