import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const LOCALES = ["en", "es", "fr"];

export default getRequestConfig(async () => {
  const store = await cookies();
  const requested = store.get("NEXT_LOCALE")?.value;
  const locale = requested && LOCALES.includes(requested) ? requested : "en";

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
