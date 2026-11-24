import en from "./locales/en.json";
import de from "./locales/de.json";

const catalogs = { en, de } as const;
type Locale = keyof typeof catalogs;
type Key = keyof typeof en;

const stored = localStorage.getItem("locale");
let current: Locale = stored === "de" ? "de" : "en";

export function setLocale(locale: Locale) {
  current = locale;
  localStorage.setItem("locale", locale);
}

export function t(key: Key): string {
  return catalogs[current][key] ?? en[key];
}
