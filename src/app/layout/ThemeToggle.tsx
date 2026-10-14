import { Moon, Sun } from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";
import { useT } from "../../lib/i18n/LocalizationProvider";

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const { t } = useT();
  const nextLabel = mode === "dark" ? t("theme.toLight") : t("theme.toDark");

  return (
    <button
      aria-label={nextLabel}
      className="icon-button"
      onClick={toggle}
      title={nextLabel}
      type="button"
    >
      {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
