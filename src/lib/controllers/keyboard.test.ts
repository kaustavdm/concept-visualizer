import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createKeyboardController, type PadAction } from './keyboard';

describe('KeyboardController', () => {
  let controller: ReturnType<typeof createKeyboardController>;
  let actions: PadAction[];

  beforeEach(() => {
    actions = [];
    controller = createKeyboardController({
      onAction: (action) => actions.push(action),
      isTextInputFocused: () => false
    });
    controller.attach();
  });

  afterEach(() => {
    controller.detach();
  });

  function press(key: string) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  }

  function release(key: string) {
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  }

  it('should map Z to zoom_in', () => {
    press('z');
    expect(actions).toContain('zoom_in');
  });

  it('should map X to zoom_out', () => {
    press('x');
    expect(actions).toContain('zoom_out');
  });

  it('should map w/a/s/d to pan', () => {
    press('w');
    press('a');
    press('s');
    press('d');
    expect(actions).toEqual(['pan_up', 'pan_left', 'pan_down', 'pan_right']);
  });

  it('should map Space to fit_to_screen', () => {
    press(' ');
    expect(actions).toContain('fit_to_screen');
  });

  it('should map Enter to visualize', () => {
    press('Enter');
    expect(actions).toContain('visualize');
  });

  it('should map Tab to cycle_viz_type', () => {
    press('Tab');
    expect(actions).toContain('cycle_viz_type');
  });

  it('should map q to toggle_auto_send', () => {
    press('q');
    expect(actions).toContain('toggle_auto_send');
  });

  it('should map Escape to deselect', () => {
    press('Escape');
    expect(actions).toContain('deselect');
  });

  it('should map arrow keys to focus navigation', () => {
    press('ArrowUp');
    press('ArrowDown');
    press('ArrowLeft');
    press('ArrowRight');
    expect(actions).toEqual(['focus_up', 'focus_down', 'focus_left', 'focus_right']);
  });

  it('should not fire when text input is focused', () => {
    controller.detach();
    controller = createKeyboardController({
      onAction: (action) => actions.push(action),
      isTextInputFocused: () => true
    });
    controller.attach();

    press('z');
    // Only Escape should work when text is focused
    expect(actions).not.toContain('zoom_in');
  });

});
