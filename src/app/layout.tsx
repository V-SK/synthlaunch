import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'SynthLaunch | AI Agent Platform on X Layer',
  description: 'Launch AI agent tokens with built-in fee sharing on X Layer. Powered by OKX Onchain OS.',
  icons: {
    icon: '/logo.jpg',
    apple: '/logo.jpg',
  },
  openGraph: {
    title: 'SynthLaunch | AI Agent Platform on X Layer',
    description: 'Launch AI agent tokens with built-in fee sharing on X Layer. Powered by OKX Onchain OS.',
    url: 'https://synthlaunch.fun',
    siteName: 'SynthLaunch',
    images: [
      {
        url: 'https://synthlaunch.fun/logo.jpg',
        width: 512,
        height: 512,
        alt: 'SynthLaunch - AI Agent Token Launches',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SynthLaunch | AI Agent Platform on X Layer',
    description: 'Launch AI agent tokens with built-in fee sharing on X Layer. Powered by OKX Onchain OS.',
    images: ['https://synthlaunch.fun/logo.jpg'],
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
                  SynthLaunch v0.1.0 — Powered by OKX Onchain OS · X Layer
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
