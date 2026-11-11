import { Link, useLocation } from "wouter";
import { Mic2 } from "lucide-react";
import { ARTISTS } from "@shared/artists";
import { cn } from "@/lib/cn";
import { useIsClient } from "@/lib/session";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

/** Mobile: the sidebar collapses to a top bar with a scrolling chip row. */
function MobileBar() {
  const [location] = useLocation();
  const isClient = useIsClient();
  const items = [
    { slug: "", name: "Oversigt" },
    { slug: "preview", name: "Preview" },
    ...(isClient ? [] : [{ slug: "okonomi", name: "Økonomi" }]),
    ...ARTISTS,
  ];
  return (
    <div className="sticky top-0 z-20 border-b border-hairline bg-page/90 backdrop-blur md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
            <Mic2 className="size-4" />
          </div>
          <div className="text-sm font-semibold">Tajmer Booking</div>
        </div>
        <ThemeToggle />
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {items.map((item) => {
          const href = `/${item.slug}`;
          const active = location === href || (item.slug === "" && location === "/");
          return (
            <Link
              key={item.slug || "overview"}
              href={href}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-transparent bg-ink text-page"
                  : "border-hairline bg-card-2 text-muted",
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-page">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar />
        <main className="mx-auto w-full max-w-content px-5 py-8 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
