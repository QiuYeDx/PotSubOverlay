import { Slider } from "@/components/ui/slider";

/** Slider with a fixed-width, tabular value readout on the right. */
export function ValueSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  width = 220,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  width?: number;
}) {
  return (
    <div className="flex items-center gap-3" style={{ width }}>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next)}
        className="flex-1"
      />
      <span className="w-11 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {format(value)}
      </span>
    </div>
  );
}
