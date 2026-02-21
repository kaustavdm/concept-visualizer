import * as pc from 'playcanvas';

export type CameraMode = 'orbit' | 'fly';

export interface SceneController {
  setTheme(theme: 'light' | 'dark'): void;
  toggleCameraMode(): CameraMode;
  setCameraMode(mode: CameraMode): void;
  getCameraMode(): CameraMode;
  setInput(action: string, active: boolean): void;
  lookAtOrigin(): void;
  getCompassAngle(): number;
  destroy(): void;
}

interface ThemeColors {
  clear: pc.Color;
  ambient: pc.Color;
  diffuse: pc.Color;
  emissive: pc.Color;
  specular: pc.Color;
}

const THEMES: Record<string, ThemeColors> = {
  light: {
    clear: new pc.Color(0.92, 0.93, 0.95),
    ambient: new pc.Color(0.5, 0.5, 0.55),
    diffuse: new pc.Color(0.23, 0.51, 0.96),
    emissive: new pc.Color(0.03, 0.06, 0.15),
    specular: new pc.Color(0.5, 0.6, 0.8),
  },
  dark: {
    clear: new pc.Color(0.01, 0.02, 0.06),
    ambient: new pc.Color(0.08, 0.08, 0.12),
    diffuse: new pc.Color(0.25, 0.5, 1.0),
    emissive: new pc.Color(0.06, 0.1, 0.25),
    specular: new pc.Color(0.4, 0.5, 0.9),
  },
};

