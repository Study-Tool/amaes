import type { StorageLike } from './config';

export const MIGRATION_DONE_KEY = 'amaes_userscript_migrated_v2';

export const LEGACY_SHARED_KEYS = [
  'amaes_terms_acknowledged',
  'amaes_welcome_dismissed',
  'amaes_gemini_api_key',
  'amaes_gemini_api_keys',
  'amaes_jev_api_key',
  'amaes_jev_endpoint',
  'amaes_jev_enabled',
  'amaes_shared_ai_fallback_enabled',
  'amaes_ai_quiz_enabled',
  'amaes_ai_auto_select',
  'amaes_ai_retry_count',
  'amaes_ai_auto_copy_on_fail',
  'amaes_ai_auto_next_on_ai',
  'amaes_ai_plan_tier',
  'amaes_auto_quiz_mode',
  'amaes_quiz_personality',
  'amaes_auto_pick_quiz',
  'amaes_auto_next_quiz',
  'amaes_auto_next_verified',
  'amaes_auto_pick_study_guide_fallback',
  'amaes_auto_submit_quiz',
  'amaes_auto_push_github',
  'amaes_auto_copy_search',
  'amaes_auto_cloud_sync',
  'amaes_auto_scrape_amauoed',
  'amaes_auto_harvest_grades',
  'amaes_enable_hotkeys',
  'amaes_skip_passed_quizzes',
  'amaes_auto_close_course_index',
  'amaes_auto_highlight_quiz',
  'amaes_copy_include_confidence',
  'amaes_auto_copy_ai',
  'amaes_smart_skip_quiz',
  'amaes_show_in_question_ai_btns',
  'amaes_ai_prompt_hint',
  'amaes_auto_community_share',
  'amaes_auto_min_quiz',
  'amaes_theme',
  'amaes_toolkit_theme',
  'amaes_active_tab',
  'amaes_auto_submit_delay',
  'amaes_fast_quiz_mode',
  'amaes_adaptive_probe_quiz',
  'amaes_adaptive_probe_budget',
  'amaes_auto_mark_done_100',
  'amaes_enable_audio_alerts',
  'amaes_pref_minimized',
  'amaes_pref_show_logs',
  'amaes_preferred_web_ai',
  'amaes_anon_install_id',
  'amaes_anonymous_contributor_id',
] as const;

export interface LocalStorageLike {
  getItem(key: string): string | null;
  removeItem?(key: string): void;
  length?: number;
  key?(index: number): string | null;
}

export interface MigrationResult {
  migrated: boolean;
  importedKeys: string[];
}

/**
 * One-time migration bridge from legacy userscript localStorage keys
 * (including cached answer banks) into extension storage.local.
 */
export async function migrateLegacyUserscriptStorage(
  extStorage: StorageLike,
  pageStorage: LocalStorageLike,
): Promise<MigrationResult> {
  // Always clear stale legacy *.workers.dev relay overrides so existing users route to the active relay.
  const staleRelay = pageStorage.getItem('amaes_community_relay_url');
  if (
    staleRelay &&
    staleRelay.includes('workers.dev') &&
    !staleRelay.includes('study-tool-amaes-relay.workers.dev')
  ) {
    pageStorage.removeItem?.('amaes_community_relay_url');
  }

  const marker = await extStorage.get(MIGRATION_DONE_KEY);
  if (marker[MIGRATION_DONE_KEY] === true) {
    return { migrated: false, importedKeys: [] };
  }

  const keysToImport = new Set<string>(LEGACY_SHARED_KEYS);
  if (typeof pageStorage.length === 'number' && typeof pageStorage.key === 'function') {
    for (let i = 0; i < pageStorage.length; i += 1) {
      const k = pageStorage.key(i);
      if (k && k.startsWith('amaes_answer_db_')) {
        keysToImport.add(k);
      }
    }
  }

  const imported: Record<string, string> = {};
  const importedKeys: string[] = [];

  for (const key of keysToImport) {
    const legacyValue = pageStorage.getItem(key);
    if (legacyValue === null || legacyValue === '') continue;
    const existing = await extStorage.get(key);
    if (existing[key] !== undefined) continue;
    imported[key] = legacyValue;
    importedKeys.push(key);
  }

  await extStorage.set({
    ...imported,
    [MIGRATION_DONE_KEY]: true,
  });

  return { migrated: true, importedKeys };
}
