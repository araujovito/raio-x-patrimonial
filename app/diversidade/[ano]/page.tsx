import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DiversidadePagina from "../../DiversidadePagina";
import { LEGISLATURE_YEARS } from "../../lib/deputados";
import { getLegislature } from "../../lib/legislaturas";

type PageProps = { params: Promise<{ ano: string }> };

export function generateStaticParams() {
  return LEGISLATURE_YEARS.map((year) => ({ ano: String(year) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ano } = await params;
  return {
    title: `Diversidade em ${ano}`,
    description: `Busque um deputado federal eleito em ${ano} e veja gênero, raça e como o estado dele se compara na representatividade da Câmara.`,
  };
}

export default async function DiversidadeEleicaoPage({ params }: PageProps) {
  const { ano } = await params;
  const legislature = getLegislature(Number(ano));
  if (!legislature) notFound();

  return <DiversidadePagina legislature={legislature} />;
}
