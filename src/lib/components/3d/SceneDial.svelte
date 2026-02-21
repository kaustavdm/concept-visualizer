<script lang="ts">
  import { untrack } from 'svelte';

  interface Props {
    selections: Record<string, string>;
    onSelect: (faceId: string, optionId: string) => void;
    onToggle: (faceId: string) => void;
    activateFace?: string | null;
    activateCenter?: boolean;
    activateOptionIndex?: number | null;
    dismiss?: boolean;
  }

  let { selections, onSelect, onToggle, activateFace = null, activateCenter = false, activateOptionIndex = null, dismiss = false }: Props = $props();

  let openFace: string | null = $state(null);
  let lastInteracted: string = $state('theme');
  let hovered = $state(false);
  let activated = $state(false);
  let brightnessTimer: ReturnType<typeof setTimeout> | null = null;
  let showKeyHints = $state(false);
  let hoveredFace: string | null = $state(null);
  let containerEl: HTMLDivElement | undefined = $state(undefined);
  let fanVisible = $state(false);
  let activatedFaceId: string | null = $state(null);
  let activateTimer: ReturnType<typeof setTimeout> | null = null;

  const FACES = [
    {
      id: 'theme',
      label: 'Theme',
      keyHint: 'O',
      path: 'M67,57.5 L44,17.6 L116,17.6 L93,57.5 A26,26 0 0,0 67,57.5',
      iconPos: { x: 80, y: 38 },
      fanAngle: 270,
      edgeMidpoint: { x: 80, y: 17.6 },
      isToggle: false,
      options: [
        { id: 'light', label: 'Light' },
        { id: 'dark', label: 'Dark' },
      ],
      iconPath: 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z',
    },
    {
      id: 'lighting',
      label: 'Lighting',
      keyHint: ';',
      path: 'M93,57.5 L116,17.6 L152,80 L106,80 A26,26 0 0,0 93,57.5',
      iconPos: { x: 118, y: 56 },
      fanAngle: 330,
      edgeMidpoint: { x: 134, y: 48.8 },
      isToggle: false,
      options: [
        { id: 'studio', label: 'Studio' },
        { id: 'dramatic', label: 'Dramatic' },
        { id: 'soft', label: 'Soft' },
        { id: 'ambient', label: 'Ambient' },
      ],
      iconPath:
        'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
    },
    {
      id: 'environment',
      label: 'Environment',
      keyHint: '.',
      path: 'M106,80 L152,80 L116,142.4 L93,102.5 A26,26 0 0,0 106,80',
      iconPos: { x: 118, y: 104 },
      fanAngle: 30,
      edgeMidpoint: { x: 134, y: 111.2 },
      isToggle: false,
      options: [
        { id: 'void', label: 'Void' },
        { id: 'gradient', label: 'Gradient' },
        { id: 'grid', label: 'Grid' },
      ],
      iconPath:
        'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    },
    {
      id: 'objects',
      label: 'Objects',
      keyHint: ',',
      path: 'M93,102.5 L116,142.4 L44,142.4 L67,102.5 A26,26 0 0,0 93,102.5',
      iconPos: { x: 80, y: 122 },
      fanAngle: 90,
      edgeMidpoint: { x: 80, y: 142.4 },
      isToggle: false,
      options: [
        { id: 'all', label: 'All' },
        { id: 'primary', label: 'Primary' },
        { id: 'none', label: 'None' },
      ],
      iconPath:
        'M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.36.2-.8.2-1.14 0l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.36-.2.8-.2 1.14 0l7.9 4.44c.32.17.53.5.53.88v9z',
    },
    {
      id: 'camera',
      label: 'Camera',
      keyHint: 'M',
      path: 'M67,102.5 L44,142.4 L8,80 L54,80 A26,26 0 0,0 67,102.5',
      iconPos: { x: 42, y: 104 },
      fanAngle: 150,
      edgeMidpoint: { x: 26, y: 111.2 },
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
      keyHint: 'K',
      path: 'M54,80 L8,80 L44,17.6 L67,57.5 A26,26 0 0,0 54,80',
      iconPos: { x: 42, y: 56 },
      fanAngle: 210,
      edgeMidpoint: { x: 26, y: 48.8 },
      isToggle: false,
      options: [
        { id: 'none', label: 'None' },
        { id: 'bloom', label: 'Bloom' },
        { id: 'dof', label: 'DoF' },
      ],
      iconPath:
        'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z',
    },
  ] as const;

  let opacity = $derived(activated ? 1 : hovered ? 0.7 : 0.4);

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

  function handleFaceClick(face: (typeof FACES)[number]) {
    flashActivated();
    flashActivation(face.id);
    if (face.isToggle) {
      onToggle(face.id);
      lastInteracted = face.id;
      return;
    }
    if (openFace === face.id) {
      openFace = null;
      fanVisible = false;
    } else {
      openFace = face.id;
      lastInteracted = face.id;
      // Delay fanVisible so the transition triggers after mount
      fanVisible = false;
      requestAnimationFrame(() => {
        fanVisible = true;
      });
    }
  }

  function handleOptionClick(faceId: string, optionId: string) {
    flashActivated();
    onSelect(faceId, optionId);
    openFace = null;
    fanVisible = false;
  }

  function handleWindowClick(e: MouseEvent) {
    if (openFace && containerEl && !containerEl.contains(e.target as Node)) {
      openFace = null;
      fanVisible = false;
    }
  }

  // Fixed upper-left arc so fan options never clip off-screen
  function getFanPositions(face: (typeof FACES)[number]) {
    const { options } = face;
    const count = options.length;
    const anchor = { x: 26, y: 48 };  // upper-left edge of hex
    const centerAngle = 210;           // fans toward upper-left
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

  function getFaceFill(faceId: string): string {
    if (activatedFaceId === faceId) return 'var(--pad-btn-bg-active)';
    if (openFace === faceId) return 'var(--pad-btn-bg-active)';
    if (hoveredFace === faceId) return 'var(--pad-btn-bg-hover)';
    return 'var(--pad-btn-bg)';
  }

  function getFaceStroke(faceId: string): string {
    if (activatedFaceId === faceId) return 'var(--accent)';
    if (openFace === faceId) return 'var(--accent)';
    return 'var(--glass-border)';
  }

  function getFaceStrokeWidth(faceId: string): number {
    if (activatedFaceId === faceId) return 3;
    if (openFace === faceId) return 2;
    return 0.5;
  }

  function getFaceFilter(faceId: string): string {
    if (activatedFaceId === faceId) return 'url(#activation-glow)';
    return 'url(#scene-emboss)';
  }

  let lastInteractedFace = $derived(
    FACES.find((f) => f.id === lastInteracted) ?? FACES[0]
  );

  let openFaceData = $derived(
    openFace ? FACES.find((f) => f.id === openFace) ?? null : null
  );

  let fanPositions = $derived(
    openFaceData ? getFanPositions(openFaceData) : []
  );

  // React to keyboard-triggered face activation from the page.
  // MUST use untrack: handleFaceClick reads openFace, and writing openFace
  // would re-trigger this effect while activateFace is still set, causing
  // an immediate open→close cycle. (Same class of bug as $effect + $state read/write.)
  $effect(() => {
    if (activateFace) {
      const face = FACES.find((f) => f.id === activateFace);
      if (face) untrack(() => handleFaceClick(face));
    }
  });

  // React to center key (L): cycle to next option in open fan
  $effect(() => {
    if (!activateCenter) return;
    untrack(() => {
      if (openFaceData && openFaceData.options.length > 0) {
        const currentSel = selections[openFaceData.id];
        const idx = openFaceData.options.findIndex((o) => o.id === currentSel);
        const nextIdx = (idx + 1) % openFaceData.options.length;
        handleOptionClick(openFaceData.id, openFaceData.options[nextIdx].id);
      }
    });
  });

  // React to number key (1-9): select nth option in open fan
  $effect(() => {
    if (activateOptionIndex == null) return;
    const idx = activateOptionIndex;
    untrack(() => {
      if (openFaceData && idx < openFaceData.options.length) {
        handleOptionClick(openFaceData.id, openFaceData.options[idx].id);
      }
    });
  });

  // Dismiss: close open fan
  $effect(() => {
    if (!dismiss) return;
    untrack(() => {
      if (openFace) {
        openFace = null;
        fanVisible = false;
      }
    });
  });

  const HEX_POINTS = '152,80 116,142.4 44,142.4 8,80 44,17.6 116,17.6';
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
  aria-label="Scene controls"
>
  <!-- Hex container -->
  <div class="relative" style="width: 173px; height: 173px;">
    <!-- Glass backdrop hex -->
    <div
      class="absolute inset-0"
      style="
        background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(0,0,0,0.15) 100%), var(--glass-bg);
        backdrop-filter: blur(16px);
        border: 1px solid var(--glass-border);
        clip-path: polygon(
          95% 50%,
          72.5% 89%,
          27.5% 89%,
          5% 50%,
          27.5% 11%,
          72.5% 11%
        );
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
        <filter id="scene-glow">
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
        <!-- Emboss: top-light bevel -->
        <filter id="scene-emboss" x="-5%" y="-5%" width="110%" height="110%">
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
        stroke="var(--glass-border)"
        stroke-width="0.5"
      />

      <!-- Face paths -->
      {#each FACES as face}
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
      {#each FACES as face}
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
            fill={openFace === face.id ? 'var(--accent)' : 'var(--pad-icon)'}
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

      <!-- Center circle: shows last interacted face icon -->
      <circle
        cx="80"
        cy="80"
        r="22"
        fill="var(--pad-btn-bg)"
        stroke="var(--glass-border)"
        stroke-width="1"
        filter="url(#scene-emboss)"
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
          d={lastInteractedFace.iconPath}
          fill="var(--accent)"
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
              transition: opacity {150}ms ease {i * 50}ms, transform {150}ms ease {i * 50}ms;
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
                ? 'var(--pad-btn-bg-active)'
                : 'var(--pad-btn-bg)'}
              stroke={selections[openFaceData.id] === opt.id
                ? 'var(--accent)'
                : 'var(--glass-border)'}
              stroke-width={selections[openFaceData.id] === opt.id ? 2 : 1}
              filter={selections[openFaceData.id] === opt.id
                ? 'url(#scene-glow)'
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
                ? 'var(--accent)'
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
</div>
