import { ReactNode } from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";
import Footer from "./Footer";

interface MainLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

const MainLayout = ({ children, showFooter = true }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      {showFooter && <Footer />}
      <BottomNav />
    </div>
  );
};

export default MainLayout;
