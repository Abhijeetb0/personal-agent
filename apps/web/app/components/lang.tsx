"use client";
import { useEffect, useState } from "react";
import { readLang, type Lang } from "../../lib/i18n";

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("hi");
  useEffect(() => { setLangState(readLang()); }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("pa-lang", l); } catch {}
  };
  return [lang, setLang];
}

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <button
      className="ghost sm"
      onClick={() => onChange(lang === "hi" ? "en" : "hi")}
      title={lang === "hi" ? "Switch to English" : "Hindi me dekho"}
      style={{ padding: "8px 12px" }}
    >
      {lang === "hi" ? "🇮🇳 हिं" : "🇬🇧 EN"}
    </button>
  );
}
