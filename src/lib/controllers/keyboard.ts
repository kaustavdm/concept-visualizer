export type PadAction =
  | 'zoom_in' | 'zoom_out'
  | 'focus_up' | 'focus_down' | 'focus_left' | 'focus_right'
  | 'fit_to_screen'
  | 'pan_up' | 'pan_down' | 'pan_left' | 'pan_right'
  | 'visualize' | 'cycle_viz_type' | 'export' | 'toggle_auto_send'
  | 'deselect';

const KEY_MAP: Record<string, PadAction> = {
  'z': 'zoom_in',
  'x': 'zoom_out',
  'w': 'focus_up',
  'a': 'focus_left',
  's': 'focus_down',
  'd': 'focus_right',
  ' ': 'fit_to_screen',
  'ArrowUp': 'pan_up',
  'ArrowDown': 'pan_down',
  'ArrowLeft': 'pan_left',
  'ArrowRight': 'pan_right',
  'Enter': 'visualize',
  'Tab': 'cycle_viz_type',
  'p': 'export',
  'q': 'toggle_auto_send',
  'Escape': 'deselect'
};

// Actions that should fire only once per press (not repeat)
const DISCRETE_ACTIONS: Set<PadAction> = new Set([
  'fit_to_screen', 'visualize', 'cycle_viz_type',
  'export', 'toggle_auto_send', 'deselect'
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
    const action = KEY_MAP[key];
    if (!action) return;

    // Skip if text input focused (except always-active keys)
    if (options.isTextInputFocused() && !ALWAYS_ACTIVE.has(key)) return;

    // Prevent default for mapped keys
    if (key === 'Tab' || key === ' ') e.preventDefault();

    // For discrete actions, don't repeat on held key
    if (DISCRETE_ACTIONS.has(action) && heldKeys.has(key)) return;

    heldKeys.add(key);
    options.onAction(action);
  }

  function handleKeyUp(e: KeyboardEvent) {
    heldKeys.delete(e.key);
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

  function activeKeys(): Set<string> {
    return new Set(heldKeys);
  }

  return { attach, detach, activeKeys };
}
