import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "tctc OpenAI Starter",
  description: "Token-gated OpenAI access powered by tctc-mcp",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
