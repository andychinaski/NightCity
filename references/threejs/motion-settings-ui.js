import { MOTION_SETTINGS } from './motion-settings.js';
import { resetMotionSettings, setMotionSetting } from './motion.js';

const limiterDescriptions = {
  requested: 'Заданный предел',
  exchange: 'Согласование X и кадра',
};
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const format = (value, unit) => `${number.format(value)} ${unit}`;

export function hybridLimiterText(limit) {
  if (!limit) return 'Нет активного ограничения';
  return `${format(limit.rate, '% кадра/с')} · ${limiterDescriptions[limit.reason]}`;
}

export function mountMotionSettings(state) {
  const container = document.querySelector('#motion-fields');
  const fields = Object.fromEntries(Object.entries(MOTION_SETTINGS).map(([name, parameter]) => {
    const id = `motion-${name}`;
    const field = document.createElement('div');
    field.className = 'motion-field';
    const label = document.createElement('label');
    label.className = 'range';
    label.htmlFor = id;
    const title = document.createElement('span');
    title.textContent = parameter.label;
    const output = document.createElement('output');
    output.setAttribute('for', id);
    output.setAttribute('aria-live', 'off');
    label.append(title, output);
    const input = document.createElement('input');
    Object.assign(input, {
      id, type: 'range', min: parameter.min, max: parameter.max,
      step: parameter.step, value: state.settings[name],
    });
    const note = document.createElement('p');
    note.className = 'setting-note';
    note.id = `${id}-note`;
    input.setAttribute('aria-describedby', note.id);
    field.append(label, input, note);
    container.append(field);

    const sync = () => {
      input.value = state.settings[name];
      output.value = format(state.settings[name], parameter.unit);
      input.setAttribute('aria-valuetext', output.value);
    };
    input.addEventListener('input', () => {
      setMotionSetting(state, name, input.valueAsNumber);
      sync();
    });
    sync();
    return [name, { sync, note }];
  }));

  document.querySelector('#reset-motion-settings').addEventListener('click', () => {
    resetMotionSettings(state);
    for (const { sync } of Object.values(fields)) sync();
  });

  const describe = (name, message) => {
    const { note } = fields[name];
    if (note.textContent !== message) note.textContent = message;
  };

  return diagnostics => {
    describe('routeSpeed', diagnostics.routeLimited
      ? `Сейчас ${format(state.routeSpeed, 'ед./с')} · замедление ждёт снижения ручной скорости по X`
      : `Сейчас ${format(state.routeSpeed, 'ед./с')}`);
    describe('routeRamp', 'В Hybrid и при изменении скорости на ходу.');
    const activeLimit = diagnostics.activeHybridLimit;
    describe('forwardFrameSpeed', activeLimit?.forward && activeLimit.reason === 'exchange'
      ? hybridLimiterText(activeLimit) : 'Также задаёт темп ручного X на паузе.');
    describe('backwardFrameSpeed', diagnostics.hybridLimit
      ? hybridLimiterText(diagnostics.hybridLimit) : 'Действует при проезде в режиме Hybrid.');
    for (const name of ['horizontalResponse', 'verticalResponse']) {
      const used = diagnostics[name];
      describe(name, used < state.settings[name] - 1e-6
        ? `Сейчас ${format(used, 'с')} · запас до края смещения` : '');
    }
  };
}
