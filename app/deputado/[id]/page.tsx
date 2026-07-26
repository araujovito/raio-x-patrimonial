import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import DeputyProfile from "../../DeputyProfile";
import deputiesData from "../../data/deputados.json";
import { money, percent, variation, type Deputy } from "../../lib/deputados";

const deputies = deputiesData as unknown as Deputy[];

type PageProps = { params: Promise<{ id: string }> };

function findDeputy(id: string) {
  return deputies.find((deputy) => deputy.id === id);
}

function describe(deputy: Deputy) {
  const nominal = variation(deputy);
  const base = `${deputy.fullName} (${deputy.party}-${deputy.uf}) declarou ${money.format(
    deputy.value2022,
  )} ao TSE na eleição de 2022`;

  return nominal === null
    ? `${base}. Não foi localizada declaração anterior para comparação.`
    : `${base}, variação nominal de ${percent(nominal)} em relação à declaração anterior (${deputy.previousYear}).`;
}

// Uma página por deputado eleito, geradas no build.
export function generateStaticParams() {
  return deputies.map((deputy) => ({ id: deputy.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const deputy = findDeputy(id);

  if (!deputy) {
    return { title: "Deputado não encontrado" };
  }

  const description = describe(deputy);

  return {
    title: deputy.name,
    description,
    openGraph: {
      title: `${deputy.name} — Raio-X Patrimonial`,
      description,
    },
    twitter: {
      title: `${deputy.name} — Raio-X Patrimonial`,
      description,
    },
  };
}

export default async function DeputyPage({ params }: PageProps) {
  const { id } = await params;
  const deputy = findDeputy(id);

  if (!deputy) {
    notFound();
  }

  return (
    <main className="deputy-page">
      <nav className="deputy-page-nav">
        <Link href="/#explorar">← Voltar ao explorador</Link>
        <span>Raio-X Patrimonial</span>
      </nav>

      <div className="deputy-page-body">
        <DeputyProfile deputy={deputy} eyebrow="Deputado federal eleito em 2022" />

        <p className="deputy-page-note">
          Dados públicos declarados ao Tribunal Superior Eleitoral. Os valores são
          nominais e não descontam a inflação; a comparação usa a declaração
          anterior mais recente localizada desde 2000. Esta página organiza
          declarações públicas e não constitui auditoria.{" "}
          <Link href="/#metodologia">Ver metodologia</Link>.
        </p>
      </div>

      <footer className="deputy-page-footer">
        Dados e desenvolvimento por Vitor Barbosa.
      </footer>
    </main>
  );
}
