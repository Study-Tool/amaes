export interface RelayFetchRequest {
  type: 'RELAY_FETCH';
  path: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RelayFetchResponse {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

export async function relayFetch(
  path: string,
  options: Omit<RelayFetchRequest, 'type' | 'path'> = {},
): Promise<RelayFetchResponse> {
  return browser.runtime.sendMessage({
    type: 'RELAY_FETCH',
    path,
    ...options,
  });
}
