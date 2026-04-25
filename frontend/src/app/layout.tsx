'use client';

import { Inter, JetBrains_Mono } from 'next/font/google';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeContext, useThemeProvider } from '@/hooks/useTheme';
import { useTimeOfDay } from '@/hooks/useTimeOfDay';
import { useMouseParallax } from '@/hooks/useMouseParallax';
import { useCinematicNavigation } from '@/hooks/useCinematicNavigation';
import { useParticleController } from '@/hooks/useParticleController';
import { useAdaptiveQuality } from '@/hooks/useAdaptiveQuality';
import ToastProvider from '@/components/ui/ToastProvider';
import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/chat/ChatPanel';
import DynamicGradientMesh from '@/components/three/DynamicGradientMesh';
import DynamicSceneCanvas from '@/components/three/DynamicSceneCanvas';
import DynamicCinematicLoader from '@/components/three/DynamicCinematicLoader';
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

const pageVariants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};

const pageTransition = {
  duration: 0.3,
  ease: 'easeInOut' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeCtx = useThemeProvider();
  const [chatOpen, setChatOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const { timeOfDay } = useTimeOfDay();
  const quality = useAdaptiveQuality();
  const mouseOffset = useMouseParallax({
    intensity: 1.5,
    smoothing: 0.08,
    enabled: quality.parallaxEnabled,
  });
  const { cameraTarget, currentRoute } = useCinematicNavigation();
  const { events: particleEvents, clearCompleted } = useParticleController();

  const handleDataChanged = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleLoaderComplete = useCallback(() => {
    setLoaded(true);
  }, []);

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <title>Cog Life Scheduler</title>
        <meta name="description" content="AI-assisted personal life scheduler" />
      </head>
      <body>
        <ThemeContext.Provider value={themeCtx}>
          <ToastProvider>
            {/* Cinematic loader */}
            {!loaded && <DynamicCinematicLoader onComplete={handleLoaderComplete} />}

            {/* Layer 0: Gradient mesh background */}
            <DynamicGradientMesh timeOfDay={timeOfDay} />

            {/* Layer 1: Three.js scene */}
            <DynamicSceneCanvas
              currentRoute={currentRoute}
              mousePosition={mouseOffset}
              timeOfDay={timeOfDay}
              particleEvents={particleEvents}
              cameraTarget={cameraTarget}
              quality={quality}
              onParticleEventComplete={() => clearCompleted()}
            />

            {/* Layer 2+3: UI */}
            <div className="app-layout cinematic-ui-layer">
              <Sidebar
                onChatToggle={() => setChatOpen((prev) => !prev)}
                chatOpen={chatOpen}
              />
              <main className="main-content">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={pathname}
                    className="cinematic-page-content"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </main>
              <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} onDataChanged={handleDataChanged} />
            </div>
          </ToastProvider>
        </ThemeContext.Provider>
      </body>
    </html>
  );
}
