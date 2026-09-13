import * as vscode from 'vscode';

/**
 * Asks the user to rate the extension on the Marketplace, once, after
 * a real number of distinct unparameterized SQL query findings flagged -- never on install, never on
 * a timer. Dedup'd by a stable key (file URI + line) rather than a raw
 * invocation count, so re-scanning the same unchanged finding on every
 * file-watcher refresh doesn't inflate the count towards the prompt --
 * mirrors the Kotlin catalog's file:line dedup design.
 *
 * Persisted via `ExtensionContext.globalState` (not workspaceState) --
 * how many times this extension has been used isn't tied to any one
 * workspace, and neither is whether the user already answered.
 *
 * Standard mechanism used catalog-wide since 2026-08-24.
 */

const HITS_BEFORE_PROMPT = 10;
// Caps how many dedup keys persist in globalState -- a churning
// codebase re-triggering thousands of distinct findings shouldn't grow
// this unboundedly. Well above HITS_BEFORE_PROMPT so the cap never
// interferes with reaching the real threshold first.
const MAX_TRACKED_KEYS = 200;

const KEY_SEEN_FINDINGS = 'sqlConcatenationCompanion.review.seenFindings';
const KEY_ANSWERED = 'sqlConcatenationCompanion.review.answered';

// Marketplace only assigns this extension a listing URL once the first
// manual publish goes through -- vendor page is a real, working
// fallback until then, same approach as the rest of the catalog.
const MARKETPLACE_URL = 'https://marketplace.visualstudio.com/publishers/GapHunterLabs';

/**
 * Call this once per real finding reported (e.g. `${uri.toString()}:${line}`).
 * Safe to call repeatedly with the same key or after the user has
 * already answered -- both are no-ops.
 */
export function recordHit(context: vscode.ExtensionContext, findingKey: string): void {
  if (context.globalState.get<boolean>(KEY_ANSWERED, false)) {
    return;
  }

  const seen = context.globalState.get<string[]>(KEY_SEEN_FINDINGS, []);
  if (seen.includes(findingKey)) {
    return;
  }

  const updated = [...seen, findingKey].slice(-MAX_TRACKED_KEYS);
  void context.globalState.update(KEY_SEEN_FINDINGS, updated);

  if (updated.length === HITS_BEFORE_PROMPT) {
    showPrompt(context);
  }
}

function showPrompt(context: vscode.ExtensionContext): void {
  const rateAction = 'Rate on Marketplace';
  const dismissAction = "Don't ask again";

  void vscode.window
    .showInformationMessage(
      `SQL Concatenation Companion: this has flagged ${HITS_BEFORE_PROMPT} real issues in your code -- if it's saved you time, a rating on the Marketplace helps other developers find it.`,
      rateAction,
      dismissAction,
    )
    .then((selection) => {
      if (selection === rateAction) {
        void context.globalState.update(KEY_ANSWERED, true);
        void vscode.env.openExternal(vscode.Uri.parse(MARKETPLACE_URL));
      } else if (selection === dismissAction) {
        void context.globalState.update(KEY_ANSWERED, true);
      }
      // No selection (dismissed by clicking away): leave unanswered so
      // it can prompt again after the next real hit.
    });
}
