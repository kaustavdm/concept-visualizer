<script lang="ts">
  import type { CameraMode } from '$lib/3d/createScene';

  interface Props {
    compassAngle: number;
    cameraMode: CameraMode;
    shiftHeld?: boolean;
    onInputStart: (action: string) => void;
    onInputEnd: (action: string) => void;
    onLookAtOrigin: () => void;
    keyActiveActions?: Set<string>;
  }

  let { compassAngle, cameraMode, shiftHeld = false, onInputStart, onInputEnd, onLookAtOrigin, keyActiveActions = new Set() }: Props = $props();

  // Metallic mode colors — green for orbit, blue for pan/fly
  const MODE_COLORS = {
    orbit: { fill: '#2f4a2a', center: '#3a6435', accent: '#5a9960', ring: '#7dca8a' },
    fly:   { fill: '#1e3348', center: '#2a4f6a', accent: '#4a82a8', ring: '#6ab4dc' },
  } as const;

  // Shift inverts the mode (mirrors scene engine logic)
  let effectiveMode = $derived<CameraMode>(
    shiftHeld ? (cameraMode === 'orbit' ? 'fly' : 'orbit') : cameraMode
  );
  let modeColor = $derived(MODE_COLORS[effectiveMode]);

  let showKeyHints = $state(false);
  let hovered = $state(false);
  let activated = $state(false);
  let activateTimer: ReturnType<typeof setTimeout> | null = null;
  let activeButtons = $state(new Set<string>());
  let hoveredButton: string | null = $state(null);

  // Merge pointer-active and keyboard-active for visual feedback
  let allActive = $derived(new Set([...activeButtons, ...keyActiveActions]));

  let opacity = $derived(activated ? 1 : hovered ? 0.7 : 0.4);

  function flashActivated() {
    activated = true;
    if (activateTimer) clearTimeout(activateTimer);
    activateTimer = setTimeout(() => {
      activated = false;
    }, 3000);
  }

  // Keyboard presses for this dial's keys → activate brightness
  $effect(() => {
    if (keyActiveActions.size > 0) flashActivated();
  });

  function startPress(action: string, e: PointerEvent) {
    const el = e.currentTarget as Element;
    el.setPointerCapture(e.pointerId);
    onInputStart(action);
    activeButtons = new Set([...activeButtons, action]);
    flashActivated();
  }

  function endPress(action: string) {
    if (!activeButtons.has(action)) return;
    onInputEnd(action);
    const next = new Set(activeButtons);
    next.delete(action);
    activeButtons = next;
  }

  function getTriangleFill(action: string): string {
    if (allActive.has(action)) return modeColor.accent;
    if (hoveredButton === action) return modeColor.center;
    return modeColor.fill;
  }

  function getTriangleStroke(action: string): string {
    if (allActive.has(action)) return modeColor.ring;
    if (hoveredButton === action) return modeColor.ring;
    return modeColor.accent;
  }

  function getZoomFill(action: string): string {
    if (allActive.has(action)) return 'var(--pad-btn-bg-active)';
    if (hoveredButton === action) return 'var(--pad-btn-bg-hover)';
    return 'var(--pad-btn-bg)';
  }

  // Directional triangles: [action, polygon points, key hint label, hint x, hint y]
  const TRIANGLES: [string, string, string, number, number][] = [
    ['pan_up', '64,50 96,50 80,12', 'W', 80, 37],
    ['pan_down', '64,110 96,110 80,148', 'S', 80, 123],
    ['pan_left', '50,64 50,96 12,80', 'A', 37, 80],
    ['pan_right', '110,64 110,96 148,80', 'D', 123, 80],
  ];

  // Flat-top hexagon points (viewBox 0 0 34 30, centered at 17,15, R=14)
  const HEX_POINTS = '31,15 24,27 10,27 3,15 10,3 24,3';
</script>

<div
  class="absolute bottom-6 left-6 z-20 flex flex-col items-center gap-2 transition-opacity duration-300"
  style="opacity: {opacity};"
  onmouseenter={() => {
    hovered = true;
    showKeyHints = true;
  }}
  onmouseleave={() => {
    hovered = false;
    showKeyHints = false;
  }}
  role="toolbar"
  tabindex="0"
  aria-label="Camera controls"
