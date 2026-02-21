import * as pc from 'playcanvas';
import type {
  SceneContent,
  SceneEntitySpec,
  MaterialSpec,
  AnimationContext,
} from './scene-content.types';

export type CameraMode = 'orbit' | 'fly' | 'follow';

export interface SceneController {
  setTheme(theme: 'light' | 'dark'): void;
  toggleCameraMode(): CameraMode;
  setCameraMode(mode: CameraMode): void;
  getCameraMode(): CameraMode;
  setInput(action: string, active: boolean): void;
  lookAtOrigin(): void;
  getCompassAngle(): number;
  loadContent(content: SceneContent): void;
  unloadContent(): void;
  getFollowableEntities(): string[];
  getFollowTarget(): string | null;
  cycleFollowTarget(): string | null;
  destroy(): void;
}

// --- Environment theme (clear color + ambient light) ---

interface EnvTheme {
  clear: pc.Color;
  ambient: pc.Color;
}

const ENV_THEMES: Record<string, EnvTheme> = {
  light: {
    clear: new pc.Color(0.92, 0.93, 0.95),
    ambient: new pc.Color(0.5, 0.5, 0.55),
  },
  dark: {
    clear: new pc.Color(0.01, 0.02, 0.06),
    ambient: new pc.Color(0.08, 0.08, 0.12),
  },
};

// --- Material helpers ---

function buildMaterial(spec: MaterialSpec): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();
  mat.diffuse = new pc.Color(spec.diffuse[0], spec.diffuse[1], spec.diffuse[2]);
  if (spec.emissive) {
    mat.emissive = new pc.Color(spec.emissive[0], spec.emissive[1], spec.emissive[2]);
  }
  if (spec.specular) {
    mat.specular = new pc.Color(spec.specular[0], spec.specular[1], spec.specular[2]);
  }
  if (spec.metalness !== undefined) {
    mat.metalness = spec.metalness;
    mat.useMetalness = true;
  }
  if (spec.gloss !== undefined) {
    mat.gloss = spec.gloss;
  }
  mat.update();
  return mat;
}

function buildGridFloor(
  app: pc.Application,
  spec: SceneEntitySpec,
): pc.Entity {
  const mat = buildMaterial(spec.material);

  // Generate grid texture
  const GRID_SIZE = 512;
  const GRID_CELLS = 16;
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = GRID_SIZE;
  gridCanvas.height = GRID_SIZE;
  const ctx = gridCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1.5;
  const cellPx = GRID_SIZE / GRID_CELLS;
  for (let i = 0; i <= GRID_CELLS; i++) {
    const p = i * cellPx;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, GRID_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(GRID_SIZE, p);
    ctx.stroke();
  }

  const gridTexture = new pc.Texture(app.graphicsDevice, {
    width: GRID_SIZE,
    height: GRID_SIZE,
    format: pc.PIXELFORMAT_RGBA8,
    addressU: pc.ADDRESS_REPEAT,
    addressV: pc.ADDRESS_REPEAT,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    anisotropy: 8,
  });
  gridTexture.setSource(gridCanvas);

  mat.opacityMap = gridTexture;
  mat.opacityMapChannel = 'a';
  mat.opacityMapTiling = new pc.Vec2(
    spec.opacity!.tiling,
    spec.opacity!.tiling,
  );
  mat.blendType = pc.BLEND_NORMAL;
  mat.cull = pc.CULLFACE_NONE;
  mat.depthWrite = false;
  mat.update();

  const entity = new pc.Entity(spec.id);
  entity.addComponent('render', { type: 'plane' });
  entity.render!.meshInstances[0].material = mat;

  if (spec.position) entity.setPosition(...spec.position);
  if (spec.rotation) entity.setLocalEulerAngles(...spec.rotation);
  if (spec.scale) entity.setLocalScale(...spec.scale);

  return entity;
}

