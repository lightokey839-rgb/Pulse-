import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Pulse — Check before you sign", description: "Evidence-bound Solana token investigation." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