>
  <!-- Circular D-pad -->
  <div class="relative" style="width: 144px; height: 144px;">
    <!-- Glass backdrop circle with 3D emboss -->
    <div
      class="absolute inset-0 rounded-full"
      style="
        background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%), var(--glass-bg);
        backdrop-filter: blur(16px);
        border: 1px solid {modeColor.accent};
        box-shadow:
          inset 0 1px 1px rgba(255,255,255,0.12),
          inset 0 -1px 2px rgba(0,0,0,0.2),
          0 4px 12px rgba(0,0,0,0.3),
          0 1px 3px rgba(0,0,0,0.2);
        transition: border-color 1s;
      "
    ></div>

    <!-- SVG interactive layer -->
    <svg
      viewBox="0 0 160 160"
      width="144"
      height="144"
      class="relative select-none"
      style="display: block;"
    >
      <defs>
        <filter id="pad-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <!-- Emboss: top-light bevel -->
        <filter id="pad-emboss" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
          <feOffset in="blur" dx="0" dy="1" result="offsetTop" />
          <feFlood flood-color="white" flood-opacity="0.15" result="lightColor" />
          <feComposite in="lightColor" in2="offsetTop" operator="in" result="topLight" />
          <feOffset in="blur" dx="0" dy="-1" result="offsetBot" />
          <feFlood flood-color="black" flood-opacity="0.25" result="darkColor" />
          <feComposite in="darkColor" in2="offsetBot" operator="in" result="botShadow" />
          <feMerge>
            <feMergeNode in="botShadow" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="topLight" />
          </feMerge>
        </filter>
      </defs>

      <!-- Decorative inner ring -->
      <circle
        cx="80"
        cy="80"
        r="30"
        stroke-width="0.5"
        opacity="0.4"
        style="fill: none; stroke: {modeColor.accent}; transition: stroke 1s;"
      />

      <!-- Direction triangles -->
      {#each TRIANGLES as [action, points, hint, hx, hy]}
        <polygon
          {points}
          stroke-width={allActive.has(action) ? 3 : hoveredButton === action ? 1.5 : 1}
          stroke-linejoin="round"
          filter={allActive.has(action) ? 'url(#pad-glow)' : 'url(#pad-emboss)'}
          style="cursor: pointer; fill: {getTriangleFill(action)}; stroke: {getTriangleStroke(action)}; transition: fill 0.15s, stroke 0.15s, stroke-width 0.15s;"
          onpointerdown={(e) => startPress(action, e)}
          onpointerup={() => endPress(action)}
          onpointerleave={() => { endPress(action); hoveredButton = null; }}
          onmouseenter={() => (hoveredButton = action)}
          onmouseleave={() => (hoveredButton = null)}
          role="button"
          tabindex="-1"
          aria-label={hint}
        />
        {#if showKeyHints}
          <text
            x={hx}
            y={hy}
            text-anchor="middle"
            dominant-baseline="central"
            fill="var(--pad-icon)"
            font-size="11"
            font-family="var(--font-main)"
            font-weight="500"
            pointer-events="none"
          >
            {hint}
          </text>
        {/if}
      {/each}

      <!-- Center compass — color reflects camera mode (shift inverts) -->
      <circle
        cx="80" cy="80" r="22"
        stroke-width={hoveredButton === 'center' ? 2 : 1.5}
        filter="url(#pad-emboss)"
        style="cursor: pointer; fill: {hoveredButton === 'center' ? modeColor.accent : modeColor.center}; stroke: {hoveredButton === 'center' ? modeColor.ring : modeColor.accent}; transition: fill 0.15s, stroke 0.15s, stroke-width 0.15s;"
        onclick={onLookAtOrigin}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') onLookAtOrigin(); }}
        onmouseenter={() => (hoveredButton = 'center')}
        onmouseleave={() => (hoveredButton = null)}
        role="button"
        tabindex="-1"
        aria-label="Look at origin"
      />
      <!-- Compass needle (rotates to point toward origin) -->
      <g transform="rotate({compassAngle}, 80, 80)" pointer-events="none">
        <polygon points="80,60 76,80 84,80" opacity="0.9"
          style="fill: {modeColor.ring}; transition: fill 1s;" />
        <polygon points="80,100 76,80 84,80" opacity="0.3"
          style="fill: {modeColor.accent}; transition: fill 1s;" />
      </g>
      <!-- Mode icon: orbit = ring, fly/pan = divergence arrows -->
      {#if effectiveMode === 'orbit'}
        <circle
          cx="80" cy="80" r="5"
          stroke-width="1.5"
          pointer-events="none"
          style="fill: none; stroke: {modeColor.ring}; transition: stroke 1s;"
        />
      {:else}
        <g pointer-events="none">
          <line x1="80" y1="77" x2="80" y2="72" stroke-width="1.5" stroke-linecap="round" style="stroke: {modeColor.ring}; transition: stroke 1s;" />
          <line x1="80" y1="83" x2="80" y2="88" stroke-width="1.5" stroke-linecap="round" style="stroke: {modeColor.ring}; transition: stroke 1s;" />
          <line x1="77" y1="80" x2="72" y2="80" stroke-width="1.5" stroke-linecap="round" style="stroke: {modeColor.ring}; transition: stroke 1s;" />
          <line x1="83" y1="80" x2="88" y2="80" stroke-width="1.5" stroke-linecap="round" style="stroke: {modeColor.ring}; transition: stroke 1s;" />
        </g>
      {/if}
      {#if showKeyHints}
        <text
          x="80" y="96" text-anchor="middle"
          fill="var(--pad-icon-muted)" font-size="9"
          font-family="var(--font-main)" font-weight="500"
          pointer-events="none" opacity="0.8"
        >C</text>
      {/if}
    </svg>
  </div>

  <!-- Zoom hexagons -->
  <div class="flex gap-3 items-center">
    <!-- Zoom in -->
    <div class="relative">
      <svg
        viewBox="0 0 34 30"
        width="34"
        height="30"
        class="select-none block"
        style="cursor: pointer;"
      >
        <polygon
          points={HEX_POINTS}
          stroke-width={allActive.has('zoom_in') ? 2 : hoveredButton === 'zoom_in' ? 1.5 : 1}
          stroke-linejoin="round"
          style="fill: {getZoomFill('zoom_in')}; stroke: {allActive.has('zoom_in') || hoveredButton === 'zoom_in' ? modeColor.ring : modeColor.accent}; transition: fill 0.15s, stroke 0.15s, stroke-width 0.15s;"
          onpointerdown={(e) => startPress('zoom_in', e)}
          onpointerup={() => endPress('zoom_in')}
          onpointerleave={() => { endPress('zoom_in'); hoveredButton = null; }}
          onmouseenter={() => (hoveredButton = 'zoom_in')}
          onmouseleave={() => (hoveredButton = null)}
          role="button"
          tabindex="-1"
          aria-label="Zoom in"
        />
        <!-- Plus icon -->
        <line
          x1="12" y1="15" x2="22" y2="15"
          stroke-width="2" stroke-linecap="round"
          pointer-events="none"
          style="stroke: {allActive.has('zoom_in') || hoveredButton === 'zoom_in' ? modeColor.ring : 'var(--pad-icon)'}; transition: stroke 0.15s;"
        />
        <line
          x1="17" y1="10" x2="17" y2="20"
          stroke-width="2" stroke-linecap="round"
          pointer-events="none"
          style="stroke: {allActive.has('zoom_in') || hoveredButton === 'zoom_in' ? modeColor.ring : 'var(--pad-icon)'}; transition: stroke 0.15s;"
        />
      </svg>
      {#if showKeyHints}
        <span
          class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] font-medium"
          style="color: var(--pad-icon-muted); opacity: 0.8;">Z</span
        >
      {/if}
    </div>

    <!-- Zoom out -->
    <div class="relative">
      <svg
        viewBox="0 0 34 30"
        width="34"
        height="30"
        class="select-none block"
        style="cursor: pointer;"
      >
        <polygon
          points={HEX_POINTS}
          stroke-width={allActive.has('zoom_out') ? 2 : hoveredButton === 'zoom_out' ? 1.5 : 1}
          stroke-linejoin="round"
          style="fill: {getZoomFill('zoom_out')}; stroke: {allActive.has('zoom_out') || hoveredButton === 'zoom_out' ? modeColor.ring : modeColor.accent}; transition: fill 0.15s, stroke 0.15s, stroke-width 0.15s;"
          onpointerdown={(e) => startPress('zoom_out', e)}
          onpointerup={() => endPress('zoom_out')}
          onpointerleave={() => { endPress('zoom_out'); hoveredButton = null; }}
          onmouseenter={() => (hoveredButton = 'zoom_out')}
          onmouseleave={() => (hoveredButton = null)}
          role="button"
          tabindex="-1"
          aria-label="Zoom out"
        />
        <!-- Minus icon -->
        <line
          x1="12" y1="15" x2="22" y2="15"
          stroke-width="2" stroke-linecap="round"
          pointer-events="none"
          style="stroke: {allActive.has('zoom_out') || hoveredButton === 'zoom_out' ? modeColor.ring : 'var(--pad-icon)'}; transition: stroke 0.15s;"
        />
      </svg>
      {#if showKeyHints}
        <span
          class="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] font-medium"
          style="color: var(--pad-icon-muted); opacity: 0.8;">X</span
        >
      {/if}
    </div>
  </div>
</div>
