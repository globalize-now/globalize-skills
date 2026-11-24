"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

const LOCALES = ["en", "es", "fr"] as const;

export default function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();

  return (
    <label>
      {t("label")}
      <select
        value={locale}
        onChange={(event) => {
          document.cookie = `NEXT_LOCALE=${event.target.value}; path=/`;
          router.refresh();
        }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(`locale.${code}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
