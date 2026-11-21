// Simulation clock and route progress. Camera offsets belong to rendering.
(function (app) {
  'use strict';

  const STREET_SPEED = 255;
  const WALK_SPEED = 180;
  const CAR_FPS = 36;
  const WALK_FPS = 8;
  const layers = {
    far: { distanceFactor: 8 / STREET_SPEED, cameraFactor: .25 },
    middle: { distanceFactor: 65 / STREET_SPEED, cameraFactor: .55 },
    street: { distanceFactor: 1, cameraFactor: 1 },
  };

  function create({ width, streetCount, walkerWidth }) {
    const routeLength = width * streetCount;
    let animationTime = 0;
    let carTime = 0;
    let worldDistance = 0;
    let walkerX = null;
    // First street-to-park transition, then once per route loop.
    let nextWalkerSpawn = width;

    function advance(dt, speedPercent) {
      const roadTime = dt * (speedPercent / 100);
      const travel = STREET_SPEED * roadTime;
      animationTime += dt;
      carTime += roadTime;
      worldDistance += travel;

      if (worldDistance >= nextWalkerSpawn) {
        walkerX = width;
        nextWalkerSpawn += routeLength;
      }
      if (walkerX !== null) {
        walkerX -= travel + WALK_SPEED * dt;
        if (walkerX < -walkerWidth) walkerX = null;
      }
    }

    return {
      advance,
      get animationTime() { return animationTime; },
      get worldDistance() { return worldDistance; },
      get carFrame() { return Math.floor(carTime * CAR_FPS); },
      get walkerFrame() { return Math.floor(animationTime * WALK_FPS); },
      get walkerX() { return walkerX; },
    };
  }

  app.motion = { create, layers };
})(window.NightCity = window.NightCity || {});
