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

declare module 'wasm-pandoc/src/core.js' {
  interface PandocConvertResult {
    stdout: string;
    stderr: string;
    warnings: unknown[];
    files: Record<string, Blob>;
    mediaFiles: Record<string, Blob>;
  }
  interface PandocInstance {
    convert(
      options: Record<string, unknown>,
      stdin: string | null,
      files: Record<string, Blob | string>,
    ): Promise<PandocConvertResult>;
    query(options: Record<string, unknown>): unknown;
  }
  export function createPandocInstance(wasmBinary: ArrayBuffer): Promise<PandocInstance>;
}

declare module 'wasm-pandoc/src/pandoc.wasm?url' {
  const url: string;
  export default url;
}
