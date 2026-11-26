export interface DynamicLinks {
  homepage: string;
  support: string;
  repo: string;
  database: string;
  mirror: string;
  extension: string;
  logo: string;
}

export interface RemoteConfig {
  minVersion: string;
  latestVersion: string;
  links: DynamicLinks;
  flags?: Record<string, boolean>;
  selectors?: Record<string, string>;
  announcement: string | null;
  updatedAt: string;
}

export interface StorageLike {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export const API_BASE_URL = 'https://amaes-community-relay.study-tool-amaes-relay.workers.dev';
export const CONFIG_CACHE_KEY = 'amaes_remote_config_cache';
export const CONFIG_TTL_MS = 6 * 60 * 60 * 1000;

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  minVersion: '0.1.0',
  latestVersion: '0.1.4',
  links: {
    homepage: 'https://study-tool-amaes.pages.dev/',
    support: 'https://github.com/Study-Tool/amaes/issues',
    repo: 'https://github.com/Study-Tool/amaes',
    database: 'https://github.com/Study-Tool/database',
    mirror: '',
    extension: 'https://study-tool-amaes.pages.dev/#install-step',
    logo: 'https://study-tool-amaes.pages.dev/assets/amaes-toolkit-logo.png',
  },
  flags: {},
  selectors: {},
  announcement: null,
  updatedAt: '',
};

interface CachedConfigEntry {
  fetchedAt: number;
  config: RemoteConfig;
}

function isValidConfig(value: unknown): value is RemoteConfig {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RemoteConfig>;
  return Boolean(
    candidate.links &&
      typeof candidate.links.homepage === 'string' &&
      typeof candidate.links.support === 'string',
  );
}

export interface BrowserUpdateGuide {
  browserLabel: string;
  extensionsUrl: string;
  steps: string[];
}

/** Parse a `vX.Y.Z` or `X.Y.Z` version string into `[major, minor, patch]`. */
export function parseSemver(version: string): [number, number, number] | null {
  const match = String(version || '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Compare two semver strings (`1` if `left > right`, `-1` if `left < right`, `0` if equal, `null` if invalid). */
export function compareSemver(left: string, right: string): number | null {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

/** Return true when `latestVersion` is strictly newer than `installedVersion`. */
export function isUpdateAvailable(installedVersion: string, latestVersion: string): boolean {
  return compareSemver(latestVersion, installedVersion) === 1;
}

/** Return browser-specific sideloaded extension update steps and extensions page URL. */
export function getBrowserUpdateGuide(userAgent = ''): BrowserUpdateGuide {
  const ua = userAgent.toLowerCase();
  if (ua.includes('firefox')) {
    return {
      browserLabel: 'Firefox',
      extensionsUrl: 'about:debugging#/runtime/this-firefox',
      steps: [
        'Click Download Update to save the latest Firefox .zip file.',
        'Extract the files directly into your existing AMAES folder (where manifest.json lives) and replace all files.',
        'Open about:debugging#/runtime/this-firefox and click Reload (or Load Temporary Add-on -> manifest.json).',
      ],
    };
  }
  const isEdge = ua.includes('edg/');
  const extensionsUrl = isEdge ? 'edge://extensions' : 'chrome://extensions';
  return {
    browserLabel: isEdge ? 'Microsoft Edge' : 'Chrome / Chromium',
    extensionsUrl,
    steps: [
      'Click Download Update to save the latest .zip file.',
      'Extract the files directly into your existing AMAES folder (where manifest.json lives) and replace all files so settings stay saved.',
      `Open ${extensionsUrl} and click Reload on AMAES Toolkit.`,
    ],
  };
}

export async function getDynamicConfig(
  storage: StorageLike,
  fetcher: typeof fetch = fetch,
  now = Date.now(),
  forceRefresh = false,
): Promise<RemoteConfig> {
  if (!forceRefresh) {
    const raw = await storage.get(CONFIG_CACHE_KEY);
    const cached = raw[CONFIG_CACHE_KEY] as CachedConfigEntry | undefined;
    if (
      cached &&
      typeof cached.fetchedAt === 'number' &&
      now - cached.fetchedAt < CONFIG_TTL_MS &&
      isValidConfig(cached.config)
    ) {
      return cached.config;
    }
  }

  try {
    const res = await fetcher(`${API_BASE_URL}/v1/config`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (isValidConfig(data)) {
        const merged: RemoteConfig = {
          minVersion: data.minVersion || DEFAULT_REMOTE_CONFIG.minVersion,
          latestVersion: data.latestVersion || DEFAULT_REMOTE_CONFIG.latestVersion,
          links: { ...DEFAULT_REMOTE_CONFIG.links, ...data.links },
          flags: data.flags && typeof data.flags === 'object' ? data.flags : {},
          selectors:
            data.selectors && typeof data.selectors === 'object' ? data.selectors : {},
          announcement: data.announcement ?? null,
          updatedAt: data.updatedAt || new Date(now).toISOString(),
        };
        await storage.set({
          [CONFIG_CACHE_KEY]: { fetchedAt: now, config: merged },
        });
        return merged;
      }
    }
  } catch {
    // Network failures fall back to stale cache or defaults.
  }

  const fallbackRaw = await storage.get(CONFIG_CACHE_KEY);
  const stale = fallbackRaw[CONFIG_CACHE_KEY] as CachedConfigEntry | undefined;
  if (stale && isValidConfig(stale.config)) {
    return stale.config;
  }
  return DEFAULT_REMOTE_CONFIG;
}
