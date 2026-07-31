import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";

import { getPublicJournalSafe } from "@/features/public/api/public-api";
import { APP_NAME } from "@/lib/constants";
import { ClientProviders } from "@/providers/client-providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const journal = await getPublicJournalSafe();

  const journalName = journal?.name.trim() || APP_NAME;

  const description =
    journal?.description.trim() ||
    "Scientific journal submission, peer review, and publishing platform.";

  return {
    title: {
      default: journalName,
      template: `%s | ${journalName}`,
    },
    description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const journal = await getPublicJournalSafe();

  const language = journal?.defaultLanguage.trim() || "en";

  return (
    <html
      lang={language}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
