import { Link, useLocation } from "react-router-dom";
import { ListBullets, MapTrifold, User } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";

type TabKey = "list" | "map" | "profile";

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
    to: "/",
    label: "List",
    Icon: ListBullets,
    isActive: (p) => p === "/" || p.startsWith("/event/") || p.startsWith("/bar/"),
  },
  {
    key: "map",
    to: "/map",
    label: "Map",
    Icon: MapTrifold,
    isActive: (p) => p === "/map",
  },
  {
    key: "profile",
    to: "/profile",
    label: "Profile",
    Icon: User,
    isActive: (p) => p.startsWith("/profile") || p.startsWith("/dashboard") || p.startsWith("/admin"),
  },
];

export default function BottomTabBar() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-foreground bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="flex">
        {TABS.map(({ key, to, label, Icon, isActive }) => {
          const active = isActive(location.pathname);
          const target = key === "profile" && !user ? "/auth" : to;
          return (
            <li key={key} className="flex-1">
              <Link
                to={target}
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
