// Canvas 2D rendering from simulation state and the projected camera pose.
(function (app) {
  'use strict';

  function createScene(canvas, images) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const walkerHeight = H * .24;
    const walkerWidth = walkerHeight * 272 / 724;
    const farWidth = Math.round(W * .93);
    const farHeight = Math.round(H * .93);
    const { sky, far, middle, street } = app.camera.layers;

    function draw(img, x = 0, y = 0, w = W, h = H) {
      if (img.complete && img.naturalWidth) ctx.drawImage(img, x, y, w, h);
    }

    function drawSky(y) {
      const image = images.sky;
      draw(image, 0, y);
      if (y !== 0 && image.complete && image.naturalWidth) {
        const top = y > 0;
        ctx.drawImage(image, 0, top ? 0 : image.naturalHeight - 1, image.naturalWidth, 1,
          0, top ? 0 : H + y, W, Math.abs(y));
      }
    }

    function strip(images, offset, y, { tileWidth = W, tileHeight = H, extendGround = false } = {}) {
      const span = tileWidth * images.length;
      const start = ((Math.round(offset) % span) + span) % span;
      let index = Math.floor(start / tileWidth), x = -(start % tileWidth);
      while (x < W) {
        const image = images[index % images.length];
        draw(image, x, y, tileWidth, tileHeight);
        if (extendGround && y < 0 && image.complete && image.naturalWidth) {
          // Continue the pavement edge into the sliver exposed below the tile.
          ctx.drawImage(image, 0, image.naturalHeight - 1, image.naturalWidth, 1, x, y + tileHeight, tileWidth, -y);
        }
        x += tileWidth;
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

    function render(motion, camera) {
      const { worldDistance, carFrame, walkerX, walkerFrame, animationTime } = motion;
      const pan = camera.x + camera.framePan;
      const distance = worldDistance + pan;
      const streetY = Math.round(-camera.y * street.y);
      ctx.clearRect(0, 0, W, H);
      drawSky(-Math.round(camera.y * sky.y));
      strip([images.far], distance * far.x, H - 480 - farHeight - Math.round(camera.y * far.y),
        { tileWidth: farWidth, tileHeight: farHeight });
      strip(images.middle, distance * middle.x, -300 - Math.round(camera.y * middle.y));
      strip(images.streets, distance * street.x, streetY, { extendGround: true });
      draw(images.cars[carFrame % images.cars.length], -camera.frame, H * .635 + streetY, W * .45, W * .45 / 3);
      if (walkerX !== null) {
        draw(images.walker[walkerFrame % images.walker.length], walkerX - pan * street.x,
          H * .965 - walkerHeight * .94 + streetY, walkerWidth, walkerHeight);
      }
      drawRain(animationTime);
    }

    return { render, walkerWidth };
  }

  app.createScene = createScene;
})(window.NightCity = window.NightCity || {});
