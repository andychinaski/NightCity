export const MOTION_SETTINGS = Object.freeze({
  routeSpeed: { label: 'Скорость автомобиля', unit: 'ед./с', initial: 5, min: 1, max: 12, step: 0.1 },
  routeRamp: { label: 'Разгон и остановка (Hybrid)', unit: 'с', initial: 0.35, startup: 0.40, min: 0.15, max: 1.5, step: 0.05 },
  forwardFrameSpeed: { label: 'Прямой горизонтальный сдвиг', unit: '% кадра/с', initial: 30, startup: 60, min: 5, max: 60, step: 0.5 },
  backwardFrameSpeed: { label: 'Обратный сдвиг (Hybrid)', unit: '% кадра/с', initial: 7.5, startup: 60, min: 0.5, max: 120, step: 0.5 },
  horizontalResponse: { label: 'Плавность по горизонтали', unit: 'с', initial: 0.10, startup: 0.05, min: 0.05, max: 0.50, step: 0.01 },
  verticalResponse: { label: 'Плавность по вертикали', unit: 'с', initial: 0.10, min: 0.05, max: 0.40, step: 0.01 },
});

export const DEFAULT_MOTION_SETTINGS = Object.freeze(Object.fromEntries(
  Object.entries(MOTION_SETTINGS).map(([name, parameter]) => [name, parameter.initial]),
));

export const EXPERIMENT_MOTION_SETTINGS = Object.freeze(Object.fromEntries(
  Object.entries(MOTION_SETTINGS).map(([name, parameter]) => [name, parameter.startup ?? parameter.initial]),
));

export function normalizeMotionSetting(name, value) {
  if (!Object.hasOwn(MOTION_SETTINGS, name) || !Number.isFinite(value)) return undefined;
  const { min, max } = MOTION_SETTINGS[name];
  return Math.max(min, Math.min(max, value));
}
