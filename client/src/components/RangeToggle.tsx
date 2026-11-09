import { RANGES, type Range } from "@shared/types";
import { Chip } from "./ui/Chip";

export function RangeToggle({
  value,
  onChange,
}: {
  value: Range;
  onChange: (range: Range) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {RANGES.map((r) => (
        <Chip key={r.value} active={value === r.value} onClick={() => onChange(r.value)}>
          {r.label}
        </Chip>
      ))}
    </div>
  );
}
