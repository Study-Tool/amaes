import { describe, expect, it, vi } from 'vitest';
import { createGmApi } from '../utils/gm-shim';

describe('createGmApi GM shim', () => {
  it('preloads storage, awaits async set/delete promises, and reconstructs Blob XHR responses', async () => {
    const store: Record<string, unknown> = {
      amaes_gemini_api_key: 'stored-key',
    };
    let setResolved = false;
    let removeResolved = false;

    const sendMessage = vi.fn(async (msg: { responseType?: string }) => {
      if (msg.responseType === 'blob') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          responseText: '',
          responseBase64: btoa('PNGDATA'),
          contentType: 'image/png',
          responseHeaders: 'content-type: image/png',
          finalUrl: 'https://semestral.amaes.com/img.png',
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        responseText: '{"healthy":true}',
        responseHeaders: 'content-type: application/json',
        finalUrl: 'https://amaes-community-relay.study-tool-amaes-relay.workers.dev/health',
      };
    });

    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: async () => ({ ...store }),
          set: async (items: Record<string, unknown>) => {
            await new Promise((r) => setTimeout(r, 10));
            Object.assign(store, items);
            setResolved = true;
          },
          remove: async (keys: string[]) => {
            await new Promise((r) => setTimeout(r, 10));
            keys.forEach((k) => delete store[k]);
            removeResolved = true;
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

    await gm.GM_setValue('amaes_theme', 'dark');
    expect(setResolved).toBe(true);
    expect(gm.GM_getValue('amaes_theme')).toBe('dark');
    expect(store.amaes_theme).toBe('dark');

    await gm.GM_deleteValue('amaes_theme');
    expect(removeResolved).toBe(true);
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

    await new Promise<void>((resolve) => {
      gm.GM_xmlhttpRequest({
        url: 'https://semestral.amaes.com/img.png',
        responseType: 'blob',
        onload: async (res) => {
          expect(res.response).toBeInstanceOf(Blob);
          expect(await (res.response as Blob).text()).toBe('PNGDATA');
          resolve();
        },
      });
    });

    await new Promise<void>((resolve) => {
      gm.GM_xmlhttpRequest({
        url: 'https://amaes-community-relay.study-tool-amaes-relay.workers.dev/health',
        responseType: 'json',
        onload: (res) => {
          expect(res.status).toBe(200);
          expect(res.response).toEqual({ healthy: true });
          resolve();
        },
      });
    });

    expect(sendMessage).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });
});
