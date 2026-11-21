// Canvas 2D rendering from the current motion state and manual camera offsets.
(function (app) {
  'use strict';

  function createScene(canvas, images) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const walkerHeight = H * .24;
    const walkerWidth = walkerHeight * 272 / 724;
    const { far, middle, street } = app.motion.layers;

    function draw(img, x = 0, y = 0, w = W, h = H) {
      if (img.complete && img.naturalWidth) ctx.drawImage(img, x, y, w, h);
    }

    function strip(images, offset, y = 0) {
      const span = W * images.length;
      let start = ((offset % span) + span) % span;
      let index = Math.floor(start / W), x = -(start % W);
      while (x < W) {
        draw(images[index % images.length], x, y);
        x += W;
        index++;
      }
    }

    // Rain uses scene time and freezes when playback is paused.
    let rainSeed = 123456;
    function rainRandom() {
      rainSeed = (rainSeed * 1664525 + 1013904223) >>> 0;
      return rainSeed / 4294967296;
    }
    const raindrops = Array.from({ length: 210 }, () => ({
      x: rainRandom() * W,
      y: rainRandom() * H,
      speed: 480 + rainRandom() * 300,
      length: 12 + rainRandom() * 20,
      alpha: .13 + rainRandom() * .2,
    }));

    function drawRain(animationTime) {
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      for (const drop of raindrops) {
        const distance = animationTime * drop.speed;
        const x = ((drop.x - distance * .28) % W + W) % W;
        const y = (drop.y + distance) % (H + 60) - 30;
        ctx.strokeStyle = `rgba(164,207,255,${drop.alpha})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - drop.length * .28, y + drop.length);
        ctx.stroke();
      }
      ctx.restore();
    }

    function render(motion, horizontal, vertical) {
      const x = horizontal * W / 100;
      const { worldDistance, carFrame, walkerX, walkerFrame, animationTime } = motion;
      ctx.clearRect(0, 0, W, H);
      draw(images.sky);
      strip([images.far], worldDistance * far.distanceFactor + x * far.cameraFactor, -480 - vertical * far.cameraFactor);
      strip(images.middle, worldDistance * middle.distanceFactor + x * middle.cameraFactor, -300 - vertical * middle.cameraFactor);
      strip(images.streets, worldDistance * street.distanceFactor + x * street.cameraFactor);
      draw(images.cars[carFrame % images.cars.length], 0, H * .635, W * .45, W * .45 / 3);
      if (walkerX !== null) {
        draw(images.walker[walkerFrame % images.walker.length], walkerX, H * .965 - walkerHeight * .94, walkerWidth, walkerHeight);
      }
      drawRain(animationTime);
    }

    return { render, walkerWidth };
  }

  app.createScene = createScene;
})(window.NightCity = window.NightCity || {});
