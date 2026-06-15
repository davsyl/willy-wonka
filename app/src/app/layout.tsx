import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider } from "../components/WalletProvider";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spinx — On-chain Battle Tops",
  description: "Battle with on-chain Beyblade-style tops on Solana",
};

function NavBar() {
  return (
    <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <Link
          href="/"
          style={{
            color: "#6366f1",
            fontWeight: 700,
            fontSize: "20px",
            textDecoration: "none",
            letterSpacing: "0.05em",
          }}
        >
          SPINX
        </Link>
        <div style={{ display: "flex", gap: "16px" }}>
          <Link
            href="/"
            style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px" }}
          >
            Home
          </Link>
          <Link
            href="/inventory"
            style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px" }}
          >
            Inventory
          </Link>
          <Link
            href="/lobby"
            style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px" }}
          >
            Lobby
          </Link>
        </div>
      </div>
      <WalletMultiButtonWrapper />
    </nav>
  );
}

// Client component just for the wallet button
function WalletMultiButtonWrapper() {
  "use client";
  // Imported dynamically to avoid SSR issues
  return null;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <NavBarClient />
          <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}

// NavBar as a server component with client wallet button
function NavBarClient() {
  return (
    <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <Link
          href="/"
          style={{
            color: "#6366f1",
            fontWeight: 700,
            fontSize: "20px",
            textDecoration: "none",
            letterSpacing: "0.05em",
          }}
        >
          SPINX
        </Link>
        <div style={{ display: "flex", gap: "16px" }}>
          <Link href="/" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px" }}>
            Home
          </Link>
          <Link href="/inventory" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px" }}>
            Inventory
          </Link>
          <Link href="/lobby" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "14px" }}>
            Lobby
          </Link>
        </div>
      </div>
      <NavWalletButton />
    </nav>
  );
}

// This needs to be a separate client component file — we inline it here
// by using a dynamic import approach at the top of the nav.
// Since layout is a server component, the wallet button is a separate client boundary.
import NavWalletButton from "../components/NavWalletButton";