export function createScene(
  canvas: HTMLCanvasElement,
  initialTheme: 'light' | 'dark',
): SceneController {
  const app = new pc.Application(canvas, {});

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  const theme = THEMES[initialTheme];

  // --- Camera ---
  const camera = new pc.Entity('camera');
  camera.addComponent('camera', {
    clearColor: theme.clear,
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

  // --- Sphere ---
  const sphereMat = new pc.StandardMaterial();
  sphereMat.diffuse = theme.diffuse;
  sphereMat.emissive = theme.emissive;
  sphereMat.specular = theme.specular;
  sphereMat.metalness = 0.3;
  sphereMat.gloss = 0.75;
  sphereMat.useMetalness = true;
  sphereMat.update();

  const sphere = new pc.Entity('sphere');
  sphere.addComponent('render', { type: 'sphere' });
  sphere.render!.meshInstances[0].material = sphereMat;
  sphere.setLocalScale(1.5, 1.5, 1.5);
  app.root.addChild(sphere);

  // --- Ambient ---
  app.scene.ambientLight = theme.ambient;

  // --- Camera state ---
  let cameraMode: CameraMode = 'orbit';

  // Orbit parameters
  let yaw = 30;
  let pitch = 20;
  let dist = 6;
  let tYaw = yaw;
  let tPitch = pitch;
  let tDist = dist;

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
    if (e.button !== 0) return; // left button only
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
  const lookAtStartRot = new pc.Quat();
  const lookAtEndRot = new pc.Quat();

  // Sync orbit parameters from the camera's current position
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

  function startLookAt() {
    lookAtActive = true;
    lookAtT = 0;
    lookAtStartRot.copy(camera.getRotation());
    // Temporarily point camera at origin to capture target rotation
    const savedRot = camera.getRotation().clone();
    camera.lookAt(pc.Vec3.ZERO);
    lookAtEndRot.copy(camera.getRotation());
    camera.setRotation(savedRot);
  }

  function computeCompassAngle(): number {
    const pos = camera.getPosition();
    // XZ-plane bearing from camera position toward origin
    // Rotates naturally as camera orbits around the scene center
    return Math.atan2(-pos.x, -pos.z) * (180 / Math.PI);
  }

  // --- Update loop ---
  app.on('update', (dt: number) => {
    time += dt;

    // Bobbing sphere
    const bobY = Math.sin(time * 0.8) * 0.25;
    sphere.setPosition(0, bobY, 0);
    sphere.setLocalEulerAngles(0, time * 12, Math.sin(time * 0.5) * 5);

    // Shift temporarily activates the other mode
    const effectiveMode = input.shift
      ? cameraMode === 'orbit'
        ? 'fly'
        : 'orbit'
      : cameraMode;

    // On mode transition, sync state from actual camera position
    if (effectiveMode !== prevEffectiveMode) {
      if (effectiveMode === 'orbit') {
        syncOrbitFromCamera();
      }
      // orbit→fly needs no sync: fly reads camera position directly
      prevEffectiveMode = effectiveMode;
    }

    // Smooth look-at-origin animation
    if (lookAtActive) {
      lookAtT = Math.min(1, lookAtT + dt / 0.3);
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
      updateOrbit(dt, bobY);
    } else {
      updateFly(dt);
    }
  });

  function updateOrbit(dt: number, bobY: number) {
    const panSpeed = 80 * dt;
    const zoomSpeed = 4 * dt;

    // Keyboard input
    if (input.up) tPitch = Math.min(85, tPitch + panSpeed);
    if (input.down) tPitch = Math.max(-85, tPitch - panSpeed);
    if (input.left) tYaw -= panSpeed;
    if (input.right) tYaw += panSpeed;
    if (input.zoomIn) tDist = Math.max(2, tDist - zoomSpeed);
    if (input.zoomOut) tDist = Math.min(20, tDist + zoomSpeed);

    // Mouse drag → orbit rotation
    if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
      const sensitivity = 0.3;
      tYaw -= mouseDelta.x * sensitivity;
      tPitch = Math.min(85, Math.max(-85, tPitch + mouseDelta.y * sensitivity));
      mouseDelta.x = 0;
      mouseDelta.y = 0;
    }

    // Mouse wheel → zoom
    if (mouseDelta.zoom !== 0) {
      tDist = Math.max(2, Math.min(20, tDist + mouseDelta.zoom * 0.01));
      mouseDelta.zoom = 0;
    }

    // Smooth interpolation
    const lerp = Math.min(1, 8 * dt);
    yaw += (tYaw - yaw) * lerp;
    pitch += (tPitch - pitch) * lerp;
    dist += (tDist - dist) * lerp;

    // Spherical to cartesian
    const yr = yaw * pc.math.DEG_TO_RAD;
    const pr = pitch * pc.math.DEG_TO_RAD;
    const cx = dist * Math.cos(pr) * Math.sin(yr);
    const cy = dist * Math.sin(pr);
    const cz = dist * Math.cos(pr) * Math.cos(yr);

    camera.setPosition(cx, cy, cz);
    camera.lookAt(new pc.Vec3(0, bobY * 0.5, 0));
  }

  function updateFly(dt: number) {
    const moveSpeed = 5 * dt;
    const fwd = camera.forward;
    const right = camera.right;
    const pos = camera.getPosition().clone();

    // Keyboard input
    if (input.up) {
      pos.x -= fwd.x * moveSpeed;
      pos.y -= fwd.y * moveSpeed;
      pos.z -= fwd.z * moveSpeed;
    }
    if (input.down) {
      pos.x += fwd.x * moveSpeed;
      pos.y += fwd.y * moveSpeed;
      pos.z += fwd.z * moveSpeed;
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

    // Mouse drag → mouselook (yaw + pitch rotation)
    if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
      const sensitivity = 0.15;
      const angles = camera.getLocalEulerAngles();
      const newPitch = Math.min(89, Math.max(-89, angles.x - mouseDelta.y * sensitivity));
      const newYaw = angles.y - mouseDelta.x * sensitivity;
      camera.setLocalEulerAngles(newPitch, newYaw, 0);
      mouseDelta.x = 0;
      mouseDelta.y = 0;
    }

    // Mouse wheel → move forward/back
    if (mouseDelta.zoom !== 0) {
      const scrollMove = mouseDelta.zoom * -0.02;
      pos.x -= fwd.x * scrollMove;
      pos.y -= fwd.y * scrollMove;
      pos.z -= fwd.z * scrollMove;
      mouseDelta.zoom = 0;
    }

    camera.setPosition(pos);
  }

  // --- Resize ---
  const onResize = () => app.resizeCanvas();
  window.addEventListener('resize', onResize);

  // --- Start ---
  app.start();

  // --- Controller ---
  return {
    setTheme(t: 'light' | 'dark') {
      const c = THEMES[t];
      camera.camera!.clearColor = c.clear;
      app.scene.ambientLight = c.ambient;
      sphereMat.diffuse = c.diffuse;
      sphereMat.emissive = c.emissive;
      sphereMat.specular = c.specular;
      sphereMat.update();
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

    destroy() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      app.destroy();
    },
  };
}
