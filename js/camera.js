// Hybrid camera in canvas pixels. Simulation distance stays in motion.js.
(function (app) {
  'use strict';

  const layers = {
    far: { x: 8 / app.motion.streetSpeed, y: .25 },
    middle: { x: 65 / app.motion.streetSpeed, y: .55 },
    street: { x: 1, y: 1 },
  };
  const HORIZONTAL_RESPONSE = .12;
  const FRAME_RESPONSE = .09;
  const VERTICAL_RESPONSE = .14;
  const FRAME_PAN_SHARE = .14;
  const MAX_OPPOSING_SHARE = .30;

  function horizontalLimits(width) {
    // The car starts close to the left edge. Keep its visible pixels in frame.
    return { min: -.20 * width, max: .05 * width };
  }

  function create(width, height) {
    const { min, max } = horizontalLimits(width);
    const panLimit = max - min;
    const worldViewMargin = panLimit + FRAME_PAN_SHARE * Math.max(-min, max);
    const pose = { x: 0, frame: 0, framePan: 0, y: 0 };
    let playing = false;
    let pauseCommand = 0;
    let pauseX = 0;
    let pauseTargetX = 0;
    let pauseFrame = 0;

    function horizontalCommand(input) {
      return input / 100 * (input < 0 ? -min : max);
    }

    function setPlaying(value, horizontal) {
      if (playing && !value) {
        pauseCommand = horizontalCommand(horizontal);
        pauseX = pose.x;
        pauseTargetX = pauseX;
        pauseFrame = pose.frame;
      }
      playing = value;
    }

    function advance(dt, horizontal, vertical, travel) {
      const command = horizontalCommand(horizontal);
      let panBlend = -Math.expm1(-dt / HORIZONTAL_RESPONSE);
      if (playing) {
        pose.frame += (command - pose.frame) * -Math.expm1(-dt / FRAME_RESPONSE);
        const frameDelta = command * FRAME_PAN_SHARE - pose.framePan;
        const worldDelta = frameDelta - pose.x;
        // Limit only the projected scenery while handing the paused pan back
        // to framing. The car uses the faster, independent framing response.
        if (worldDelta < 0 && travel > 0) {
          panBlend = Math.min(panBlend, travel * MAX_OPPOSING_SHARE / -worldDelta);
        }
        pose.x -= pose.x * panBlend;
        pose.framePan += frameDelta * panBlend;
      } else {
        // The paused car and street move as one plane, including at the edges.
        const left = Math.max(-panLimit, pauseX + min - pauseFrame);
        const right = Math.min(panLimit, pauseX + max - pauseFrame);
        pauseTargetX = Math.max(left, Math.min(right, pauseTargetX + (command - pauseCommand)));
        pauseCommand = command;
        pose.x += (pauseTargetX - pose.x) * panBlend;
        pose.frame = pauseFrame + (pose.x - pauseX);
      }

      // Preserve room for the walker's feet when the foreground moves down.
      const targetY = vertical / 100 * height * (vertical < 0 ? .028 : .070);
      pose.y += (targetY - pose.y) * -Math.expm1(-dt / VERTICAL_RESPONSE);
    }

    return { pose, worldViewMargin, setPlaying, advance };
  }

  app.camera = { create, layers };
})(window.NightCity = window.NightCity || {});
