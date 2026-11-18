import { describe, expect, it } from 'vitest';
import {
  CONFIG_CACHE_KEY,
  DEFAULT_REMOTE_CONFIG,
  getDynamicConfig,
  type StorageLike,
} from '../utils/config';

function createMemoryStorage(initial: Record<string, unknown> = {}): StorageLike {
  const store = { ...initial };
  return {
    async get(key: string) {
      return key in store ? { [key]: store[key] } : {};
    },
    async set(items: Record<string, unknown>) {
      Object.assign(store, items);
    },
  };
}

describe('getDynamicConfig', () => {
  it('fetches remote config including flags and selectors and caches it', async () => {
    const storage = createMemoryStorage();
    let fetchCalls = 0;
    const mockFetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({
          minVersion: '0.1.0',
          latestVersion: '0.2.0',
          links: {
            homepage: 'https://study-tool-amaes.pages.dev/',
            support: 'https://github.com/Study-Tool/amaes/issues',
            repo: 'https://codeberg.org/new-org/amaes-toolkit',
            database: 'https://codeberg.org/new-org/database',
            mirror: 'https://gitlab.com/new-org/amaes-toolkit',
            extension: 'https://study-tool-amaes.pages.dev/#install-step',
            logo: 'https://study-tool-amaes.pages.dev/assets/amaes-toolkit-logo.png',
          },
          flags: { autoQuiz: true, aiSolver: false },
          selectors: { quizForm: '#responseform' },
          announcement: 'Migrated to new org',
          updatedAt: '2026-11-16T00:00:00Z',
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const first = await getDynamicConfig(storage, mockFetch, 1_000);
    expect(fetchCalls).toBe(1);
    expect(first.links.repo).toBe('https://codeberg.org/new-org/amaes-toolkit');
    expect(first.flags?.aiSolver).toBe(false);
    expect(first.selectors?.quizForm).toBe('#responseform');
    expect(first.announcement).toBe('Migrated to new org');

    // Second call within TTL uses cache without fetching.
    const second = await getDynamicConfig(storage, mockFetch, 2_000);
    expect(fetchCalls).toBe(1);
    expect(second.links.database).toBe('https://codeberg.org/new-org/database');
  });

  it('falls back to stale cache or defaults if network fails', async () => {
    const storage = createMemoryStorage({
      [CONFIG_CACHE_KEY]: {
        fetchedAt: 1,
        config: {
          ...DEFAULT_REMOTE_CONFIG,
          links: {
            ...DEFAULT_REMOTE_CONFIG.links,
            repo: 'https://stale-mirror.example/repo',
          },
        },
      },
    });
    const failingFetch = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    const result = await getDynamicConfig(storage, failingFetch, 999_999_999);
    expect(result.links.repo).toBe('https://stale-mirror.example/repo');
  });
});
