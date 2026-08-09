import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: "FEBBRAIO 空き状況・予約 | COMPASSION WORLD",
    description: "Music Studio FEBBRAIOの公開空き状況とLINE会員予約。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "COMPASSION WORLD | LINE MEMBERS CARD", description: "つながる、ひろがる、会員証。", images: [{ url: new URL("/og.png", base).toString(), width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: "COMPASSION WORLD | LINE MEMBERS CARD", description: "つながる、ひろがる、会員証。", images: [new URL("/og.png", base).toString()] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
