// Each icon is an SVG path string for a 24x24 viewBox
export const icons: Record<string, string> = {
  // Nav cluster (pan = move viewport)
  pan_up: 'M12 4l-6 6h4v8h4v-8h4l-6-6z',
  pan_down: 'M12 20l6-6h-4V6h-4v8H6l6 6z',
  pan_left: 'M4 12l6-6v4h8v4h-8v4l-6-6z',
  pan_right: 'M20 12l-6-6v4H6v4h8v4l6-6z',
  fit_to_screen: 'M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm18 0v6h-6v-2h4v-4h2z',

  // Zoom pair
  zoom_in: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2V7z',
  zoom_out: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7V9z',

  // Action cluster
  visualize: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z',
  cycle_viz_type: 'M12 6V2L7 7l5 5V8c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  export: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  toggle_auto_send: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',

  // Placement toggle
  placement: 'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z',

  // Viz type indicators
  viz_graph: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 14a2 2 0 110-4 2 2 0 010 4zm4-4a2 2 0 110-4 2 2 0 010 4zm2-6a2 2 0 110-4 2 2 0 010 4z',
  viz_tree: 'M12 2L6 8h3v4H6l6 6 6-6h-3V8h3L12 2z',
  viz_flowchart: 'M4 6h16v4H4V6zm2 6h12v4H6v-4zm4 6h4v4h-4v-4z',
  viz_hierarchy: 'M3 3h18v4H3V3zm2 6h14v4H5V9zm4 6h6v4H9v-4z'
};

// Key label for each action
export const keyLabels: Record<string, string> = {
  pan_up: 'W',
  pan_down: 'S',
  pan_left: 'A',
  pan_right: 'D',
  fit_to_screen: '\u2423',
  zoom_in: 'Z',
  zoom_out: 'X',
  visualize: '\u21B5',
  cycle_viz_type: '\u21E5',
  export: 'P',
  toggle_auto_send: 'Q'
};
