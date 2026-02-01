'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  windowSize?: number; // how many page buttons to show
}

export function Pagination({ currentPage, totalPages, onPageChange, windowSize = 5 }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Calculate sliding window
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + windowSize - 1);
  // Adjust start if end is capped
  start = Math.max(1, end - windowSize + 1);

  const pages: (number | '...')[] = [];

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('...');
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 py-4">
      {/* Prev */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-2.5 py-1.5 rounded text-xs font-mono transition-all duration-200 
          text-synth-muted hover:text-synth-text hover:bg-synth-surface
          disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        ‹
      </button>

      {/* Page buttons */}
      {pages.map((page, i) =>
        page === '...' ? (
          <span key={`dots-${i}`} className="px-1.5 text-xs text-synth-muted select-none">
            ···
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[32px] h-8 rounded text-xs font-mono transition-all duration-200 ${
              page === currentPage
                ? 'text-synth-green bg-synth-green/15 border border-synth-green/30'
                : 'text-synth-muted hover:text-synth-text hover:bg-synth-surface border border-transparent'
            }`}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-2.5 py-1.5 rounded text-xs font-mono transition-all duration-200 
          text-synth-muted hover:text-synth-text hover:bg-synth-surface
          disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        ›
      </button>
    </div>
  );
}
