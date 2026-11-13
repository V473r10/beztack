import { env } from "@/env";
import { setFormatLanguageSource } from "@/lib/format";
import { createI18n } from "./create-i18n";

/** The app's i18n instance (resources are bundled, so it is ready immediately). */
export const i18n = createI18n({ defaultLocale: env.VITE_DEFAULT_LOCALE });

// Prices and dates follow the language the user chose, which lives in this instance.
setFormatLanguageSource(i18n);
