import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ActiveIcon = OPTIONS.find((o) => o.value === theme)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
          title={`Theme: ${theme}`}
          aria-label="Change theme"
          data-testid="theme-toggle-btn"
        >
          <ActiveIcon className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]" data-testid="theme-toggle-menu">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="gap-2 cursor-pointer"
            data-testid={`theme-option-${value}`}
          >
            <Icon className="w-4 h-4" />
            <span className="flex-1">{label}</span>
            {theme === value && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                {value === "system" ? resolvedTheme : "on"}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
