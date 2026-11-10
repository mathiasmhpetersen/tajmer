import { Link, useLocation } from "wouter";
import { Eye, LayoutGrid, Mic2 } from "lucide-react";
import { ARTISTS } from "@shared/artists";
import { cn } from "@/lib/cn";
import { useIsClient } from "@/lib/session";
import { ThemeToggle } from "./ThemeToggle";

function NavItem({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150",
        active
          ? "border border-accent/60 text-ink"
          : "border border-transparent text-muted hover:text-ink hover:bg-card-2",
      )}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-faint">
      {children}
    </div>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const isClient = useIsClient();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-page md:flex">
      <div className="flex h-full flex-col px-3 py-4">
        {/* Project badge */}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <Mic2 className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">Tajmer Booking</div>
            <div className="truncate text-xs text-muted">Meta Ads</div>
          </div>
        </div>

        <nav className="mt-2 flex flex-1 flex-col overflow-y-auto">
          <SectionLabel>{isClient ? "Artister" : "Kunstnere"}</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {ARTISTS.map((artist) => (
              <NavItem
                key={artist.slug}
                href={`/${artist.slug}`}
                active={location === `/${artist.slug}`}
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-card-2 text-[11px] font-semibold text-muted">
                  {initials(artist.name)}
                </span>
                <span className="truncate">{artist.name}</span>
              </NavItem>
            ))}
          </div>

          <SectionLabel>Værktøj</SectionLabel>
          <div className="flex flex-col gap-0.5">
            <NavItem href="/" active={location === "/"}>
              <LayoutGrid className="size-[18px]" />
              <span>Oversigt</span>
            </NavItem>
            <NavItem href="/preview" active={location === "/preview"}>
              <Eye className="size-[18px]" />
              <span>Preview</span>
            </NavItem>
          </div>
        </nav>

        {/* User + theme */}
        <div className="mt-2 flex items-center justify-between border-t border-hairline px-1 pt-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-[rgb(42,170,150)] text-sm font-semibold text-white">
              M
            </div>
            <div className="leading-tight">
              <div className="text-sm font-medium">Mathias</div>
              <div className="text-xs text-muted">Marketingly</div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
