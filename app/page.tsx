import type { Metadata } from "next";
import Dashboard from "./Dashboard";
import deputies from "./data/deputados.json";

export const metadata: Metadata = {
  description:
    "Explore os bens declarados ao TSE pelos deputados federais eleitos em 2022.",
};

export default function Home() {
  return <Dashboard deputies={deputies} />;
}
