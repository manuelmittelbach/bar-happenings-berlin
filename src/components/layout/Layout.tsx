import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function Layout() {
  const { pathname } = useLocation();
  const hideFooter = pathname === "/map";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
