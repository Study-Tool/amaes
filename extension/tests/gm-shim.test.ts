import { describe, expect, it, vi } from 'vitest';
import { createGmApi } from '../utils/gm-shim';

describe('createGmApi GM shim', () => {
  it('preloads storage and persists GM_getValue/GM_setValue/GM_deleteValue', async () => {
    const store: Record<string, unknown> = {
      amaes_gemini_api_key: 'stored-key',
    };
    const sendMessage = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      responseText: '{"healthy":true}',
      responseHeaders: 'content-type: application/json',
      finalUrl: 'https://amaes-community-relay.study-tool-amaes-relay.workers.dev/health',
    }));

    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: async () => ({ ...store }),
          set: async (items: Record<string, unknown>) => {
            Object.assign(store, items);
          },
          remove: async (keys: string[]) => {
            keys.forEach((k) => delete store[k]);
          },
        },
      },
      runtime: {
        sendMessage,
      },
    });

    const gm = await createGmApi();
    expect(gm.GM_getValue('amaes_gemini_api_key')).toBe('stored-key');
    expect(gm.GM_getValue('missing_key', 'fallback')).toBe('fallback');

    gm.GM_setValue('amaes_theme', 'dark');
    expect(gm.GM_getValue('amaes_theme')).toBe('dark');
    expect(store.amaes_theme).toBe('dark');

    gm.GM_deleteValue('amaes_theme');
    expect(gm.GM_getValue('amaes_theme', null)).toBeNull();

    await new Promise<void>((resolve) => {
      gm.GM_xmlhttpRequest({
        url: 'https://amaes-community-relay.study-tool-amaes-relay.workers.dev/health',
        onload: (res) => {
          expect(res.status).toBe(200);
          expect(res.responseText).toBe('{"healthy":true}');
          resolve();
        },
      });
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
