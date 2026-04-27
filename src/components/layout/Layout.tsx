import { Outlet, useLocation } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function Layout() {
  const { pathname } = useLocation();
  const isMap = pathname === "/map";

  return (
    <div className={`flex flex-col ${isMap ? "h-[100dvh] overflow-hidden" : "min-h-screen"}`}>
      <Header />
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
      {!isMap && <Footer />}
    </div>
  );
}
