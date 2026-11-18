import { DEFAULT_REMOTE_CONFIG, type RemoteConfig } from '../../utils/config';

function applyConfigToUi(config: RemoteConfig) {
  const versionBadge = document.getElementById('version-badge');
  if (versionBadge) {
    versionBadge.textContent = `v${browser.runtime.getManifest().version}`;
  }

  const bindLink = (id: string, url: string) => {
    const el = document.getElementById(id) as HTMLAnchorElement | null;
    if (!el) return;
    if (url) {
      el.href = url;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  };

  bindLink('link-homepage', config.links.homepage);
  bindLink('link-database', config.links.database);
  bindLink('link-support', config.links.support);
  bindLink('link-repo', config.links.repo);
  bindLink('link-mirror', config.links.mirror);

  const announcementBox = document.getElementById('announcement-box');
  if (announcementBox) {
    if (config.announcement) {
      announcementBox.textContent = config.announcement;
      announcementBox.classList.remove('hidden');
    } else {
      announcementBox.classList.add('hidden');
    }
  }
}

async function loadConfig(forceRefresh = false) {
  const statusEl = document.getElementById('status-text');
  if (statusEl) statusEl.textContent = forceRefresh ? 'Refreshing...' : 'Loading...';

  try {
    const res = (await browser.runtime.sendMessage({
      type: 'GET_DYNAMIC_CONFIG',
      forceRefresh,
    })) as { ok?: boolean; config?: RemoteConfig };
    applyConfigToUi(res?.config || DEFAULT_REMOTE_CONFIG);
    if (statusEl) statusEl.textContent = 'Synced';
  } catch {
    applyConfigToUi(DEFAULT_REMOTE_CONFIG);
    if (statusEl) statusEl.textContent = 'Offline defaults';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyConfigToUi(DEFAULT_REMOTE_CONFIG);
  void loadConfig(false);

  const refreshBtn = document.getElementById('refresh-config-btn');
  refreshBtn?.addEventListener('click', () => {
    void loadConfig(true);
  });
});
