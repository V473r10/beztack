/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables
 * This extends ImportMeta to include the env property
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BASE_PATH?: string;
  [key: string]: string | boolean | number | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
