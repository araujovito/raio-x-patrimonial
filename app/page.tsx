import type { Metadata } from "next";
import Dashboard from "./Dashboard";
import { latestLegislature } from "./lib/legislaturas";

export const metadata: Metadata = {
  description: `Explore a trajetória eleitoral e os bens declarados ao TSE pelos deputados federais eleitos em ${latestLegislature.year}.`,
};

export default function Home() {
  return (
    <Dashboard
      deputies={latestLegislature.deputies}
      diversity={latestLegislature.diversity}
    />
  );
}
