import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'SynthLaunch | AI Agent Token Launches on BSC',
  description: 'Launch tokens with built-in fee sharing for AI agents on BSC. Powered by Flap Protocol.',
  icons: {
    icon: '/logo.jpg',
    apple: '/logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-synth-bg font-mono">
        <Providers>
          <div className="relative">
            {/* Scanline overlay */}
            <div className="fixed inset-0 scanline z-[5] pointer-events-none" />
            
            <Header />
            <main className="max-w-7xl mx-auto px-4 py-8 mt-14">
              {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-synth-border mt-20">
              <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
                <span className="text-xs text-synth-muted font-mono">
                  SynthLaunch v0.1.0 — Built on Flap Protocol · BSC Network
                </span>
                <div className="flex items-center gap-4 text-xs text-synth-muted">
                  <a href="/docs" className="hover:text-synth-green transition-colors">docs</a>
                  <a href="https://github.com/V-SK/synthlaunch" target="_blank" rel="noopener noreferrer" className="hover:text-synth-green transition-colors">github</a>
                  <a href="https://x.com/synth_fun" target="_blank" rel="noopener noreferrer" className="hover:text-synth-green transition-colors">twitter</a>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
