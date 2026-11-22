// Simulation clock and route progress. Camera offsets belong to rendering.
(function (app) {
  'use strict';

  const STREET_SPEED = 255;
  const WALK_SPEED = 180;
  const CAR_FPS = 36;
  const WALK_FPS = 8;
  const ACTION_FPS = 5;

  function create({ spawnDistance, startX, benchX, closingFrames, sittingFrames }) {
    const closingDuration = closingFrames / ACTION_FPS;
    const sittingDuration = sittingFrames / ACTION_FPS;
    let animationTime = 0;
    let carTime = 0;
    let worldDistance = 0;
    let walkerWorldX = null;
    let walkerState = 'walking';
    let stateTime = 0;

    function advanceWalker(dt) {
      if (walkerState === 'waiting') return;

      if (walkerState === 'walking') {
        const timeToBench = (walkerWorldX - benchX) / WALK_SPEED;
        if (dt < timeToBench) {
          walkerWorldX -= WALK_SPEED * dt;
          stateTime += dt;
          return;
        }
        walkerWorldX = benchX;
        walkerState = 'closing_umbrella';
        stateTime = 0;
        dt -= timeToBench;
      }

      stateTime += dt;
      if (walkerState === 'closing_umbrella' && stateTime >= closingDuration) {
        walkerState = 'sitting_wait';
        stateTime -= closingDuration;
      }
      if (walkerState === 'sitting_wait' && stateTime >= sittingDuration) {
        walkerState = 'waiting';
      }
    }

    function advance(dt, speedPercent) {
      const roadTime = dt * (speedPercent / 100);
      const travel = STREET_SPEED * roadTime;
      animationTime += dt;
      carTime += roadTime;
      if (walkerWorldX !== null) {
        advanceWalker(dt);
      } else if (travel > 0 && worldDistance + travel >= spawnDistance) {
        walkerWorldX = startX;
        advanceWalker(dt * (worldDistance + travel - spawnDistance) / travel);
      }
      worldDistance += travel;
      return travel;
    }

    return {
      advance,
      get animationTime() { return animationTime; },
      get worldDistance() { return worldDistance; },
      get carFrame() { return Math.floor(carTime * CAR_FPS); },
      get walkerState() { return walkerState; },
      get walkerFrame() {
        switch (walkerState) {
          case 'walking': return Math.floor(stateTime * WALK_FPS);
          case 'closing_umbrella': return Math.min(closingFrames - 1, Math.floor(stateTime * ACTION_FPS));
          case 'sitting_wait': return Math.min(sittingFrames - 1, Math.floor(stateTime * ACTION_FPS));
          case 'waiting': return sittingFrames - 1;
        }
      },
      get walkerWorldX() { return walkerWorldX; },
    };
  }

  app.motion = { create, streetSpeed: STREET_SPEED };
})(window.NightCity = window.NightCity || {});
