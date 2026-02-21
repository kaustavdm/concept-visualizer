<script lang="ts">
  import { untrack } from 'svelte';
  import type { HexBayConfig, HexFaceConfig } from './hexagon-dial.types';

  interface Props {
    bays: HexBayConfig[];
    activeBayIndex: number;
    selections: Record<string, string>;
    onSelect: (faceId: string, optionId: string) => void;
    onToggle: (faceId: string) => void;
    onBayChange: (nextIndex: number) => void;
    onFanStateChange?: (isOpen: boolean) => void;
    activateFace?: string | null;
    activateCenter?: boolean;
    activateOptionIndex?: number | null;
    dismiss?: boolean;
  }

  let {
    bays,
    activeBayIndex,
    selections,
    onSelect,
    onToggle,
    onBayChange,
    onFanStateChange,
    activateFace = null,
    activateCenter = false,
    activateOptionIndex = null,
    dismiss = false,
  }: Props = $props();

  // --- Geometry: positional constants, independent of bay content ---

  const HEX_POSITIONS = [
    {
      keyHint: 'O',
      path: 'M67,57.5 L44,17.6 L116,17.6 L93,57.5 A26,26 0 0,0 67,57.5',
      iconPos: { x: 80, y: 38 },
      fanAngle: 270,
      edgeMidpoint: { x: 80, y: 17.6 },
    },
    {
      keyHint: ';',
      path: 'M93,57.5 L116,17.6 L152,80 L106,80 A26,26 0 0,0 93,57.5',
      iconPos: { x: 118, y: 56 },
      fanAngle: 330,
      edgeMidpoint: { x: 134, y: 48.8 },
    },
    {
      keyHint: '.',
      path: 'M106,80 L152,80 L116,142.4 L93,102.5 A26,26 0 0,0 106,80',
      iconPos: { x: 118, y: 104 },
      fanAngle: 30,
      edgeMidpoint: { x: 134, y: 111.2 },
    },
    {
      keyHint: ',',
      path: 'M93,102.5 L116,142.4 L44,142.4 L67,102.5 A26,26 0 0,0 93,102.5',
      iconPos: { x: 80, y: 122 },
      fanAngle: 90,
      edgeMidpoint: { x: 80, y: 142.4 },
    },
    {
      keyHint: 'M',
      path: 'M67,102.5 L44,142.4 L8,80 L54,80 A26,26 0 0,0 67,102.5',
      iconPos: { x: 42, y: 104 },
      fanAngle: 150,
      edgeMidpoint: { x: 26, y: 111.2 },
    },
    {
      keyHint: 'K',
      path: 'M54,80 L8,80 L44,17.6 L67,57.5 A26,26 0 0,0 54,80',
      iconPos: { x: 42, y: 56 },
      fanAngle: 210,
      edgeMidpoint: { x: 26, y: 48.8 },
    },
  ] as const;

  const HEX_POINTS = '152,80 116,142.4 44,142.4 8,80 44,17.6 116,17.6';

  // --- Component state ---

  let openFace: string | null = $state(null);
  let hovered = $state(false);
  let activated = $state(false);
  let brightnessTimer: ReturnType<typeof setTimeout> | null = null;
  let showKeyHints = $state(false);
  let hoveredFace: string | null = $state(null);
  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let fanVisible = $state(false);
  let activatedFaceId: string | null = $state(null);
  let activateTimer: ReturnType<typeof setTimeout> | null = null;
  let bayContentOpacity = $state(1);
  let bayTransitioning = $state(false);

  // Fan auto-close timers: 3s delay then 300ms fade-out
  let fanCloseTimer: ReturnType<typeof setTimeout> | null = null;
  let fanFadeTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Derived state ---

  let activeBay = $derived(bays[activeBayIndex]);
  let tint = $derived(activeBay.tint);

  type RenderedFace = (typeof HEX_POSITIONS)[number] & HexFaceConfig;

  let renderedFaces: RenderedFace[] = $derived(
    HEX_POSITIONS.map((geo, i) => ({ ...geo, ...activeBay.faces[i] }))
  );

  let openFaceData = $derived(
    openFace ? renderedFaces.find((f) => f.id === openFace) ?? null : null
  );

  let fanPositions = $derived(
    openFaceData ? getFanPositions(openFaceData) : []
  );

  let opacity = $derived(activated ? 1 : hovered ? 0.7 : 0.4);

  // --- Functions ---

  function flashActivated() {
    activated = true;
    if (brightnessTimer) clearTimeout(brightnessTimer);
    brightnessTimer = setTimeout(() => {
      activated = false;
    }, 3000);
  }

  function flashActivation(faceId: string) {
    activatedFaceId = faceId;
    if (activateTimer) clearTimeout(activateTimer);
    activateTimer = setTimeout(() => { activatedFaceId = null; }, 300);
  }

  function cancelFanTimers() {
    if (fanCloseTimer) { clearTimeout(fanCloseTimer); fanCloseTimer = null; }
    if (fanFadeTimer) { clearTimeout(fanFadeTimer); fanFadeTimer = null; }
  }

  // Schedule auto-close: delayMs visible → 300ms fade → remove from DOM
  // 15s when fan opens without selection, 5s after an option is selected/cycled
  function scheduleFanClose(delayMs: number) {
    cancelFanTimers();
    fanCloseTimer = setTimeout(() => {
      fanCloseTimer = null;
      fanVisible = false;
      fanFadeTimer = setTimeout(() => {
        fanFadeTimer = null;
        openFace = null;
        onFanStateChange?.(false);
      }, 300);
    }, delayMs);
  }

  // Immediate close: Escape, click outside, bay switch
  function closeFan() {
    cancelFanTimers();
    if (openFace) {
      openFace = null;
      fanVisible = false;
      onFanStateChange?.(false);
    }
  }

  function handleFaceClick(face: RenderedFace) {
    flashActivated();
    flashActivation(face.id);
    if (face.isToggle) {
      onToggle(face.id);
      return;
    }
    // Same face pressed while fan is open → cycle option, restart timer
    if (openFace === face.id) {
      cancelFanTimers();
      fanVisible = true; // restore if mid-fade
      const currentSel = selections[face.id];
      const idx = face.options.findIndex((o) => o.id === currentSel);
      const nextIdx = (idx + 1) % face.options.length;
      onSelect(face.id, face.options[nextIdx].id);
      scheduleFanClose(5000);
      return;
    }
    // Different face → cancel old timers, open new fan, start browse timer
    cancelFanTimers();
    openFace = face.id;
    fanVisible = false;
    onFanStateChange?.(true);
    requestAnimationFrame(() => {
      fanVisible = true;
    });
    scheduleFanClose(15000);
  }

  function handleOptionClick(faceId: string, optionId: string) {
    flashActivated();
    onSelect(faceId, optionId);
    scheduleFanClose(5000);
  }

  function handleWindowClick(e: MouseEvent) {
    if (openFace && containerEl && !containerEl.contains(e.target as Node)) {
      closeFan();
    }
  }

  function switchBay() {
    if (bays.length <= 1 || bayTransitioning) return;
    closeFan();
    bayTransitioning = true;
    bayContentOpacity = 0;
    setTimeout(() => {
      const nextIndex = (activeBayIndex + 1) % bays.length;
      onBayChange(nextIndex);
      requestAnimationFrame(() => {
        bayContentOpacity = 1;
        setTimeout(() => { bayTransitioning = false; }, 100);
      });
    }, 100);
  }

  // Fan positions: fixed upper-left arc
  function getFanPositions(face: RenderedFace) {
    const { options } = face;
    const count = options.length;
    const anchor = { x: 26, y: 48 };
    const centerAngle = 210;
    const spreadDeg = 42;
    const dist = 60;
    return options.map((opt, i) => {
      const angleDeg = centerAngle + (i - (count - 1) / 2) * spreadDeg;
      const angleRad = (angleDeg * Math.PI) / 180;
      return {
        ...opt,
        x: anchor.x + dist * Math.cos(angleRad),
        y: anchor.y + dist * Math.sin(angleRad),
      };
    });
  }

  // --- Tint-aware styling ---

  function getFaceFill(faceId: string): string {
    if (activatedFaceId === faceId) return tint.activeBg;
    if (openFace === faceId) return tint.activeBg;
    if (hoveredFace === faceId) return tint.hoverBg;
    return 'var(--pad-btn-bg)';
  }

  function getFaceStroke(faceId: string): string {
    if (activatedFaceId === faceId) return tint.accent;
    if (openFace === faceId) return tint.border;
    if (hoveredFace === faceId) return tint.border;
    return 'var(--glass-border)';
  }

  function getFaceStrokeWidth(faceId: string): number {
    if (activatedFaceId === faceId) return 3;
    if (openFace === faceId) return 2;
    if (hoveredFace === faceId) return 1;
    return 0.5;
  }

  function getFaceFilter(faceId: string): string {
    if (activatedFaceId === faceId) return 'url(#activation-glow)';
    return 'url(#hex-emboss)';
  }

  function getIconFill(faceId: string): string {
    if (openFace === faceId) return tint.accent;
    if (hoveredFace === faceId) return tint.accent;
    return 'var(--pad-icon)';
  }

  // --- Cleanup all timers on destroy ---

  $effect(() => {
    return () => {
      cancelFanTimers();
      if (brightnessTimer) clearTimeout(brightnessTimer);
      if (activateTimer) clearTimeout(activateTimer);
    };
  });

  // --- Keyboard-driven effects ---

  $effect(() => {
    if (activateFace) {
      const face = renderedFaces.find((f) => f.id === activateFace);
      if (face) untrack(() => handleFaceClick(face));
    }
  });

  $effect(() => {
    if (!activateCenter) return;
    untrack(() => switchBay());
  });

  $effect(() => {
    if (activateOptionIndex == null) return;
    const idx = activateOptionIndex;
    untrack(() => {
      if (openFaceData && idx < openFaceData.options.length) {
        handleOptionClick(openFaceData.id, openFaceData.options[idx].id);
      }
    });
  });

  $effect(() => {
    if (!dismiss) return;
    untrack(() => closeFan());
  });
