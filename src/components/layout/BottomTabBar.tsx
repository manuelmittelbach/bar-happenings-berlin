import { Link, useLocation } from "react-router-dom";
import { ListBullets, MapTrifold, Storefront } from "@phosphor-icons/react";

type TabKey = "list" | "map" | "bars";

interface TabDef {
  key: TabKey;
  to: string;
  label: string;
  Icon: typeof ListBullets;
  isActive: (pathname: string) => boolean;
}

const TABS: TabDef[] = [
  {
    key: "list",
    to: "/events",
    label: "Events",
    Icon: ListBullets,
    // Active strictly on the List surface. /event/* and /bar/* are
    // their own editorial pages — neither List nor Map is "where you
    // are" when reading a detail, so leaving both inactive avoids the
    // misleading List-stays-black hint after drilling in from either
    // surface.
    isActive: (p) => p === "/events",
  },
  {
    key: "map",
    to: "/map",
    label: "Map",
    Icon: MapTrifold,
    isActive: (p) => p === "/map",
  },
  {
    key: "bars",
    to: "/bars",
    label: "Bars",
    Icon: Storefront,
    isActive: (p) => p === "/bars",
  },
];

export default function BottomTabBar() {
  const location = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-foreground bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="flex">
        {TABS.map(({ key, to, label, Icon, isActive }) => {
          const active = isActive(location.pathname);
          return (
            <li key={key} className="flex-1">
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-1 py-2"
                style={{
                  color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                  height: 56,
                }}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: active ? 700 : 400,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
