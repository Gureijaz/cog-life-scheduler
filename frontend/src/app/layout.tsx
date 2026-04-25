'use client';

import { Inter, JetBrains_Mono } from 'next/font/google';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ThemeContext, useThemeProvider } from '@/hooks/useTheme';
import ToastProvider from '@/components/ui/ToastProvider';
import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/chat/ChatPanel';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeCtx = useThemeProvider();
  const [chatOpen, setChatOpen] = useState(false);
  const pathname = usePathname();

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <title>Cog Life Scheduler</title>
        <meta name="description" content="AI-assisted personal life scheduler" />
      </head>
      <body>
        <ThemeContext.Provider value={themeCtx}>
          <ToastProvider>
            <div className="app-layout">
              <Sidebar
                onChatToggle={() => setChatOpen((prev) => !prev)}
                chatOpen={chatOpen}
              />
              <main className="main-content">
                <div className="page-transition" key={pathname}>
                  {children}
                </div>
              </main>
              <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
            </div>
          </ToastProvider>
        </ThemeContext.Provider>
      </body>
    </html>
  );
}
