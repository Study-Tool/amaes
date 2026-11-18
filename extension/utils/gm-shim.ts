export interface GmXhrDetails {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  data?: string | null;
  responseType?: 'text' | 'json' | 'blob';
  timeout?: number;
  onload?: (res: {
    status: number;
    statusText: string;
    responseText: string;
    response: unknown;
    responseHeaders: string;
    finalUrl: string;
  }) => void;
  onerror?: (err: { status: number; statusText: string; error: string }) => void;
  ontimeout?: () => void;
}

export interface GmApi {
  GM_getValue: (key: string, defaultValue?: unknown) => unknown;
  GM_setValue: (key: string, value: unknown) => void;
  GM_deleteValue: (key: string) => void;
  GM_setClipboard: (text: string) => void;
  GM_notification: (details: { title?: string; text?: string; image?: string } | string) => void;
  GM_xmlhttpRequest: (details: GmXhrDetails) => void;
}

const STORAGE_PREFIX = 'gm_';

export async function createGmApi(): Promise<GmApi> {
  const allStored = await browser.storage.local.get(null);
  const cache = new Map<string, unknown>();

  for (const [k, v] of Object.entries(allStored || {})) {
    if (k.startsWith(STORAGE_PREFIX)) {
      cache.set(k.slice(STORAGE_PREFIX.length), v);
    } else {
      cache.set(k, v);
    }
  }

  return {
    GM_getValue(key: string, defaultValue?: unknown) {
      return cache.has(key) ? cache.get(key) : defaultValue;
    },

    GM_setValue(key: string, value: unknown) {
      cache.set(key, value);
      void browser.storage.local.set({ [key]: value, [`${STORAGE_PREFIX}${key}`]: value });
    },

    GM_deleteValue(key: string) {
      cache.delete(key);
      void browser.storage.local.remove([key, `${STORAGE_PREFIX}${key}`]);
    },

    GM_setClipboard(text: string) {
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(text).catch(() => {
          fallbackCopy(text);
        });
      } else {
        fallbackCopy(text);
      }
    },

    GM_notification(details) {
      const payload =
        typeof details === 'string'
          ? { title: 'AMAES Toolkit', text: details }
          : { title: details.title || 'AMAES Toolkit', text: details.text || '' };
      void browser.runtime.sendMessage({ type: 'EXT_NOTIFY', ...payload }).catch(() => {});
    },

    GM_xmlhttpRequest(details: GmXhrDetails) {
      void browser.runtime
        .sendMessage({
          type: 'GM_XHR',
          url: details.url,
          method: details.method || 'GET',
          headers: details.headers || {},
          data: details.data ?? null,
          timeout: details.timeout || 15000,
          responseType: details.responseType || 'text',
        })
        .then((res: unknown) => {
          const r = res as {
            ok?: boolean;
            timedOut?: boolean;
            status?: number;
            statusText?: string;
            responseText?: string;
            responseHeaders?: string;
            finalUrl?: string;
            error?: string;
          };
          if (!r || r.timedOut) {
            details.ontimeout?.();
            return;
          }
          if (r.error && !r.status) {
            details.onerror?.({
              status: 0,
              statusText: r.error,
              error: r.error,
            });
            return;
          }
          details.onload?.({
            status: r.status ?? 0,
            statusText: r.statusText ?? '',
            responseText: r.responseText ?? '',
            response: r.responseText ?? '',
            responseHeaders: r.responseHeaders ?? '',
            finalUrl: r.finalUrl ?? details.url,
          });
        })
        .catch((err) => {
          details.onerror?.({
            status: 0,
            statusText: String(err?.message || err),
            error: String(err?.message || err),
          });
        });
    },
  };
}

function fallbackCopy(text: string) {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body?.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  } catch {
    // Ignore clipboard fallback failure in non-DOM contexts.
  }
}
