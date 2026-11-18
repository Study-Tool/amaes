import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'AMAES Toolkit',
    description:
      'Universal Study Toolkit for AMA Online Education (AMAOEd / AMAES) Moodle portals.',
    version: '0.1.0',
    author: 'Study-Tool Maintainers',
    homepage_url: 'https://study-tool-amaes.pages.dev/',
    permissions: ['storage', 'alarms', 'notifications'],
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
