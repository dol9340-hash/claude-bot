import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen grid grid-cols-[200px_1fr] grid-rows-[48px_1fr]">
      <Header />
      <Sidebar />
      <main className="overflow-auto p-6 bg-[var(--bg-base)]">
        {children}
      </main>
    </div>
  );
}
