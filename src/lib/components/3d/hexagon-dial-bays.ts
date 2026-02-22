import type { HexBayConfig } from './hexagon-dial.types';

export const SCENE_BAY: HexBayConfig = {
  id: 'scene',
  label: 'Scene',
  centerIconPath: 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z',
  tint: {
    accent: '#6ab4dc',
    border: '#4a82a8',
    activeBg: 'rgba(74, 130, 168, 0.18)',
    hoverBg: 'rgba(74, 130, 168, 0.10)',
    glow: 'rgba(106, 180, 220, 0.4)',
  },
  faces: [
    {
      id: 'scenes',
      label: 'Scenes',
      isToggle: false,
      options: [
        { id: 'new', label: 'New' },
        { id: 'clone', label: 'Clone' },
        { id: 'list', label: 'List' },
      ],
      // Folder/file icon
      iconPath:
        'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
    },
    {
      id: 'theme',
      label: 'Theme',
      isToggle: false,
      options: [
        { id: 'system', label: 'System' },
        { id: 'light', label: 'Light' },
        { id: 'dark', label: 'Dark' },
      ],
      iconPath: 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z',
    },
    {
      id: 'status',
      label: 'Status',
      isToggle: false,
      options: [
        { id: 'fps', label: 'FPS' },
        { id: 'mode', label: 'Mode' },
        { id: 'movement', label: 'Movement' },
        { id: 'filename', label: 'File' },
        { id: 'bar', label: 'Bar' },
      ],
      // Monitor/stats icon
      iconPath:
        'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
    },
    {
      id: 'settings',
      label: 'Settings',
      isToggle: true,
      options: [],
      // Gear icon
      iconPath:
        'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.61 3.61 0 0112 15.6z',
    },
    {
      id: 'camera',
      label: 'Camera',
      isToggle: false,
      options: [
        { id: 'orbit', label: 'Orbit' },
        { id: 'fly', label: 'Fly' },
        { id: 'follow', label: 'Follow' },
      ],
      iconPath:
        'M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z',
    },
    {
      id: 'effects',
      label: 'Effects',
      isToggle: false,
      options: [
        { id: 'none', label: 'None' },
        { id: 'bloom', label: 'Bloom' },
        { id: 'dof', label: 'DoF' },
      ],
      iconPath:
        'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z',
    },
  ],
};

export const APP_BAY: HexBayConfig = {
  id: 'app',
  label: 'App',
  tint: {
    accent: '#7dca8a',
    border: '#5a9960',
    activeBg: 'rgba(90, 153, 96, 0.18)',
    hoverBg: 'rgba(90, 153, 96, 0.10)',
    glow: 'rgba(125, 202, 138, 0.4)',
  },
  // Gear icon
  centerIconPath:
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.61 3.61 0 0112 15.6z',
  faces: [
    {
      id: 'extractor',
      label: 'Extractor',
      isToggle: false,
      options: [
        { id: 'llm', label: 'LLM' },
        { id: 'nlp', label: 'NLP' },
        { id: 'rake', label: 'RAKE' },
        { id: 'semantic', label: 'Semantic' },
      ],
      // Brain icon
      iconPath:
        'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z',
    },
    {
      id: 'viztype',
      label: 'Viz Type',
      isToggle: false,
      options: [
        { id: 'graph', label: 'Graph' },
        { id: 'tree', label: 'Tree' },
        { id: 'flow', label: 'Flow' },
        { id: 'hierarchy', label: 'Hierarchy' },
      ],
      // Chart icon
      iconPath:
        'M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z',
    },
    {
      id: 'export',
      label: 'Export',
      isToggle: false,
      options: [
        { id: 'png', label: 'PNG' },
        { id: 'pdf', label: 'PDF' },
        { id: 'md', label: 'MD' },
      ],
      // Download icon
      iconPath:
        'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    },
    {
      id: 'pipeline',
      label: 'Pipeline',
      isToggle: true,
      options: [],
      // Play/pause icon
      iconPath:
        'M8 5v14l11-7z',
    },
    {
      id: 'refinement',
      label: 'Refine',
      isToggle: true,
      options: [],
      // Tune icon
      iconPath:
        'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
    },
    {
      id: 'layout',
      label: 'Layout',
      isToggle: false,
      options: [
        { id: 'hud', label: 'HUD' },
        { id: 'dock', label: 'Dock' },
        { id: 'embed', label: 'Embed' },
      ],
      // Layout icon
      iconPath:
        'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z',
    },
  ],
};

export const DEFAULT_SELECTIONS: Record<string, string> = {
  // Scene bay
  scenes: 'list',
  theme: 'system',
  status: 'mode',
  settings: '',
  camera: 'orbit',
  effects: 'none',
  // App bay
  extractor: 'llm',
  viztype: 'graph',
  export: 'png',
  pipeline: 'auto',
  refinement: 'on',
  layout: 'hud',
};
