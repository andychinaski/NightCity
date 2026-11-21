import { PerspectiveCamera, WebGLRenderer } from 'three';
import { applyCameraPose } from './camera.js';
import { createScene } from './scene.js';
import { loadSceneTextures } from './scene-textures.js';
import {
  advanceMotion, cameraPose, cameraSpeedX, CAMERA_FOV, carSpeed, createMotion, OFFSET_LIMITS,
  horizontalRange, horizontalTargets, motionDiagnostics, resetHorizontal, routePosition, SEGMENT_LENGTH,
  setHorizontalInput, setHorizontalMode, togglePlayback,
} from './motion.js';
import { hybridLimiterText, mountMotionSettings } from './motion-settings-ui.js';
import { EXPERIMENT_MOTION_SETTINGS } from './motion-settings.js';
import './style.css';

const viewport = document.querySelector('#viewport');
const playback = document.querySelector('#playback');
const progress = document.querySelector('#progress');
const state = createMotion(EXPERIMENT_MOTION_SETTINGS);
const modeLabels = { position: 'Position X', frame: 'Frame Offset', hybrid: 'Hybrid' };
const sliders = {
  x: document.querySelector('#horizontal'),
  y: document.querySelector('#vertical'),
};
const outputs = {
  x: document.querySelector('#horizontal-value'),
  y: document.querySelector('#vertical-value'),
  car: document.querySelector('#car-position'),
  camera: document.querySelector('#camera-position'),
  horizontalMode: document.querySelector('#horizontal-mode'),
  carSpeed: document.querySelector('#car-speed'),
  speed: document.querySelector('#camera-speed'),
  spatialRate: document.querySelector('#spatial-rate'),
  framingRate: document.querySelector('#framing-rate'),
  hybridLimiter: document.querySelector('#hybrid-limiter'),
  offsetX: document.querySelector('#camera-offset-x'),
  offsetY: document.querySelector('#camera-offset-y'),
  frame: document.querySelector('#camera-frame'),
  pitch: document.querySelector('#camera-pitch'),
  time: document.querySelector('#time'),
};

function write(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function decimal(value) {
  const rounded = value.toFixed(2);
  return rounded === '-0.00' ? '0.00' : rounded;
}

function coordinates(...values) {
  return values.map(decimal).join(' / ');
}

async function start() {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Небо, дальний силуэт, средний город, улица с автомобилем и столбы переднего плана');
  viewport.append(renderer.domElement);

  const textures = await loadSceneTextures(renderer);
  const { scene, car, sky, updateCarFrame } = createScene(textures);
  const camera = new PerspectiveCamera(CAMERA_FOV, 16 / 9, 0.1, 120);
  const cameraModes = document.querySelectorAll('input[name="mode"]');
  const horizontalModes = document.querySelectorAll('input[name="horizontal-mode"]');
  const horizontalLabel = document.querySelector('#horizontal-label');
  const reset = document.querySelector('#reset-camera');
  const renderMotionSettings = mountMotionSettings(state);
  progress.max = SEGMENT_LENGTH;

  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  new ResizeObserver(resize).observe(viewport);
  resize();

  function syncHorizontalSlider() {
    const limit = horizontalRange(state);
    sliders.x.min = -limit;
    sliders.x.max = limit;
    sliders.x.value = state.horizontalInput * limit;
    horizontalLabel.textContent = state.horizontalMode === 'position' ? 'Смещение по X' : 'Композиция по X';
  }
  setHorizontalMode(state, document.querySelector('input[name="horizontal-mode"]:checked').value);
  syncHorizontalSlider();
  sliders.x.addEventListener('input', () => setHorizontalInput(state, sliders.x.valueAsNumber));
  sliders.y.min = -OFFSET_LIMITS.y;
  sliders.y.max = OFFSET_LIMITS.y;
  sliders.y.addEventListener('input', () => {
    state.targetY = sliders.y.valueAsNumber;
  });
  for (const radio of cameraModes) {
    radio.addEventListener('change', () => {
      if (radio.checked) state.mode = radio.value;
    });
  }
  for (const radio of horizontalModes) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      setHorizontalMode(state, radio.value);
      syncHorizontalSlider();
    });
  }
  playback.addEventListener('click', () => {
    togglePlayback(state);
    syncHorizontalSlider();
  });
  reset.addEventListener('click', () => {
    resetHorizontal(state);
    state.targetY = 0;
    sliders.x.value = '0';
    sliders.y.value = '0';
  });

  let previous = null;
  renderer.setAnimationLoop(now => {
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    advanceMotion(state, dt);
    const { distance, localX } = routePosition(state);
    const pose = cameraPose(state, localX);
    car.position.x = localX;
    updateCarFrame?.(state.time);
    applyCameraPose(camera, pose);
    sky.position.x = pose.x;
    renderer.render(scene, camera);

    write(playback, state.playing ? 'Пауза' : 'Воспроизвести');
    if (progress.value !== localX) progress.value = localX;
    write(outputs.time, `${state.time.toFixed(1)} с`);
    const targets = horizontalTargets(state);
    const sliderValue = state.horizontalInput * horizontalRange(state);
    write(outputs.x, state.horizontalMode === 'position' ? decimal(sliderValue) : `${decimal(sliderValue)}%`);
    write(outputs.y, decimal(state.targetY));
    write(outputs.car, coordinates(distance, car.position.y, car.position.z));
    write(outputs.camera, coordinates(distance + state.offset.x, pose.y, pose.z));
    write(outputs.horizontalMode, modeLabels[state.horizontalMode]);
    write(outputs.carSpeed, `${decimal(carSpeed(state))} ед./с`);
    write(outputs.speed, `${decimal(cameraSpeedX(state))} ед./с`);
    const diagnostics = motionDiagnostics(state);
    write(outputs.spatialRate, `${decimal(diagnostics.spatialRate)} ед./с`);
    write(outputs.framingRate, `${decimal(diagnostics.frameRate)} % кадра/с`);
    write(outputs.hybridLimiter, hybridLimiterText(diagnostics.activeHybridLimit));
    renderMotionSettings(diagnostics);
    write(outputs.offsetX, coordinates(targets.x, state.offset.x));
    write(outputs.offsetY, decimal(state.offset.y));
    write(outputs.frame, `${decimal(targets.frame)}% / ${decimal(state.offset.frame)}%`);
    write(outputs.pitch, `${(pose.pitch * 180 / Math.PI).toFixed(1)}°`);
  });
}

start().catch(error => {
  console.error(error);
  const message = document.querySelector('#scene-error');
  message.textContent = 'Сцена не запустилась. Проверьте, доступен ли WebGL 2 в браузере.';
  message.hidden = false;
  for (const control of document.querySelectorAll('button, input')) control.disabled = true;
});
