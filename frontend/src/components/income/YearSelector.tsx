import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface YearSelectorProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  startYear?: number;
  endYear?: number;
}

export function YearSelector({
  selectedYear,
  onYearChange,
  startYear = 2020,
  endYear = new Date().getFullYear() + 1,
}: YearSelectorProps) {
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => endYear - i
  );

  return (
    <Select
      value={selectedYear.toString()}
      onValueChange={(value) => onYearChange(parseInt(value))}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Select year" />
      </SelectTrigger>
      <SelectContent>
        {years.map((year) => (
          <SelectItem key={year} value={year.toString()}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
