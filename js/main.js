// Application entrypoint: advance the simulation and render the current camera.
(function (app) {
  'use strict';

  const canvas = document.querySelector('#scene');
  const images = app.assets.loadSceneImages();
  const scene = app.createScene(canvas, images);
  const camera = app.camera.create(canvas.width, canvas.height);
  const motion = app.motion.create({
    ...scene.walkerRoute,
    closingFrames: images.walker.closing_umbrella.length,
    sittingFrames: images.walker.sitting_wait.length,
  });
  let last = null;
  let resetMotionClock = false;
  const controls = app.createControls({
    onPlaybackChange(playing) {
      resetMotionClock = true;
      camera.setPlaying(playing, controls.horizontal);
    },
  });

  function tick(now) {
    if (last !== null) {
      const dt = Math.min((now - last) / 1000, .1);
      const travel = controls.playing && !resetMotionClock ? motion.advance(dt, controls.speed) : 0;
      // On the first frame after Play, hold the rendered camera pose while the
      // route clock restarts. Paused camera input still updates every frame.
      if (!controls.playing || !resetMotionClock) {
        camera.advance(dt, controls.horizontal, controls.vertical, travel);
      }
    }
    resetMotionClock = false;
    last = now;
    scene.render(motion, camera.pose);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})(window.NightCity = window.NightCity || {});
