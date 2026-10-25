import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Dashboard from "../../Dashboard";
import { LEGISLATURE_YEARS } from "../../lib/deputados";
import { getLegislature } from "../../lib/legislaturas";

type PageProps = { params: Promise<{ ano: string }> };

export function generateStaticParams() {
  return LEGISLATURE_YEARS.map((year) => ({ ano: String(year) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ano } = await params;
  return {
    title: `Eleitos em ${ano}`,
    description: `Explore a trajetória eleitoral e os bens declarados ao TSE pelos deputados federais eleitos em ${ano}.`,
  };
}

export default async function EleicaoPage({ params }: PageProps) {
  const { ano } = await params;
  const legislature = getLegislature(Number(ano));
  if (!legislature) notFound();

  return (
    <Dashboard
      deputies={legislature.deputies}
      diversity={legislature.diversity}
    />
  );
}