</script>

<svelte:window onclick={handleWindowClick} />

<div
  bind:this={containerEl}
  class="absolute right-6 bottom-6 z-20 flex flex-col items-center transition-opacity duration-300"
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
  aria-label="{activeBay.label} controls"
>
  <!-- Hex container -->
  <div class="relative" style="width: 173px; height: 173px;">
    <!-- Glass backdrop hex -->
    <div
      class="absolute inset-0"
      style="
        background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%), var(--glass-bg);
        backdrop-filter: blur(16px);
        border: 1px solid {tint.border};
        clip-path: polygon(
          95% 50%,
          72.5% 89%,
          27.5% 89%,
          5% 50%,
          27.5% 11%,
          72.5% 11%
        );
        transition: border-color 200ms ease;
      "
    ></div>

    <!-- SVG interactive layer -->
    <svg
      viewBox="0 0 160 160"
      width="173"
      height="173"
      overflow="visible"
      class="relative select-none"
      style="display: block;"
    >
      <defs>
        <filter id="hex-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="activation-glow">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="hex-emboss" x="-5%" y="-5%" width="110%" height="110%">
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

      <!-- Hex outline -->
      <polygon
        points={HEX_POINTS}
        fill="none"
        stroke={tint.border}
        stroke-width="0.5"
        style="transition: stroke 200ms ease;"
      />

      <!-- Bay content with cross-fade -->
      <g style="opacity: {bayContentOpacity}; transition: opacity 100ms ease;">
        <!-- Face paths -->
        {#each renderedFaces as face}
          <path
            d={face.path}
            fill={getFaceFill(face.id)}
            stroke={getFaceStroke(face.id)}
            stroke-width={getFaceStrokeWidth(face.id)}
            filter={getFaceFilter(face.id)}
            style="cursor: pointer; transition: fill 0.15s, stroke 0.15s, stroke-width 0.15s;"
            onclick={() => handleFaceClick(face)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFaceClick(face); }}
            onmouseenter={() => (hoveredFace = face.id)}
            onmouseleave={() => (hoveredFace = null)}
            role="button"
            tabindex="-1"
            aria-label={face.label}
          />
        {/each}

        <!-- Face icons and key hints -->
        {#each renderedFaces as face}
          <svg
            x={face.iconPos.x - 6}
            y={face.iconPos.y - 6}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            pointer-events="none"
          >
            <path
              d={face.iconPath}
              fill={getIconFill(face.id)}
              style="transition: fill 0.15s;"
            />
          </svg>
          {#if showKeyHints}
            <text
              x={face.iconPos.x}
              y={face.iconPos.y + 14}
              text-anchor="middle"
              fill="var(--pad-icon)"
              font-size="8"
              font-family="var(--font-main)"
              font-weight="500"
              pointer-events="none"
              opacity="0.8"
            >{face.keyHint}</text>
          {/if}
        {/each}
      </g>

      <!-- Center circle: shows active bay icon, clickable to switch -->
      <circle
        cx="80"
        cy="80"
        r="22"
        fill="var(--pad-btn-bg)"
        stroke={tint.border}
        stroke-width="1"
        filter="url(#hex-emboss)"
        style="cursor: pointer; transition: stroke 200ms ease;"
        onclick={() => switchBay()}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') switchBay(); }}
        role="button"
        tabindex="-1"
        aria-label="Switch bay"
      />
      <svg
        x={80 - 8}
        y={80 - 8}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        pointer-events="none"
      >
        <path
          d={activeBay.centerIconPath}
          fill={tint.accent}
          style="transition: fill 200ms ease;"
        />
      </svg>
      {#if showKeyHints}
        <text
          x="80"
          y="96"
          text-anchor="middle"
          fill="var(--pad-icon)"
          font-size="8"
          font-family="var(--font-main)"
          font-weight="500"
          pointer-events="none"
          opacity="0.8"
        >L</text>
      {/if}

      <!-- Fan-out options -->
      {#if openFaceData}
        {#each fanPositions as opt, i}
          <g
            style="
              transition: opacity {fanVisible ? 150 : 250}ms ease {fanVisible ? i * 50 : 0}ms, transform {fanVisible ? 150 : 250}ms ease {fanVisible ? i * 50 : 0}ms;
              opacity: {fanVisible ? 1 : 0};
              transform-origin: {opt.x}px {opt.y}px;
              transform: scale({fanVisible ? 1 : 0.3});
            "
          >
            <circle
              cx={opt.x}
              cy={opt.y}
              r="16"
              fill={selections[openFaceData.id] === opt.id
                ? tint.activeBg
                : 'var(--pad-btn-bg)'}
              stroke={selections[openFaceData.id] === opt.id
                ? tint.accent
                : 'var(--glass-border)'}
              stroke-width={selections[openFaceData.id] === opt.id ? 2 : 1}
              filter={selections[openFaceData.id] === opt.id
                ? 'url(#hex-glow)'
                : 'none'}
              style="cursor: pointer; transition: fill 0.1s, stroke 0.1s;"
              onclick={() => handleOptionClick(openFaceData!.id, opt.id)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOptionClick(openFaceData!.id, opt.id); }}
              role="button"
              tabindex="-1"
              aria-label={opt.label}
            />
            <text
              x={opt.x}
              y={opt.y}
              text-anchor="middle"
              dominant-baseline="central"
              fill={selections[openFaceData.id] === opt.id
                ? tint.accent
                : 'var(--pad-icon)'}
              font-size="7"
              font-family="var(--font-main)"
              font-weight="500"
              pointer-events="none"
              style="transition: fill 0.1s;"
            >{opt.label}</text>
          </g>
        {/each}
      {/if}
    </svg>
  </div>

  <!-- Bay indicator dots -->
  {#if bays.length > 1}
    <div class="flex gap-1.5 mt-1">
      {#each bays as bay, i}
        <div
          class="rounded-full transition-all duration-200"
          style="
            width: {i === activeBayIndex ? '12px' : '6px'};
            height: 6px;
            background: {i === activeBayIndex ? bay.tint.accent : 'var(--glass-border)'};
          "
        ></div>
      {/each}
    </div>
  {/if}
</div>
