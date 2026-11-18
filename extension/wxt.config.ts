import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'AMAES Toolkit',
    description:
      'Universal Study Toolkit for AMA Online Education (AMAOEd / AMAES) Moodle portals.',
    version: '0.1.2',
    author: 'Study-Tool Maintainers',
    homepage_url: 'https://study-tool-amaes.pages.dev/',
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    permissions: ['storage', 'alarms', 'notifications'],
    web_accessible_resources: [
      {
        resources: ['icon/*.png'],
        matches: [
          'https://semestral.amaes.com/*',
          'https://semestralexam.amaes.com/*',
        ],
      },
    ],
    host_permissions: [
      'https://semestral.amaes.com/*',
      'https://semestralexam.amaes.com/*',
      'https://study-tool-amaes.pages.dev/*',
      'https://amaes-community-relay.study-tool-amaes-relay.workers.dev/*',
      'https://raw.githubusercontent.com/*',
      'https://amauoed.com/*',
      'https://*.amauoed.com/*',
      'https://jennysonline.blogspot.com/*',
      'https://docs.google.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.typesafe.ai/*',
    ],
    browser_specific_settings: {
      gecko: {
        id: 'amaes-toolkit@study-tool.org',
        strict_min_version: '109.0',
        update_url: 'https://study-tool-amaes.pages.dev/updates.json',
      },
    },
  },
});
