import type { Metadata } from "next";
import { Manrope, Source_Serif_4 } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og-v2.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Raio-X Patrimonial",
      template: "%s | Raio-X Patrimonial",
    },
    description:
      "Visualização independente da trajetória eleitoral e dos bens declarados ao TSE pelos deputados federais eleitos em 2022.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Raio-X Patrimonial",
      description:
        "513 deputados eleitos. Duas eleições. Uma base pública para explorar.",
      type: "website",
      locale: "pt_BR",
      images: [
        {
          url: socialImage,
          width: 1745,
          height: 907,
          alt: "Raio-X Patrimonial — dados públicos para explorar",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Raio-X Patrimonial",
      description:
        "Explore trajetórias eleitorais e bens declarados ao TSE desde 2000.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
