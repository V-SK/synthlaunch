'use client';

interface TaxRateSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function TaxRateSlider({ value, onChange }: TaxRateSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-synth-muted">
          AI Agent Tax Rate
        </label>
        <span className="text-sm font-bold text-synth-cyan">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={0.5}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-synth-border rounded-lg appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-synth-cyan
          [&::-webkit-slider-thumb]:shadow-glow-cyan
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-synth-muted">
        <span>0%</span>
        <span>5%</span>
      </div>
      <p className="text-[10px] text-synth-muted">
        Tax is sent to the linked AI agent&apos;s wallet. The agent earns fees on every trade.
      </p>
    </div>
  );
}
