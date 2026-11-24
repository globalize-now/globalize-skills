import { useTranslations } from "next-intl";
import LocaleSwitcher from "../components/LocaleSwitcher";

export default function Home() {
  const t = useTranslations("HomePage");

  return (
    <main>
      <LocaleSwitcher />
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
    </main>
  );
}
