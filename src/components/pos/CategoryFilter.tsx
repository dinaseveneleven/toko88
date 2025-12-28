import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <Select
      value={selected ?? "all"}
      onValueChange={(value) => onSelect(value === "all" ? null : value)}
    >
      <SelectTrigger className="w-full sm:w-[200px] bg-card border-border h-11">
        <SelectValue placeholder="Pilih Kategori" />
      </SelectTrigger>
      <SelectContent className="bg-card border-border z-50">
        <SelectItem value="all">Semua Kategori</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
