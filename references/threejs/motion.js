import { DEFAULT_MOTION_SETTINGS, EXPERIMENT_MOTION_SETTINGS, normalizeMotionSetting } from './motion-settings.js';

const PRESET = DEFAULT_MOTION_SETTINGS;
export const SEGMENT_LENGTH = 60;
export const CAMERA_HEIGHT = 3.2;
export const CAMERA_DISTANCE = 11;
export const CAMERA_FOV = 40;
export const FIXED_PITCH = 11 * Math.PI / 180;
export const OFFSET_LIMITS = { x: 2, y: 1 };

// Both modes frame the same height on the car at the neutral camera position.
const AIM_HEIGHT = CAMERA_HEIGHT - CAMERA_DISTANCE * Math.tan(FIXED_PITCH);
const SPATIAL_SPEED_AT_PRESET = 4;
const PLAYBACK_X_LIMIT = 1;
const FRAME_LIMIT = 20;
const CAR_REFERENCE_HEIGHT = 0.65;
const CAR_REFERENCE_DEPTH = CAMERA_DISTANCE * Math.cos(FIXED_PITCH)
  + (CAMERA_HEIGHT - CAR_REFERENCE_HEIGHT) * Math.sin(FIXED_PITCH);
const WORLD_UNITS_PER_FRAME_PERCENT = 2 * Math.tan(CAMERA_FOV * Math.PI / 360)
  * (16 / 9) * CAR_REFERENCE_DEPTH / 100;
const MIN_PLAYBACK_SPEED_FRACTION = 0.8;
const SPATIAL_BACK_SHARE = 1 - MIN_PLAYBACK_SPEED_FRACTION;
const SPATIAL_LIMIT = Math.max(OFFSET_LIMITS.x, 2 * FRAME_LIMIT * WORLD_UNITS_PER_FRAME_PERCENT);
const PITCH_RESPONSE = 0.14;

export function createMotion(requested = PRESET) {
  const settings = Object.fromEntries(Object.entries(PRESET).map(([name, value]) => (
    [name, normalizeMotionSetting(name, requested[name]) ?? value]
  )));
  return {
    time: 0,
    playing: false,
    mode: 'fixed',
    horizontalMode: 'position',
    horizontalInput: 0,
    hybridPauseFrame: 0,
    routeSpeed: 0,
    settings,
    horizontalResponse: settings.horizontalResponse,
    verticalResponse: settings.verticalResponse,
    hybridLimit: null,
    activeHybridLimit: null,
    routeLimited: false,
    targetY: 0,
    offset: { x: 0, y: 0, frame: 0 },
    horizontalGuide: { x: 0, frame: 0 },
    verticalVelocity: 0,
    pitch: FIXED_PITCH,
  };
}

export function setMotionSetting(state, name, value) {
  const normalized = normalizeMotionSetting(name, value);
  if (normalized !== undefined) state.settings[name] = normalized;
}

export function resetMotionSettings(state) {
  Object.assign(state.settings, EXPERIMENT_MOTION_SETTINGS);
}

export function horizontalRange(state) {
  if (state.horizontalMode !== 'position') return FRAME_LIMIT;
  return state.playing ? PLAYBACK_X_LIMIT : OFFSET_LIMITS.x;
}

export function setHorizontalInput(state, value) {
  if (!Number.isFinite(value)) return;
  state.horizontalInput = Math.max(-1, Math.min(1, value / horizontalRange(state)));
}

export function horizontalTargets(state) {
  const command = state.horizontalInput * horizontalRange(state);
  if (state.horizontalMode === 'position') return { x: command, frame: 0 };
  if (state.horizontalMode === 'frame' || state.playing) return { x: 0, frame: command };
  // Retain the composition at pause. Each subsequent input step moves in world space.
  return {
    x: (command - state.hybridPauseFrame) * WORLD_UNITS_PER_FRAME_PERCENT,
    frame: state.hybridPauseFrame,
  };
}

export function setHorizontalMode(state, mode) {
  if (state.horizontalMode === mode) return;
  state.horizontalMode = mode;
  if (mode === 'hybrid' && !state.playing) state.hybridPauseFrame = state.offset.frame;
}

export function resetHorizontal(state) {
  setHorizontalInput(state, 0);
  state.hybridPauseFrame = 0;
}

