export type PadAction =
  | 'zoom_in' | 'zoom_out'
  | 'focus_up' | 'focus_down' | 'focus_left' | 'focus_right'
  | 'fit_to_screen'
  | 'pan_up' | 'pan_down' | 'pan_left' | 'pan_right'
  | 'visualize' | 'cycle_viz_type' | 'cycle_engine' | 'toggle_auto_send'
  | 'deselect';

const KEY_MAP: Record<string, PadAction> = {
  'z': 'zoom_in',
  'x': 'zoom_out',
  'w': 'pan_up',
  'a': 'pan_left',
  's': 'pan_down',
  'd': 'pan_right',
  ' ': 'fit_to_screen',
  'ArrowUp': 'focus_up',
  'ArrowDown': 'focus_down',
  'ArrowLeft': 'focus_left',
  'ArrowRight': 'focus_right',
  'Enter': 'visualize',
  'Tab': 'cycle_viz_type',
  'q': 'toggle_auto_send',
  'Escape': 'deselect'
};

// Actions that should fire only once per press (not repeat)
const DISCRETE_ACTIONS: Set<PadAction> = new Set([
  'fit_to_screen', 'visualize', 'cycle_viz_type', 'cycle_engine',
  'toggle_auto_send', 'deselect'
]);

// Keys that work even when text input is focused
const ALWAYS_ACTIVE: Set<string> = new Set(['Escape']);

interface KeyboardControllerOptions {
  onAction: (action: PadAction) => void;
  isTextInputFocused: () => boolean;
}

export function createKeyboardController(options: KeyboardControllerOptions) {
  const heldKeys = new Set<string>();

  function handleKeyDown(e: KeyboardEvent) {
    const key = e.key;

    // Shift+Tab: cycle engine (before main KEY_MAP lookup)
    if (e.shiftKey && key === 'Tab') {
      if (options.isTextInputFocused()) return;
      e.preventDefault();
      if (!heldKeys.has('Shift+Tab')) {
        heldKeys.add('Shift+Tab');
        options.onAction('cycle_engine');
      }
      return;
    }

    const action = KEY_MAP[key];
    if (!action) return;

    // Skip if text input focused (except always-active keys)
    if (options.isTextInputFocused() && !ALWAYS_ACTIVE.has(key)) return;

    // Prevent default for mapped keys
    if (key === 'Tab' || key === ' ' || key.startsWith('Arrow')) e.preventDefault();

    // For discrete actions, don't repeat on held key
    if (DISCRETE_ACTIONS.has(action) && heldKeys.has(key)) return;

    heldKeys.add(key);
    options.onAction(action);
  }

  function handleKeyUp(e: KeyboardEvent) {
    heldKeys.delete(e.key);
    // Clean up Shift+Tab composite key when either key is released
    if (e.key === 'Tab' || e.key === 'Shift') {
      heldKeys.delete('Shift+Tab');
    }
  }

  function attach() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
  }

  function detach() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    heldKeys.clear();
  }

  return { attach, detach };
}
