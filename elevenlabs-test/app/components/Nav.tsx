"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Bellen" },
  { href: "/config", label: "Configuratie" },
  { href: "/data", label: "Data" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--card-border)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-white font-bold text-lg">
            H
          </div>
          <div className="text-left">
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              Huisartspraktijk De Gezondheid
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              AI Telefoonassistent — Demo
            </p>
          </div>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                pathname === tab.href
                  ? "bg-white text-[var(--primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
