// Application entrypoint: advance the simulation and render the current camera.
(function (app) {
  'use strict';

  const canvas = document.querySelector('#scene');
  const images = app.assets.loadSceneImages();
  const scene = app.createScene(canvas, images);
  const motion = app.motion.create({
    width: canvas.width,
    streetCount: images.streets.length,
    walkerWidth: scene.walkerWidth,
  });
  let last = null;
  const controls = app.createControls({ onPlaybackChange: () => { last = null; } });

  function tick(now) {
    if (last !== null && controls.playing) {
      const dt = Math.min((now - last) / 1000, .1);
      motion.advance(dt, controls.speed);
    }
    last = now;
    scene.render(motion, controls.horizontal, controls.vertical);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})(window.NightCity = window.NightCity || {});
