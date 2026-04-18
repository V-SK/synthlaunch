'use client';

import { useEffect, useRef, useState } from 'react';
import { SYNTH_WALLET } from '@/lib/wallet';

type Platform = 'android' | 'ios' | 'desktop';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'desktop';
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function WalletDownload() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const copySha = async () => {
    try {
      await navigator.clipboard.writeText(SYNTH_WALLET.android.sha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; user can select the text manually */
    }
  };

  const shortSha = `${SYNTH_WALLET.android.sha256.slice(0, 8)}…${SYNTH_WALLET.android.sha256.slice(-6)}`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 md:py-2 rounded border border-synth-green/40 bg-synth-green/5 text-synth-green text-[10px] md:text-xs font-mono hover:bg-synth-green/15 transition-colors"
      >
        <span aria-hidden>📱</span>
        <span className="hidden sm:inline">Wallet</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1rem)] rounded-md border border-synth-border bg-synth-bg/95 backdrop-blur-md shadow-lg shadow-black/40 p-3 z-50"
        >
          <div className="text-xs font-mono text-synth-muted mb-2">
            SYNTH Wallet · v{SYNTH_WALLET.version}
          </div>

          {/* Android primary CTA */}
          <a
            href={SYNTH_WALLET.android.apkUrl}
            download
            className="block w-full text-center px-3 py-2 rounded bg-synth-green text-black text-sm font-bold font-mono hover:bg-synth-green/90 transition-colors"
            onClick={() => setOpen(false)}
          >
            ⬇ Download for Android
          </a>
          <div className="text-[10px] font-mono text-synth-muted mt-1 text-center">
            {formatSize(SYNTH_WALLET.android.sizeBytes)} APK · sideload required
          </div>

          {platform === 'ios' && (
            <div className="mt-2 text-[11px] font-mono text-yellow-400/90 text-center border border-yellow-400/30 bg-yellow-400/5 rounded px-2 py-1.5">
              You appear to be on iOS. The Android APK won&apos;t install on
              your device — see iOS option below.
            </div>
          )}

          {/* iOS — coming soon, grayed */}
          <div className="mt-2 px-3 py-2 rounded border border-synth-border/60 bg-synth-surface/40 text-synth-muted text-xs font-mono flex items-center justify-between opacity-60 cursor-not-allowed">
            <span>iOS</span>
            <span className="text-[10px] uppercase tracking-wider">Coming soon</span>
          </div>

          {/* Verification */}
          <div className="mt-3 pt-3 border-t border-synth-border/60">
            <div className="text-[10px] font-mono text-synth-muted mb-1 uppercase tracking-wider">
              SHA-256
            </div>
            <button
              type="button"
              onClick={copySha}
              className="w-full text-left text-[10px] font-mono text-synth-text hover:text-synth-green transition-colors break-all"
              title="Click to copy full hash"
            >
              {shortSha} <span className="text-synth-muted">{copied ? '· copied' : '· tap to copy'}</span>
            </button>
          </div>

          {/* Footer links */}
          <div className="mt-3 pt-3 border-t border-synth-border/60 flex items-center justify-between text-[10px] font-mono">
            <a
              href={SYNTH_WALLET.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-synth-muted hover:text-synth-text"
            >
              Release notes ↗
            </a>
            <a
              href="/privacy"
              className="text-synth-muted hover:text-synth-text"
            >
              Privacy policy
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
