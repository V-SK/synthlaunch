import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'synth — AI Agent Token Launchpad on BSC',
  description: 'Launch tokens for AI agents on BSC with built-in tax routing. Powered by Flap Protocol.',
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
            <div className="fixed inset-0 scanline z-50 pointer-events-none" />
            
            <Header />
            <main className="max-w-7xl mx-auto px-4 py-8">
              {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-synth-border mt-20">
              <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
                <span className="text-xs text-synth-muted font-mono">
                  synth v0.1.0 — built on flap protocol
                </span>
                <div className="flex items-center gap-4 text-xs text-synth-muted">
                  <a href="#" className="hover:text-synth-green transition-colors">docs</a>
                  <a href="#" className="hover:text-synth-green transition-colors">github</a>
                  <a href="#" className="hover:text-synth-green transition-colors">twitter</a>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
