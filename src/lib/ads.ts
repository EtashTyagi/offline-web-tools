const rawOpenSource = import.meta.env.IS_OPEN_SOURCE;
export const IS_OPEN_SOURCE =
  typeof rawOpenSource === 'string'
    ? rawOpenSource.toLowerCase() === 'true'
    : rawOpenSource === true;
export const ADSENSE_CLIENT_ID = import.meta.env.ADSENSE_CLIENT_ID ?? '';
export const GITHUB_REPO_URL =
  import.meta.env.GITHUB_REPO_URL ?? 'https://github.com/EtashTyagi/offline-web-tools';

export function isOpenSource(): boolean {
  return IS_OPEN_SOURCE;
}

export function adsEnabled(): boolean {
  return IS_OPEN_SOURCE && ADSENSE_CLIENT_ID.length > 0;
}

export function adsenseScriptTag(): string | null {
  if (!adsEnabled()) return null;
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
}

export function githubToolPath(category: string, toolId: string): string {
  return `${GITHUB_REPO_URL}/tree/main/src/tools/${category}/${toolId}`;
}
