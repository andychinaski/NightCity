// UI, audio and playback. No scene geometry or drawing logic here.
(function (app) {
  'use strict';

  function createControls({ onPlaybackChange }) {
    const track = document.querySelector('#track');
    const music = document.querySelector('#music');
    const playback = document.querySelector('#playback');
    const status = document.querySelector('#status');
    const horizontal = document.querySelector('#horizontal');
    const vertical = document.querySelector('#vertical');
    const speed = document.querySelector('#speed');

    for (const [input, selector, suffix] of [
      [horizontal, '#x-value', ''],
      [vertical, '#y-value', ''],
      [speed, '#speed-value', '%'],
    ]) {
      input.addEventListener('input', () => {
        document.querySelector(selector).textContent = input.value + suffix;
      });
    }

    let playing = false;
    let musicWanted = true;
    let autoplayBlocked = false;

    function setPlaying(value) {
      playing = value;
      onPlaybackChange(value);
      track.muted = !value;
      playback.setAttribute('aria-pressed', String(value));
      playback.setAttribute('aria-label', value ? 'Пауза' : 'Воспроизвести');
      playback.querySelector('img').src = app.assets.url(app.assets.paths.icons[value ? 'pause' : 'play']);
      if (value && musicWanted && track.paused) startMusic();
    }

    playback.addEventListener('click', () => setPlaying(!playing));

    function syncMusic() {
      const on = musicWanted;
      music.setAttribute('aria-pressed', String(on));
      music.setAttribute('aria-label', on ? 'Выключить музыку' : 'Включить музыку');
      music.querySelector('img').src = app.assets.url(app.assets.paths.icons[on ? 'musicOn' : 'musicOff']);
    }

    async function startMusic() {
      track.muted = !playing;
      try {
        await track.play();
        autoplayBlocked = false;
        status.textContent = '';
      } catch (e) {
        autoplayBlocked = true;
        status.textContent = 'Нажмите на сцену, чтобы запустить музыку.';
      }
      syncMusic();
    }

    music.addEventListener('click', () => {
      status.textContent = '';
      musicWanted = !musicWanted;
      if (musicWanted) startMusic();
      else { track.pause(); syncMusic(); }
    });

    document.querySelector('.scene').addEventListener('pointerdown', e => {
      if (autoplayBlocked && musicWanted && !music.contains(e.target) && e.target.closest('#intro') === null) startMusic();
    });
    track.addEventListener('play', syncMusic);
    track.addEventListener('pause', syncMusic);
    track.addEventListener('error', () => {
      status.textContent = 'Не удалось загрузить музыкальный файл.';
      syncMusic();
    });
    document.querySelector('#start').addEventListener('click', () => {
      document.querySelector('#intro').hidden = true;
      setPlaying(true);
    });

    return {
      get playing() { return playing; },
      get horizontal() { return Number(horizontal.value); },
      get vertical() { return Number(vertical.value); },
      get speed() { return Number(speed.value); },
    };
  }

  app.createControls = createControls;
})(window.NightCity = window.NightCity || {});
