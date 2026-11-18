import { API_BASE_URL, getDynamicConfig } from '../utils/config';
import type { RelayFetchRequest, RelayFetchResponse } from '../utils/api';

const CONFIG_ALARM_NAME = 'amaes-refresh-config';

interface GmXhrMessage {
  type: 'GM_XHR';
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: string | null;
  timeout?: number;
}

interface ExtNotifyMessage {
  type: 'EXT_NOTIFY';
  title?: string;
  text?: string;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void getDynamicConfig(browser.storage.local, fetch, Date.now(), true);
    browser.alarms.create(CONFIG_ALARM_NAME, { periodInMinutes: 360 });
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CONFIG_ALARM_NAME) {
      void getDynamicConfig(browser.storage.local, fetch, Date.now(), true);
    }
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!message || typeof message !== 'object') return;
    const msg = message as { type?: string; forceRefresh?: boolean };

    if (msg.type === 'GET_DYNAMIC_CONFIG') {
      return getDynamicConfig(
        browser.storage.local,
        fetch,
        Date.now(),
        Boolean(msg.forceRefresh),
      )
        .then((config) => ({ ok: true, config }))
        .catch((err) => ({ ok: false, error: String(err?.message || err) }));
    }

    if (msg.type === 'RELAY_FETCH') {
      const req = message as RelayFetchRequest;
      const normalizedPath = req.path.startsWith('/') ? req.path : `/${req.path}`;
      const url = `${API_BASE_URL}${normalizedPath}`;
      return fetch(url, {
        method: req.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-AMAES-Client-Version': browser.runtime.getManifest().version,
          ...(req.headers || {}),
        },
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      })
        .then(async (res): Promise<RelayFetchResponse> => {
          const text = await res.text();
          let data: unknown = text;
          try {
            data = JSON.parse(text);
          } catch {
            // Keep raw text if response is non-JSON.
          }
          return { ok: res.ok, status: res.status, data };
        })
        .catch((err): RelayFetchResponse => ({
          ok: false,
          status: 0,
          data: null,
          error: String(err?.message || err),
        }));
    }

    if (msg.type === 'GM_XHR') {
      const req = message as GmXhrMessage;
      const method = (req.method || 'GET').toUpperCase();
      const timeoutMs = Number(req.timeout) > 0 ? Number(req.timeout) : 15000;
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const cleanHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers || {})) {
        if (k.toLowerCase() === 'cache-control' || k.toLowerCase() === 'pragma') {
          cleanHeaders[k] = v;
        } else {
          cleanHeaders[k] = v;
        }
      }

      return fetch(req.url, {
        method,
        headers: cleanHeaders,
        body: method !== 'GET' && method !== 'HEAD' && req.data != null ? req.data : undefined,
        signal: controller.signal,
      })
        .then(async (res) => {
          clearTimeout(timer);
          const responseText = await res.text();
          const headerLines: string[] = [];
          res.headers.forEach((value, key) => {
            headerLines.push(`${key}: ${value}`);
          });
          return {
            ok: res.ok,
            timedOut: false,
            status: res.status,
            statusText: res.statusText,
            responseText,
            responseHeaders: headerLines.join('\r\n'),
            finalUrl: res.url || req.url,
          };
        })
        .catch((err) => {
          clearTimeout(timer);
          return {
            ok: false,
            timedOut,
            status: 0,
            statusText: String(err?.message || err),
            responseText: '',
            responseHeaders: '',
            finalUrl: req.url,
            error: String(err?.message || err),
          };
        });
    }

    if (msg.type === 'EXT_NOTIFY') {
      const note = message as ExtNotifyMessage;
      if (browser.notifications?.create) {
        void browser.notifications
          .create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('/icon/128.png'),
            title: note.title || 'AMAES Toolkit',
            message: note.text || '',
          })
          .catch(() => {});
      }
      return Promise.resolve({ ok: true });
    }

    return;
  });
});
