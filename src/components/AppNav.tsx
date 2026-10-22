"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Brand";
import { LogoutButton } from "@/components/LogoutButton";
import type { SessionUser } from "@/lib/auth";

const links = [
  { href: "/compose", label: "New plan" },
  { href: "/plans", label: "My plans" },
  { href: "/settings", label: "Settings" },
];

export function AppNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  return (
    <header className="app-nav">
      <div className="container nav-inner">
        <div className="nav-cluster">
          <Brand href="/compose" />
          <nav aria-label="Main">
            <ul className="nav-links">
              {links.map((link) => {
                const active =
                  pathname === link.href ||
                  (link.href === "/plans" && pathname.startsWith("/plans"));
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="nav-link"
                      aria-current={active ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className="nav-account">
          <Link
            href="/settings"
            className="avatar"
            aria-label={`Account settings for ${user.email}`}
            title={user.email}
          >
            {user.email.slice(0, 1).toUpperCase()}
          </Link>
          <LogoutButton compact userId={user.id} />
        </div>
      </div>
    </header>
  );
}
