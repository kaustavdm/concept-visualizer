/**
 * Input mode controller for the 3D page.
 *
 * Manages command/input mode state and determines whether keyboard events
 * should be routed to scene controls or passed through to text inputs.
 */

export type InputModeState = {
  inputMode: boolean;
  helpVisible: boolean;
  fileListVisible: boolean;
};

export type KeyRouteResult =
  | { action: 'enter_input_mode' }
  | { action: 'exit_input_mode' }
  | { action: 'close_help' }
  | { action: 'close_file_list' }
  | { action: 'passthrough' }  // key goes to command mode handler
  | { action: 'blocked' };     // key is consumed/ignored

/**
 * Determine how a keydown event should be routed based on current mode state.
 *
 * Priority order:
 * 1. Help visible → only Escape closes it
 * 2. File list visible → only Escape closes it
 * 3. Input mode → only Escape exits it; all else blocked
 * 4. Command mode → 'i' enters input mode; everything else passes through
 */
export function routeKeyDown(key: string, state: InputModeState): KeyRouteResult {
  // Help overlay captures all keys — Escape closes
  if (state.helpVisible) {
    if (key === 'Escape') return { action: 'close_help' };
    return { action: 'blocked' };
  }

  // File list modal captures all keys — Escape closes
  if (state.fileListVisible) {
    if (key === 'Escape') return { action: 'close_file_list' };
    return { action: 'blocked' };
  }

  // Input mode: only Escape exits — all other keys blocked for scene controls
  if (state.inputMode) {
    if (key === 'Escape') return { action: 'exit_input_mode' };
    return { action: 'blocked' };
  }

  // Command mode: 'i' enters input mode
  if (key === 'i' || key === 'I') return { action: 'enter_input_mode' };

  // Everything else passes through to command mode handlers
  return { action: 'passthrough' };
}

/**
 * Determine whether a keyup event should be processed.
 * In input mode, key-up events are suppressed to prevent
 * camera movement side effects from lingering key state.
 */
export function shouldProcessKeyUp(state: InputModeState): boolean {
  return !state.inputMode;
}

/**
 * Determine whether a focusin event on the given element should
 * auto-enter input mode.
 *
 * Matches native text inputs (INPUT, TEXTAREA) and contenteditable
 * elements such as CodeMirror 6 editors (.cm-content).
 */
export function shouldAutoEnterInputMode(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  // CodeMirror 6 uses a contenteditable div with class "cm-content"
  if (target.getAttribute('contenteditable') === 'true') return true;
  return false;
}