function buildEntity(
  app: pc.Application,
  spec: SceneEntitySpec,
): pc.Entity {
  // Grid floor is a special case (opacity + texture)
  if (spec.opacity) {
    return buildGridFloor(app, spec);
  }

  const mat = buildMaterial(spec.material);
  const entity = new pc.Entity(spec.id);

  if (typeof spec.mesh === 'string') {
    // Primitive mesh
    entity.addComponent('render', { type: spec.mesh });
    entity.render!.meshInstances[0].material = mat;
  } else {
    // Custom geometry (e.g. pyramid = cone with capSegments:4)
    const geom = new pc.ConeGeometry({
      baseRadius: spec.mesh.baseRadius,
      peakRadius: spec.mesh.peakRadius,
      height: spec.mesh.height,
      heightSegments: spec.mesh.heightSegments,
      capSegments: spec.mesh.capSegments,
    });
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geom);
    entity.addComponent('render', {
      meshInstances: [new pc.MeshInstance(mesh, mat)],
    });
  }

  if (spec.position) entity.setPosition(...spec.position);
  if (spec.rotation) entity.setLocalEulerAngles(...spec.rotation);
  if (spec.scale) entity.setLocalScale(...spec.scale);

  return entity;
}

// --- Engine ---

export function createScene(
  canvas: HTMLCanvasElement,
  initialTheme: 'light' | 'dark',
): SceneController {
  const app = new pc.Application(canvas, {});

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  const envTheme = ENV_THEMES[initialTheme];

  // --- Camera ---
  const camera = new pc.Entity('camera');
  camera.addComponent('camera', {
    clearColor: envTheme.clear,
    fov: 50,
    nearClip: 0.1,
    farClip: 100,
  });
  app.root.addChild(camera);

  // --- Lights ---
  const keyLight = new pc.Entity('key-light');
  keyLight.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 0.97, 0.92),
    intensity: 1.0,
    castShadows: true,
    shadowBias: 0.2,
    normalOffsetBias: 0.05,
    shadowResolution: 2048,
  });
  keyLight.setEulerAngles(50, 130, 0);
  app.root.addChild(keyLight);

  const fillLight = new pc.Entity('fill-light');
  fillLight.addComponent('light', {
    type: 'directional',
    color: new pc.Color(0.6, 0.7, 1.0),
    intensity: 0.35,
  });
  fillLight.setEulerAngles(-20, -60, 0);
  app.root.addChild(fillLight);

  // --- Ambient ---
  app.scene.ambientLight = envTheme.ambient;

  // --- Content state ---
  let activeContent: SceneContent | null = null;
  const activeEntities: Record<string, pc.Entity> = {};
  let followableIds: string[] = [];

  function loadContent(content: SceneContent) {
    unloadContent();
    activeContent = content;
    for (const spec of content.entities) {
      const entity = buildEntity(app, spec);
      activeEntities[spec.id] = entity;
      app.root.addChild(entity);
    }
    followableIds = content.entities
      .filter((s) => s.followable)
      .map((s) => s.id);
    // Auto-select first followable target
    if (followableIds.length > 0 && !followTargetId) {
      followTargetId = followableIds[0];
    }
  }

  function unloadContent() {
    for (const entity of Object.values(activeEntities)) {
      entity.destroy();
    }
    for (const key of Object.keys(activeEntities)) {
      delete activeEntities[key];
    }
    activeContent = null;
    followableIds = [];
    followTargetId = null;
  }

  // --- Camera state ---
  let cameraMode: CameraMode = 'orbit';

  // Orbit parameters — start showing pyramid at origin and orbiting sphere
  let yaw = 30;
  let pitch = 20;
  let dist = 14;
  let tYaw = yaw;
  let tPitch = pitch;
  let tDist = dist;

  // Follow camera state
  let followTargetId: string | null = null;
  let followDist = 6;
  let followHeight = 3;
  const followPrevPos = new pc.Vec3();
  let followInitialized = false;

  // Input state
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    zoomIn: false,
    zoomOut: false,
    shift: false,
  };

  // Mouse input — deltas accumulated between frames, drained each update
  const mouseDelta = { x: 0, y: 0, zoom: 0 };
  let dragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    mouseDelta.x += e.clientX - lastPointerX;
    mouseDelta.y += e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
  }

  function onPointerUp(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    mouseDelta.zoom += e.deltaY;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  let time = 0;
  let prevEffectiveMode: CameraMode = 'orbit';

  let lookAtActive = false;
  let lookAtT = 0;
  let lookAtDuration = 0.3;
  const lookAtStartRot = new pc.Quat();
  const lookAtEndRot = new pc.Quat();

  function syncOrbitFromCamera() {
    const pos = camera.getPosition();
    dist = pos.length();
    tDist = dist;
    yaw = Math.atan2(pos.x, pos.z) * (180 / Math.PI);
    tYaw = yaw;
    pitch =
      Math.asin(Math.min(1, Math.max(-1, pos.y / dist))) * (180 / Math.PI);
    tPitch = pitch;
  }

  function startLookAt(duration = 1.0) {
    lookAtActive = true;
    lookAtT = 0;
    lookAtDuration = duration;
    lookAtStartRot.copy(camera.getRotation());
    const savedRot = camera.getRotation().clone();
    camera.lookAt(pc.Vec3.ZERO);
    lookAtEndRot.copy(camera.getRotation());
    camera.setRotation(savedRot);
  }

  function computeCompassAngle(): number {
    const pos = camera.getPosition();
    return Math.atan2(-pos.x, -pos.z) * (180 / Math.PI);
  }

  // --- Update loop ---
  app.on('update', (dt: number) => {
    time += dt;

    // Animate scene content entities
    if (activeContent) {
      const ctx: AnimationContext = { time, dt, entities: activeEntities };
      for (const spec of activeContent.entities) {
        const entity = activeEntities[spec.id];
        if (entity && spec.animate) {
          spec.animate(entity, ctx);
        }
      }
    }

    // Shift temporarily swaps orbit↔fly (does not affect follow)
    const effectiveMode =
      cameraMode === 'follow'
        ? 'follow'
        : input.shift
          ? cameraMode === 'orbit'
            ? 'fly'
            : 'orbit'
          : cameraMode;

    // On mode transition, sync state from actual camera position
    if (effectiveMode !== prevEffectiveMode) {
      if (effectiveMode === 'orbit') {
        syncOrbitFromCamera();
        startLookAt(1.0);
      }
      if (effectiveMode === 'follow') {
        followInitialized = false;
      }
      prevEffectiveMode = effectiveMode;
    }

    // Smooth look-at-origin animation
    if (lookAtActive) {
      lookAtT = Math.min(1, lookAtT + dt / lookAtDuration);
      const t = 1 - Math.pow(1 - lookAtT, 3); // ease-out cubic
      const q = new pc.Quat();
      q.slerp(lookAtStartRot, lookAtEndRot, t);
      camera.setRotation(q);
      if (lookAtT >= 1) {
        lookAtActive = false;
        syncOrbitFromCamera();
      }
    }

    if (effectiveMode === 'orbit') {
      updateOrbit(dt, lookAtActive);
    } else if (effectiveMode === 'fly') {
      updateFly(dt);
    } else if (effectiveMode === 'follow') {
      updateFollow(dt);
    }
  });

  function updateOrbit(dt: number, slerping = false) {
    const panSpeed = 80 * dt;
    const zoomSpeed = 4 * dt;

    if (input.up) tPitch = Math.min(85, tPitch + panSpeed);
    if (input.down) tPitch = Math.max(-85, tPitch - panSpeed);
    if (input.left) tYaw -= panSpeed;
    if (input.right) tYaw += panSpeed;
    if (input.zoomIn) tDist = Math.max(2, tDist - zoomSpeed);
    if (input.zoomOut) tDist = Math.min(20, tDist + zoomSpeed);

    if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
      const sensitivity = 0.3;
      tYaw -= mouseDelta.x * sensitivity;
      tPitch = Math.min(85, Math.max(-85, tPitch + mouseDelta.y * sensitivity));
      mouseDelta.x = 0;
      mouseDelta.y = 0;
    }

    if (mouseDelta.zoom !== 0) {
      tDist = Math.max(2, Math.min(20, tDist + mouseDelta.zoom * 0.01));
      mouseDelta.zoom = 0;
    }

    const lerp = Math.min(1, 8 * dt);
    yaw += (tYaw - yaw) * lerp;
    pitch += (tPitch - pitch) * lerp;
    dist += (tDist - dist) * lerp;

    const yr = yaw * pc.math.DEG_TO_RAD;
    const pr = pitch * pc.math.DEG_TO_RAD;
    const cx = dist * Math.cos(pr) * Math.sin(yr);
    const cy = dist * Math.sin(pr);
    const cz = dist * Math.cos(pr) * Math.cos(yr);

    camera.setPosition(cx, cy, cz);
    if (!slerping) {
      const sphereEntity = activeEntities['sphere'];
      const bobY = sphereEntity ? sphereEntity.getPosition().y * 0.5 : 0;
      camera.lookAt(new pc.Vec3(0, bobY, 0));
    }
  }

  function updateFly(dt: number) {
    const moveSpeed = 5 * dt;
    const fwd = camera.forward;
    const right = camera.right;
    const pos = camera.getPosition().clone();

    // W = forward (along camera forward), S = backward
    if (input.up) {
      pos.x += fwd.x * moveSpeed;
      pos.y += fwd.y * moveSpeed;
      pos.z += fwd.z * moveSpeed;
    }
    if (input.down) {
      pos.x -= fwd.x * moveSpeed;
      pos.y -= fwd.y * moveSpeed;
      pos.z -= fwd.z * moveSpeed;
    }
    if (input.left) {
      pos.x -= right.x * moveSpeed;
      pos.z -= right.z * moveSpeed;
    }
    if (input.right) {
      pos.x += right.x * moveSpeed;
      pos.z += right.z * moveSpeed;
    }
    if (input.zoomIn) pos.y += moveSpeed;
    if (input.zoomOut) pos.y -= moveSpeed;

    if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
      const sensitivity = 0.15;
      const angles = camera.getLocalEulerAngles();
      const newPitch = Math.min(
        89,
        Math.max(-89, angles.x - mouseDelta.y * sensitivity),
      );
      const newYaw = angles.y - mouseDelta.x * sensitivity;
      camera.setLocalEulerAngles(newPitch, newYaw, 0);
      mouseDelta.x = 0;
      mouseDelta.y = 0;
    }

    if (mouseDelta.zoom !== 0) {
      const scrollMove = mouseDelta.zoom * -0.02;
      pos.x += fwd.x * scrollMove;
      pos.y += fwd.y * scrollMove;
      pos.z += fwd.z * scrollMove;
      mouseDelta.zoom = 0;
    }

    camera.setPosition(pos);
  }

  function updateFollow(dt: number) {
    if (!followTargetId) return;
    const target = activeEntities[followTargetId];
    if (!target) return;

    const targetPos = target.getPosition();

    // Initialize previous position on first frame to avoid velocity spike
    if (!followInitialized) {
      followPrevPos.copy(targetPos);
      followInitialized = true;
    }

    // Zoom in/out adjusts follow distance
    const zoomSpeed = 4 * dt;
    if (input.zoomIn) followDist = Math.max(2, followDist - zoomSpeed);
    if (input.zoomOut) followDist = Math.min(20, followDist + zoomSpeed);
    if (mouseDelta.zoom !== 0) {
      followDist = Math.max(2, Math.min(20, followDist + mouseDelta.zoom * 0.01));
      mouseDelta.zoom = 0;
    }

    // Height adjust with W/S
    const heightSpeed = 3 * dt;
    if (input.up) followHeight = Math.min(12, followHeight + heightSpeed);
    if (input.down) followHeight = Math.max(0.5, followHeight - heightSpeed);

    // Compute velocity direction from frame-to-frame delta
    const dx = targetPos.x - followPrevPos.x;
    const dz = targetPos.z - followPrevPos.z;
    const speed = Math.sqrt(dx * dx + dz * dz);
    followPrevPos.copy(targetPos);

    // Offset: trail behind direction of travel, or fixed offset if nearly stationary
    let offsetX: number;
    let offsetZ: number;
    if (speed > 0.001) {
      // Normalize and scale to follow distance
      const invSpeed = 1 / speed;
      offsetX = -dx * invSpeed * followDist;
      offsetZ = -dz * invSpeed * followDist;
    } else {
      // Fixed offset when target is stationary
      offsetX = 0;
      offsetZ = -followDist;
    }

    const desiredX = targetPos.x + offsetX;
    const desiredY = targetPos.y + followHeight;
    const desiredZ = targetPos.z + offsetZ;

    // Smooth camera position with damping
    const lerp = Math.min(1, 3 * dt);
    const camPos = camera.getPosition();
    camera.setPosition(
      camPos.x + (desiredX - camPos.x) * lerp,
      camPos.y + (desiredY - camPos.y) * lerp,
      camPos.z + (desiredZ - camPos.z) * lerp,
    );

    // Drain unused mouse deltas
    mouseDelta.x = 0;
    mouseDelta.y = 0;

    camera.lookAt(targetPos);
  }

  // --- Resize ---
  const onResize = () => app.resizeCanvas();
  window.addEventListener('resize', onResize);

  // --- Start ---
  app.start();

  // --- Controller ---
  return {
    setTheme(t: 'light' | 'dark') {
      const env = ENV_THEMES[t];
      camera.camera!.clearColor = env.clear;
      app.scene.ambientLight = env.ambient;
      activeContent?.onThemeChange?.(t, activeEntities);
    },

    toggleCameraMode() {
      cameraMode = cameraMode === 'orbit' ? 'fly' : 'orbit';
      prevEffectiveMode = cameraMode;
      if (cameraMode === 'orbit') {
        syncOrbitFromCamera();
      }
      return cameraMode;
    },

    setCameraMode(mode: CameraMode) {
      cameraMode = mode;
      prevEffectiveMode = mode;
      if (mode === 'orbit') {
        syncOrbitFromCamera();
      }
      if (mode === 'follow') {
        followInitialized = false;
        // Auto-select first followable if none selected
        if (!followTargetId && followableIds.length > 0) {
          followTargetId = followableIds[0];
        }
      }
    },

    getCameraMode() {
      return cameraMode;
    },

    setInput(action: string, active: boolean) {
      switch (action) {
        case 'pan_up':
          input.up = active;
          break;
        case 'pan_down':
          input.down = active;
          break;
        case 'pan_left':
          input.left = active;
          break;
        case 'pan_right':
          input.right = active;
          break;
        case 'zoom_in':
          input.zoomIn = active;
          break;
        case 'zoom_out':
          input.zoomOut = active;
          break;
        case 'shift':
          input.shift = active;
          break;
      }
    },

    lookAtOrigin() {
      startLookAt();
    },

    getCompassAngle() {
      return computeCompassAngle();
    },

    getFollowableEntities() {
      return [...followableIds];
    },

    getFollowTarget() {
      return followTargetId;
    },

    cycleFollowTarget() {
      if (followableIds.length === 0) return null;
      const currentIdx = followTargetId
        ? followableIds.indexOf(followTargetId)
        : -1;
      const nextIdx = (currentIdx + 1) % followableIds.length;
      followTargetId = followableIds[nextIdx];
      followInitialized = false;
      return followTargetId;
    },

    loadContent,
    unloadContent,

    destroy() {
      unloadContent();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      app.destroy();
    },
  };
}
