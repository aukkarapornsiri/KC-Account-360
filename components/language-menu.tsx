"use client";

import { Globe2 } from "lucide-react";

type Language = "th" | "en";

export function LanguageMenu({ language, onChange, compact = false }: { language: Language; onChange: (value: string) => void; compact?: boolean }) {
  const label = language === "th" ? "TH" : "EN";
  const nextLanguage = language === "th" ? "en" : "th";
  const accessibleLabel = language === "th" ? "เปลี่ยนเป็นภาษาอังกฤษ" : "Switch to Thai";

  return (
    <button type="button" className={`language-menu-trigger${compact ? " compact" : ""}`} aria-label={accessibleLabel} title={accessibleLabel} onClick={() => onChange(nextLanguage)}>
      <Globe2 />
      <strong>{label}</strong>
    </button>
  );
}
