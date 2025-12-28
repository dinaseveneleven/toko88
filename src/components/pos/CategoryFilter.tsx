import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  const [open, setOpen] = useState(false);

  const allCategories = [{ value: "all", label: "Semua Kategori" }, ...categories.map((cat) => ({ value: cat, label: cat }))];

  const selectedLabel = selected ? selected : "Semua Kategori";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-[200px] justify-between bg-card border-border h-11"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full sm:w-[200px] p-0 bg-card border-border z-50">
        <Command className="bg-card">
          <CommandInput placeholder="Cari kategori..." className="h-9" />
          <CommandList>
            <CommandEmpty>Kategori tidak ditemukan</CommandEmpty>
            <CommandGroup>
              {allCategories.map((category) => (
                <CommandItem
                  key={category.value}
                  value={category.label}
                  onSelect={() => {
                    onSelect(category.value === "all" ? null : category.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  {category.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      (selected === category.value || (category.value === "all" && !selected))
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
