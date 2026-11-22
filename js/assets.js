// Asset manifest. All programmatically loaded image paths live here.
// Preserve global-script compatibility so index.html also runs via file://.
(function (app) {
  'use strict';

  const root = 'assets/';
  const frames = (folder, count) => Array.from({ length: count },
    (_, i) => `${folder}/${String(i + 1).padStart(2, '0')}.png`);
  const paths = Object.freeze({
    sky: 'backgrounds/sky.png',
    far: 'backgrounds/distant-city.png',
    middle: ['backgrounds/middle-city.png', 'backgrounds/middle-city-continuation.png'],
    streets: ['streets/street.png', 'streets/park.png', 'streets/supermarket.png'],
    cars: frames('sprites/car', 8),
    busStop: 'sprites/bus_station.png',
    walker: {
      walking: frames('sprites/walker', 8),
      closing_umbrella: frames('sprites/walker/closing_umbrella', 3),
      sitting_wait: frames('sprites/walker/sitting_wait', 3),
    },
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
      busStop: load(paths.busStop),
      walker: Object.fromEntries(Object.entries(paths.walker).map(([state, sequence]) => [state, sequence.map(load)])),
    };
  }

  app.assets = { paths, url, loadSceneImages };
})(window.NightCity = window.NightCity || {});