function advanceHorizontal(state, axis, target, forwardSpeed, backwardSpeed, dt) {
  const guide = state.horizontalGuide[axis];
  const remaining = target - guide;
  const speed = remaining < 0 ? -backwardSpeed : forwardSpeed;
  const travelTime = speed === 0 ? 0 : Math.min(dt, remaining / speed);
  const response = state.horizontalResponse;

  // Follow a rate-limited guide. Integrate its moving and stationary portions separately.
  const blend = -Math.expm1(-travelTime / response);
  state.offset[axis] += (guide - state.offset[axis]) * blend
    + speed * (travelTime - response * blend);
  state.horizontalGuide[axis] = guide + speed * travelTime;
  const settleBlend = -Math.expm1(-(dt - travelTime) / response);
  state.offset[axis] += (state.horizontalGuide[axis] - state.offset[axis]) * settleBlend;
}

function offsetSpeed(state, axis) {
  return (state.horizontalGuide[axis] - state.offset[axis]) / state.horizontalResponse;
}

function responseWithinTravel(offset, speed, limit) {
  if (Math.abs(speed) < 1e-8) return Infinity;
  return (limit - Math.sign(speed) * offset) / Math.abs(speed);
}

function updateResponses(state) {
  if (state.horizontalResponse !== state.settings.horizontalResponse) {
    const xSpeed = offsetSpeed(state, 'x');
    const frameSpeed = offsetSpeed(state, 'frame');
    const response = Math.min(state.settings.horizontalResponse,
      responseWithinTravel(state.offset.x, xSpeed, SPATIAL_LIMIT),
      responseWithinTravel(state.offset.frame, frameSpeed, FRAME_LIMIT));
    if (response > 0) {
      // Rebase the guides so changing time constants preserves instantaneous velocity.
      state.horizontalGuide.x = state.offset.x + xSpeed * response;
      state.horizontalGuide.frame = state.offset.frame + frameSpeed * response;
      state.horizontalResponse = response;
    }
  }
  if (state.verticalResponse !== state.settings.verticalResponse) {
    const response = Math.min(state.settings.verticalResponse,
      responseWithinTravel(state.offset.y, state.verticalVelocity, OFFSET_LIMITS.y));
    if (response > 0) state.verticalResponse = response;
  }
}

function minimumRouteSpeed(state) {
  const opposingX = Math.max(0, -offsetSpeed(state, 'x'));
  return opposingX / SPATIAL_BACK_SHARE;
}

function advanceRoute(state, dt) {
  const desiredSpeed = state.playing ? state.settings.routeSpeed : 0;
  const previousSpeed = state.routeSpeed;
  // Let existing opposing motion subside before a live reduction of route speed.
  const target = state.playing && desiredSpeed < previousSpeed
    ? Math.max(desiredSpeed, Math.min(previousSpeed, minimumRouteSpeed(state))) : desiredSpeed;
  state.routeLimited = target > desiredSpeed + 0.005;
  if (target === previousSpeed) {
    state.time += previousSpeed * dt / PRESET.routeSpeed;
    return;
  }
  const acceleration = Math.max(previousSpeed, state.settings.routeSpeed) / state.settings.routeRamp;
  const timeToTarget = Math.abs(target - previousSpeed) / acceleration;
  const rampTime = Math.min(dt, timeToTarget);
  state.routeSpeed = rampTime === timeToTarget
    ? target : previousSpeed + Math.sign(target - previousSpeed) * acceleration * rampTime;
  state.time += ((previousSpeed + state.routeSpeed) * rampTime / 2 + target * (dt - rampTime)) / PRESET.routeSpeed;
}

function guideTravelTime(distance, speed) {
  if (distance === 0) return 0;
  return speed > 0 ? Math.abs(distance) / speed : Infinity;
}

function advanceHybridPlayback(state, targets, spatialSpeed, dt) {
  const xDistance = targets.x - state.horizontalGuide.x;
  const frameDistance = targets.frame - state.horizontalGuide.frame;
  const guideRouteSpeed = Math.min(state.routeSpeed, state.settings.routeSpeed);
  const xBack = Math.min(spatialSpeed, guideRouteSpeed * SPATIAL_BACK_SHARE);
  const frameBack = state.settings.backwardFrameSpeed;
  const xSpeed = xDistance < 0 ? xBack : spatialSpeed;
  const frameSpeed = frameDistance < 0 ? frameBack : state.settings.forwardFrameSpeed;
  // Give both guides the same arrival time so exchanging offsets preserves the car framing.
  const duration = Math.max(guideTravelTime(xDistance, xSpeed), guideTravelTime(frameDistance, frameSpeed));
  const backApplied = frameDistance < -1e-9 && Number.isFinite(duration)
    ? Math.min(frameBack, Math.abs(frameDistance) / duration) : frameBack;
  const reason = backApplied < frameBack - 1e-9 ? 'exchange' : 'requested';
  state.hybridLimit = { rate: backApplied, reason };
  if (frameDistance < -1e-9) state.activeHybridLimit = state.hybridLimit;
  if (frameDistance > 1e-9) {
    const applied = Math.min(frameSpeed, Math.abs(frameDistance) / duration);
    state.activeHybridLimit = {
      rate: applied, reason: applied < frameSpeed - 1e-9 ? 'exchange' : 'requested', forward: true,
    };
  }
  if (duration === 0 || !Number.isFinite(duration)) {
    advanceHorizontal(state, 'x', state.horizontalGuide.x, 0, 0, dt);
    advanceHorizontal(state, 'frame', state.horizontalGuide.frame, 0, 0, dt);
    return;
  }
  const sharedX = xDistance === 0 ? xSpeed : Math.abs(xDistance) / duration;
  const sharedFrame = frameDistance === 0 ? frameSpeed : Math.abs(frameDistance) / duration;
  advanceHorizontal(state, 'x', targets.x, sharedX, sharedX, dt);
  advanceHorizontal(state, 'frame', targets.frame, sharedFrame, sharedFrame, dt);
}

