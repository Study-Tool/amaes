#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const EXT_DIR = path.resolve(import.meta.dirname, '..');
const LEGACY_SRC_DIR = path.join(EXT_DIR, 'toolkit-src');
const OUT_FILE = path.join(EXT_DIR, 'utils', 'toolkit-bundle.js');

const BUILD_MANIFEST = [
  'core/config.js',
  'sync/updater.js',
  'ui/icons.js',
  'ui/theme.js',
  'moodle/detector.js',
  'sync/amauoed.js',
  'sync/jennysonline.js',
  'quiz/solver.js',
  'moodle/highlighter.js',
  'moodle/account-switcher.js',
  'moodle/account-transfer.js',
  'dev/diagnostics.js',
  'ai/prompts.js',
  'ai/jev.js',
  'ai/gemini.js',
  'sync/harvester.js',
  'dev/console.js',
  'ui/modals.js',
  'ui/panel.js',
  'quiz/events.js',
  'init.js',
];

const RELAY_URL = 'https://amaes-community-relay.study-tool-amaes-relay.workers.dev';
const PORTAL_URL = 'https://study-tool-amaes.pages.dev/';

let raw = '';
for (const rel of BUILD_MANIFEST) {
  const full = path.join(LEGACY_SRC_DIR, rel);
  if (!fs.existsSync(full)) {
    console.error(`Missing source module: ${full}`);
    process.exit(1);
  }
  raw += `\n// --- ${rel} ---\n` + fs.readFileSync(full, 'utf8');
}

// Strip legacy IIFE wrapper so we can inject the extension GM shim cleanly.
raw = raw.replace(/\/\/ --- core\/config\.js ---\s*\(function \(\) \{\s*'use strict';/, '// --- core/config.js ---');
raw = raw.replace(/\}\)\(\);\s*$/, '');

// Rewrite legacy URLs, version, and portal detection for the Study-Tool + Cloudflare deployment.
raw = raw
  .replace(/const SCRIPT_VERSION = "[^"]+";/, 'const SCRIPT_VERSION = "v0.1.0";')
  .replace(/https:\/\/amaes-community-relay\.acads-tools\.workers\.dev/g, RELAY_URL)
  .replace(/https:\/\/raw\.githubusercontent\.com\/Acads-Tools\/database\//g, 'https://raw.githubusercontent.com/Study-Tool/database/')
  .replace(/https:\/\/raw\.githubusercontent\.com\/Acads-Tools\/amaes-toolkit\/main\/amaes-toolkit\.user\.js/g, `${PORTAL_URL}#install-step`)
  .replace(/https:\/\/raw\.githubusercontent\.com\/Acads-Tools\/amaes-toolkit\/main\/assets\/amaes-toolkit-logo\.png/g, `${PORTAL_URL}assets/amaes-toolkit-logo.png`)
  .replace(/https:\/\/github\.com\/Acads-Tools\/amaes-toolkit/g, 'https://github.com/Study-Tool/amaes')
  .replace(/https:\/\/github\.com\/Acads-Tools\/database/g, 'https://github.com/Study-Tool/database')
  .replace(/https:\/\/amaestoolkit\.pages\.dev\//g, PORTAL_URL)
  .replace(/amaestoolkit\.pages\.dev/g, 'study-tool-amaes.pages.dev')
  .replace(/acads-tools\.github\.io/g, 'study-tool-amaes.pages.dev')
  .replace(
    /storedCloudDbUrl = storedCloudDbUrl\.replace\('lms-study-hub', 'Acads-Tools'\);/g,
    "storedCloudDbUrl = storedCloudDbUrl.replace('lms-study-hub', 'Study-Tool').replace('Acads-Tools', 'Study-Tool');",
  )
  .replace(
    /if \(storedRelayUrl && \(!storedRelayUrl\.includes\('acads-tools\.workers\.dev'\) \|\| storedRelayUrl === 'https:\/\/amaes-community-relay\.workers\.dev'\)\)/g,
    "if (storedRelayUrl && (!storedRelayUrl.includes('study-tool-amaes-relay.workers.dev') || storedRelayUrl === 'https://amaes-community-relay.workers.dev'))",
  )
  .replace(/Acads-Tools/g, 'Study-Tool')
  .replace(/acads-tools/g, 'study-tool')
  .replace(
    /\(window\.location\.hostname === 'study-tool-amaes\.pages\.dev' && window\.location\.pathname\.startsWith\('\/amaes-toolkit'\)\)/g,
    "window.location.hostname === 'study-tool-amaes.pages.dev'",
  )
  .replace(
    /const apiUrl = `https:\/\/api\.github\.com\/repos\/Study-Tool\/amaes\/releases\/latest\?_t=\$\{now\}`;/,
    `const apiUrl = \`\${COMMUNITY_RELAY_URL}/v1/config?_t=\${now}\`;`,
  )
  .replace(/data && data\.tag_name/g, 'data && data.latestVersion')
  .replace(/normalizeVersion\(data\.tag_name\)/g, 'normalizeVersion(data.latestVersion)');

const wrapped = `/* Auto-generated from amaes-toolkit-privacy-fix/src by scripts/build-toolkit-bundle.mjs */
export function bootToolkit(gmApi) {
  'use strict';
  const {
    GM_getValue,
    GM_setValue,
    GM_deleteValue,
    GM_setClipboard,
    GM_notification,
    GM_xmlhttpRequest,
  } = gmApi;
${raw}
}
`;

fs.writeFileSync(OUT_FILE, wrapped, 'utf8');
execSync(`node -c "${OUT_FILE}"`, { stdio: 'inherit' });
console.log(`Built extension toolkit bundle: ${OUT_FILE} (${(Buffer.byteLength(wrapped, 'utf8') / 1024).toFixed(1)} KB)`);
