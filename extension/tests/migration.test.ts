import { describe, expect, it } from 'vitest';
import {
  MIGRATION_DONE_KEY,
  migrateLegacyUserscriptStorage,
} from '../utils/storage';
import type { StorageLike } from '../utils/config';

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

describe('migrateLegacyUserscriptStorage', () => {
  it('imports legacy localStorage keys and answer banks once and clears stale relay override', async () => {
    const extStorage = createMemoryStorage({
      amaes_gemini_model: 'gemini-2.5-flash',
    });
    const localData: Record<string, string> = {
      amaes_gemini_api_key: 'test-key-123',
      amaes_gemini_model: 'old-model',
      amaes_terms_acknowledged: 'true',
      amaes_answer_db_CS6204: '[{"q":"Q1"}]',
      amaes_community_relay_url: 'https://legacy-relay.workers.dev',
      unrelated_key: 'ignore-me',
    };
    const keys = Object.keys(localData);
    const pageStorage = {
      getItem: (key: string) => localData[key] ?? null,
      removeItem: (key: string) => {
        delete localData[key];
      },
      get length() {
        return keys.length;
      },
      key: (i: number) => keys[i] ?? null,
    };

    const res1 = await migrateLegacyUserscriptStorage(extStorage, pageStorage);
    expect(res1.migrated).toBe(true);
    expect(res1.importedKeys).toContain('amaes_terms_acknowledged');
    expect(res1.importedKeys).toContain('amaes_gemini_api_key');
    expect(res1.importedKeys).toContain('amaes_answer_db_CS6204');
    expect(localData.amaes_community_relay_url).toBeUndefined();
    expect((await extStorage.get('amaes_gemini_api_key')).amaes_gemini_api_key).toBe('test-key-123');
    expect((await extStorage.get('amaes_answer_db_CS6204')).amaes_answer_db_CS6204).toBe('[{"q":"Q1"}]');
    expect((await extStorage.get('amaes_gemini_model')).amaes_gemini_model).toBe('gemini-2.5-flash');
    expect((await extStorage.get(MIGRATION_DONE_KEY))[MIGRATION_DONE_KEY]).toBe(true);

    // Subsequent calls are no-ops.
    const res2 = await migrateLegacyUserscriptStorage(extStorage, pageStorage);
    expect(res2.migrated).toBe(false);
    expect(res2.importedKeys).toEqual([]);
  });
});
