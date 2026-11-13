import { env } from "@/env";
import { createI18n } from "./create-i18n";

/** The app's i18n instance (resources are bundled, so it is ready immediately). */
export const i18n = createI18n({ defaultLocale: env.VITE_DEFAULT_LOCALE });
