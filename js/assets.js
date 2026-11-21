// Asset manifest. All programmatically loaded image paths live here.
// Preserve global-script compatibility so index.html also runs via file://.
(function (app) {
  'use strict';

  const root = 'assets/';
  const paths = Object.freeze({
    sky: 'backgrounds/sky.png',
    far: 'backgrounds/distant-city.png',
    middle: ['backgrounds/middle-city.png', 'backgrounds/middle-city-continuation.png'],
    streets: ['streets/street.png', 'streets/park.png', 'streets/supermarket.png'],
    cars: Array.from({ length: 8 }, (_, i) => `sprites/car/${String(i + 1).padStart(2, '0')}.png`),
    walker: Array.from({ length: 8 }, (_, i) => `sprites/walker/${String(i + 1).padStart(2, '0')}.png`),
    icons: {
      play: 'icons/play.png',
      pause: 'icons/pause.png',
      musicOn: 'icons/music_on.png',
      musicOff: 'icons/music_off.png',
    },
    theme: 'audio/theme.mp3',
  });

  function url(path) { return root + path; }
  function load(path) {
    const img = new Image();
    img.src = url(path);
    return img;
  }
  function loadSceneImages() {
    return {
      sky: load(paths.sky),
      far: load(paths.far),
      middle: paths.middle.map(load),
      streets: paths.streets.map(load),
      cars: paths.cars.map(load),
      walker: paths.walker.map(load),
    };
  }

  app.assets = { paths, url, loadSceneImages };
})(window.NightCity = window.NightCity || {});