export function advanceMotion(state, dt) {
  updateResponses(state);
  advanceRoute(state, dt);

  // Retire the previous mode's offset using the same smoothing as normal input.
  const targets = horizontalTargets(state);
  const { forwardFrameSpeed } = state.settings;
  const spatialSpeed = SPATIAL_SPEED_AT_PRESET * forwardFrameSpeed / PRESET.forwardFrameSpeed;
  state.hybridLimit = null;
  state.activeHybridLimit = null;
  if (state.horizontalMode === 'hybrid' && state.playing) {
    advanceHybridPlayback(state, targets, spatialSpeed, dt);
  } else {
    const guideRouteSpeed = Math.min(state.routeSpeed, state.settings.routeSpeed);
    const backwardX = state.playing ? Math.min(spatialSpeed, guideRouteSpeed * SPATIAL_BACK_SHARE) : spatialSpeed;
    advanceHorizontal(state, 'x', targets.x, spatialSpeed, backwardX, dt);
    advanceHorizontal(state, 'frame', targets.frame, forwardFrameSpeed, forwardFrameSpeed, dt);
  }

  const verticalResponse = state.verticalResponse;
  const verticalDecay = Math.exp(-dt / verticalResponse);
  const verticalError = state.offset.y - state.targetY;
  const verticalGradient = state.verticalVelocity + verticalError / verticalResponse;
  state.offset.y = state.targetY + (verticalError + verticalGradient * dt) * verticalDecay;
  state.verticalVelocity = (state.verticalVelocity - verticalGradient * dt / verticalResponse) * verticalDecay;

  const desiredPitch = state.mode === 'tracking'
    ? Math.atan2(CAMERA_HEIGHT + state.offset.y - AIM_HEIGHT, CAMERA_DISTANCE)
    : FIXED_PITCH;
  state.pitch += (desiredPitch - state.pitch) * -Math.expm1(-dt / PITCH_RESPONSE);
}

export function togglePlayback(state) {
  const { x, frame } = horizontalTargets(state);
  state.playing = !state.playing;
  if (state.horizontalMode === 'hybrid') {
    if (!state.playing) state.hybridPauseFrame = frame;
    return;
  }
  state.routeSpeed = state.playing ? state.settings.routeSpeed : 0;
  if (state.horizontalMode === 'position') setHorizontalInput(state, x);
  if (state.playing) {
    // Apply the world-speed floor immediately, preserving the visible pose.
    const minimumX = state.offset.x - state.routeSpeed * SPATIAL_BACK_SHARE * state.horizontalResponse;
    state.horizontalGuide.x = Math.max(state.horizontalGuide.x, minimumX);
  }
}

export function carSpeed(state) {
  return state.routeSpeed;
}

export function cameraSpeedX(state) {
  return carSpeed(state) + offsetSpeed(state, 'x');
}

export function motionDiagnostics(state) {
  return {
    spatialRate: offsetSpeed(state, 'x'),
    frameRate: offsetSpeed(state, 'frame'),
    hybridLimit: state.hybridLimit,
    activeHybridLimit: state.activeHybridLimit,
    routeLimited: state.routeLimited,
    horizontalResponse: state.horizontalResponse,
    verticalResponse: state.verticalResponse,
  };
}

export function routePosition(state) {
  const distance = state.time * PRESET.routeSpeed;
  return { distance, localX: distance % SEGMENT_LENGTH };
}

export function cameraPose(state, carX) {
  return {
    x: carX + state.offset.x,
    y: CAMERA_HEIGHT + state.offset.y,
    z: CAMERA_DISTANCE,
    pitch: state.pitch,
    frame: state.offset.frame,
  };
}
