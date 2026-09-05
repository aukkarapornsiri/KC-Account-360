"use client";

import { ChevronDown, Globe2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Language = "th" | "en";

export function LanguageMenu({ language, onChange, compact = false }: { language: Language; onChange: (value: string) => void; compact?: boolean }) {
  const label = language === "th" ? "TH" : "EN";
  const accessibleLabel = language === "th" ? "เลือกภาษา ปัจจุบันภาษาไทย" : "Select language, currently English";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`language-menu-trigger${compact ? " compact" : ""}`} aria-label={accessibleLabel}>
          <Globe2 />
          <strong>{label}</strong>
          <ChevronDown className="language-menu-chevron" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="language-menu-content" align="end" sideOffset={8}>
        <DropdownMenuRadioGroup value={language} onValueChange={onChange}>
          <DropdownMenuRadioItem value="th">ไทย <span>TH</span></DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">English <span>EN</span></DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
