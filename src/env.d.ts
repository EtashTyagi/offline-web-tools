/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly IS_OPEN_SOURCE: string;
  readonly ADSENSE_CLIENT_ID: string;
  readonly SITE_URL: string;
  readonly GITHUB_REPO_URL: string;
  readonly GA_MEASUREMENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
