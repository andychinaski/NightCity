// Simulation clock and route progress. Camera offsets belong to rendering.
(function (app) {
  'use strict';

  const STREET_SPEED = 255;
  const WALK_SPEED = 180;
  const CAR_FPS = 36;
  const WALK_FPS = 8;
  const ACTION_FPS = 5;

  function create({ routeLength, spawnDistance, startX, benchX, closingFrames, sittingFrames }) {
    const closingDuration = closingFrames / ACTION_FPS;
    const sittingDuration = sittingFrames / ACTION_FPS;
    let animationTime = 0;
    let carTime = 0;
    let worldDistance = 0;
    let walkerLap = -1;
    let walkerX = null;
    let walkerState = 'walking';
    let stateTime = 0;

    function advanceWalker(dt) {
      if (walkerState === 'waiting') return;

      if (walkerState === 'walking') {
        const timeToBench = (walkerX - benchX) / WALK_SPEED;
        if (dt < timeToBench) {
          walkerX -= WALK_SPEED * dt;
          stateTime += dt;
          return;
        }
        walkerX = benchX;
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
      const nextDistance = worldDistance + travel;
      const nextLap = Math.floor((nextDistance - spawnDistance) / routeLength);
      // Fast playback must still leave enough of the stop in frame for the actions.
      const walkerTime = Math.max(dt, roadTime);
      animationTime += dt;
      carTime += roadTime;
      if (travel > 0 && nextLap > walkerLap) {
        walkerLap = nextLap;
        walkerX = startX;
        walkerState = 'walking';
        stateTime = 0;
        const distanceAfterSpawn = nextDistance - (spawnDistance + walkerLap * routeLength);
        advanceWalker(walkerTime * distanceAfterSpawn / travel);
      } else if (walkerX !== null) {
        advanceWalker(walkerTime);
      }
      worldDistance = nextDistance;
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
      get walkerWorldX() { return walkerX === null ? null : walkerX + walkerLap * routeLength; },
    };
  }

  app.motion = { create, streetSpeed: STREET_SPEED };
})(window.NightCity = window.NightCity || {});
