import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Cog Life Scheduler',
  description: 'AI-assisted personal life scheduler',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
