// New file — replaces reactjs-flip-card dependency from upstream
// Pure CSS 3D flip; no external deps
"use client";

type CardProps = {
  symbol: string;
  isFlipped: boolean;
  isMatched: boolean;
  onClick: () => void;
  index: number;
};

export function Card({ symbol, isFlipped, isMatched, onClick, index }: CardProps) {
  const show = isFlipped || isMatched;
  return (
    <div
      className={`mem-card${show ? " flipped" : ""}${isMatched ? " matched" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      aria-label={show ? `Card: ${symbol}` : `Face-down card ${index + 1}`}
      aria-pressed={show}
    >
      <div className="mem-card-inner">
        <div className="mem-card-back">?</div>
        <div className="mem-card-front" aria-hidden={!show}>{symbol}</div>
      </div>
    </div>
  );
}
