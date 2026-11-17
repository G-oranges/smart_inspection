/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_WEB_VITALS_ENDPOINT?: string;
  readonly VITE_WEB_VITALS_SAMPLE_RATE?: string;
}
