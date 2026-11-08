import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";
import "./globals.css";
import "./terminal.css";
import "./receipts.css";
import "./polish.css";

export const metadata: Metadata = {
  title: { default: "Pulse — Memecoin Terminal", template: "%s · Pulse" },
  description: "AI launch radar for Solana memecoins: evidence-bound verdicts, live exit quotes and creator history. Check before you sign.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0d0e", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
