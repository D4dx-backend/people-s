import { useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { FranchiseFilter } from "./FranchiseFilter";
import { useCrossFranchise } from "@/hooks/useCrossFranchise";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { selectedFranchise, isCrossFranchise } = useCrossFranchise();

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="relative flex-1 md:ml-64">
          <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="container relative mx-auto py-4 px-2 md:py-6 md:px-3 lg:py-8 lg:px-4">
            <FranchiseFilter className="mb-4" />
            <div key={isCrossFranchise ? `cf-${selectedFranchise}` : 'single'}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
