import { describe, it, expect } from 'vitest';
import {
  routeKeyDown,
  shouldProcessKeyUp,
  shouldAutoEnterInputMode,
  type InputModeState,
} from './input-mode';

function state(overrides: Partial<InputModeState> = {}): InputModeState {
  return { inputMode: false, helpVisible: false, fileListVisible: false, ...overrides };
}

describe('routeKeyDown', () => {
  describe('command mode (default)', () => {
    it('passes through regular keys to command handler', () => {
      expect(routeKeyDown('w', state())).toEqual({ action: 'passthrough' });
      expect(routeKeyDown('a', state())).toEqual({ action: 'passthrough' });
      expect(routeKeyDown('Escape', state())).toEqual({ action: 'passthrough' });
      expect(routeKeyDown('?', state())).toEqual({ action: 'passthrough' });
    });

    it('enters input mode on "i"', () => {
      expect(routeKeyDown('i', state())).toEqual({ action: 'enter_input_mode' });
    });

    it('enters input mode on "I" (case-insensitive)', () => {
      expect(routeKeyDown('I', state())).toEqual({ action: 'enter_input_mode' });
    });
  });

  describe('input mode', () => {
    const inputState = state({ inputMode: true });

    it('blocks all movement keys', () => {
      for (const key of ['w', 'a', 's', 'd', 'z', 'x']) {
        expect(routeKeyDown(key, inputState)).toEqual({ action: 'blocked' });
      }
    });

    it('blocks dial face keys', () => {
      for (const key of ['o', ';', '.', ',', 'm', 'k', 'l']) {
        expect(routeKeyDown(key, inputState)).toEqual({ action: 'blocked' });
      }
    });

    it('blocks number keys', () => {
      for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
        expect(routeKeyDown(key, inputState)).toEqual({ action: 'blocked' });
      }
    });

    it('blocks help toggle', () => {
      expect(routeKeyDown('?', inputState)).toEqual({ action: 'blocked' });
    });

    it('blocks fullscreen and other shortcuts', () => {
      expect(routeKeyDown('f', inputState)).toEqual({ action: 'blocked' });
      expect(routeKeyDown('h', inputState)).toEqual({ action: 'blocked' });
      expect(routeKeyDown('c', inputState)).toEqual({ action: 'blocked' });
    });

    it('exits input mode on Escape', () => {
      expect(routeKeyDown('Escape', inputState)).toEqual({ action: 'exit_input_mode' });
    });

    it('blocks Shift (no camera mode toggle)', () => {
      expect(routeKeyDown('Shift', inputState)).toEqual({ action: 'blocked' });
    });
  });

  describe('help visible', () => {
    const helpState = state({ helpVisible: true });

    it('closes help on Escape', () => {
      expect(routeKeyDown('Escape', helpState)).toEqual({ action: 'close_help' });
    });

    it('blocks all other keys', () => {
      for (const key of ['w', 'a', 's', 'd', 'i', '?', 'f', 'h']) {
        expect(routeKeyDown(key, helpState)).toEqual({ action: 'blocked' });
      }
    });

    it('help takes priority over input mode', () => {
      const both = state({ helpVisible: true, inputMode: true });
      expect(routeKeyDown('Escape', both)).toEqual({ action: 'close_help' });
    });
  });

  describe('file list visible', () => {
    const fileListState = state({ fileListVisible: true });

    it('closes file list on Escape', () => {
      expect(routeKeyDown('Escape', fileListState)).toEqual({ action: 'close_file_list' });
    });

    it('blocks all other keys', () => {
      for (const key of ['w', 'a', 's', 'd', 'i', '?', 'f']) {
        expect(routeKeyDown(key, fileListState)).toEqual({ action: 'blocked' });
      }
    });
  });
});

describe('shouldProcessKeyUp', () => {
  it('allows key-up in command mode', () => {
    expect(shouldProcessKeyUp(state())).toBe(true);
  });

  it('suppresses key-up in input mode', () => {
    expect(shouldProcessKeyUp(state({ inputMode: true }))).toBe(false);
  });
});

describe('shouldAutoEnterInputMode', () => {
  it('returns true for INPUT elements', () => {
    const input = document.createElement('input');
    expect(shouldAutoEnterInputMode(input)).toBe(true);
  });

  it('returns true for TEXTAREA elements', () => {
    const textarea = document.createElement('textarea');
    expect(shouldAutoEnterInputMode(textarea)).toBe(true);
  });

  it('returns true for contenteditable elements (e.g. CodeMirror)', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(shouldAutoEnterInputMode(div)).toBe(true);
  });

  it('returns false for non-contenteditable elements', () => {
    const div = document.createElement('div');
    const button = document.createElement('button');
    const span = document.createElement('span');
    expect(shouldAutoEnterInputMode(div)).toBe(false);
    expect(shouldAutoEnterInputMode(button)).toBe(false);
    expect(shouldAutoEnterInputMode(span)).toBe(false);
  });

  it('returns false for null target', () => {
    expect(shouldAutoEnterInputMode(null)).toBe(false);
  });
});
