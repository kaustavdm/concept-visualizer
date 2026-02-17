# Concept Visualizer UI/UX Design

**Date:** 2026-02-17

## Philosophy

The interface is a minimal, gamepad-inspired control surface where every visible control maps 1:1 to a keyboard shortcut. Controls are the single unified interface for all app interactions beyond text editing. The aesthetic adapts to content -- neutral translucent controls over a palette that shifts with visualization type.

## Control System: Two-Cluster Pad + Zoom Pair

```
  LEFT SIDE                                RIGHT SIDE

  +-- Nav Cluster --+                    +-- Action Cluster -+
  |      [W]        |                    |     [Enter]       |
  |   [A] [_] [D]   |                   |  [Tab]  *  [P]    |
  |      [S]        |                    |      [Q]          |
  +------------------+                   +-------------------+

  +-- Zoom Pair -+
  |  [Z]   [X]  |
  +---------------+
```

11 total buttons + 1 indicator, split across 3 groups:

| Group | Buttons | Keys | Purpose |
|---|---|---|---|
| Nav cluster | W, A, S, D, Space | W A S D Space | Node focus traversal + fit/reset |
| Zoom pair | Z, X | Z X | Zoom in/out + detail depth |
| Action cluster | Enter, Tab, P, Q + indicator | Enter Tab P Q | Visualize, type switch, export, auto-send |

Arrow keys pan the canvas (keyboard-only, no pad representation). Mouse drag also pans.

## Input Mapping

| Key | Pad Button | Action | Continuous |
|---|---|---|---|
| W | Nav top | Focus node above / prev rank | Yes |
| A | Nav left | Focus prev sibling/neighbor | Yes |
| S | Nav bottom | Focus node below / next rank | Yes |
| D | Nav right | Focus next sibling/neighbor | Yes |
| Space | Nav center | Fit to screen / reset view | No |
| Z | Zoom left | Zoom in + increase detail | Yes |
| X | Zoom right | Zoom out + decrease detail | Yes |
| Enter | Action top | Visualize / regenerate | No |
| Tab | Action left | Cycle viz type forward | No |
| P | Action right | Open export menu | No |
| Q | Action bottom | Toggle auto-send | No |
| Esc | (no button) | Deselect / close menus | No |
| Arrow keys | (no button) | Pan canvas viewport | Yes |

Visual feedback: Every key press lights up its corresponding pad button in the accent color. Continuous keys hold the active state while pressed.

## Focus + Depth Feedback Loop

Each visualization type tells a different story about the same concepts:

- **Graph**: "How things relate" -- interconnected, many-to-many
- **Tree**: "How things descend" -- hierarchical, parent-child
- **Flowchart**: "How things proceed" -- sequential, cause-and-effect
- **Hierarchy**: "How things classify" -- taxonomic, categorical

The concept details pane reacts to both node focus and zoom level:

| Interaction | Concept Details Pane Response |
|---|---|
| Click/WASD focus a node | Shows node's label, details, direct relationships, connected neighbors. Other concepts fade. |
| Zoom in (Z) | Details pane shows more granular info for visible nodes |
| Zoom out (X) | Details pane collapses to high-level summary + top concepts |
| Switch viz type (Tab) | Relationships reorder to match the story: sequential for flowchart, nested for hierarchy, associative for graph |
| Fit/reset (Space) | Details pane returns to full overview |

## Placement Modes

User-configurable via a toggle button on the pad. Persisted in AppSettings.

### Mode 1: Floating HUD (default)

Controls float in the bottom-left (nav + zoom) and bottom-right (actions) corners of the viz canvas. Glass-morphism background, semi-transparent. Fades to ~40% opacity when idle, full opacity on hover or any key press. Canvas is slightly occluded at corners.

### Mode 2: Bottom Dock

Thin horizontal bar (~56px) below the viz canvas, spanning its width. Left side: nav + zoom clusters inline. Right side: action cluster inline. Always visible, no fade behavior. Canvas is fully clean.

### Mode 3: Embedded in Editor

Controls sit inside the editor pane, between concept details and the text editor. Compact grid layout. Canvas is fully clean. Best for users who want an uncluttered visualization view.

## Adaptive Color System

The UI palette derives from the active visualization type:

| Viz Type | Accent Color | Hex |
|---|---|---|
| Graph | Blue | #3b82f6 |
| Tree | Emerald | #10b981 |
| Flowchart | Amber | #f59e0b |
| Hierarchy | Violet | #8b5cf6 |

The accent color tints:
- Active pad button highlights
- Concept detail tags in the editor pane
- Center indicator dot on the action cluster
- Subtle canvas background gradient (very faint wash)

Neutral surfaces remain translucent:
- Light: bg-white/50 backdrop-blur-xl, border white/20
- Dark: bg-black/40 backdrop-blur-xl, border white/10

## Typography

One typeface throughout: **Space Grotesk**

Geometric sans-serif with a technical personality but warm enough for reading. Distinctive letterforms give identity without being distracting.

| Element | Weight | Size |
|---|---|---|
| File name / app title | SemiBold 600 | 16px |
| Section headings | Medium 500 | 12px uppercase tracking-wide |
| Concept tags | Regular 400 | 12px |
| Editor text | Regular 400 | 14px / 1.7 line-height |
| Control key labels | Medium 500 | 10px |
| Relationship list items | Regular 400 | 12px |

## Button Styling

Buttons are circular, 40px diameter, with custom SVG icons.

| State | Background | Icon Color | Effect |
|---|---|---|---|
| Default | bg-white/30 | gray-600 | -- |
| Hover | bg-white/60 | Accent color | -- |
| Active / key held | bg-accent/20 | Accent color | Subtle scale pulse |
| Disabled | opacity-30 | gray-400 | -- |

Key hint labels (the letter) appear below each button on hover or when a keyboard shortcut guide is toggled.

## Dark Mode

In dark mode, the same system inverts:
- Canvas background: gray-950
- Glass surfaces: bg-black/40 backdrop-blur-xl border-white/10
- Text: gray-100 primary, gray-400 secondary
- Accent colors stay the same (designed to work on both backgrounds)
