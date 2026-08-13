import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Panelgraph — reviewer conflict screening",
    template: "%s · Panelgraph",
  },
  description:
    "Screen candidate peer reviewers for conflicts of interest by tracing " +
    "co-authorship, supervision, shared grants and overlapping affiliations " +
    "through a graph database.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border-subtle mt-16">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-subtle">
            Synthetic demonstration data. Researchers, papers, grants and
            proposals are generated; institutions and funders are real
            organisations used for realism only.
          </div>
        </footer>
      </body>
    </html>
  );
}
