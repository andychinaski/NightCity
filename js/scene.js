// Canvas 2D rendering from simulation state and the projected camera pose.
(function (app) {
  'use strict';

  const objectLayers = ['far', 'middle', 'street', 'car', 'foreground'];

  // Bench areas between the foreground posts, measured in the shelter PNG.
  const benchAreas = [
    [467, 599, 679, 774],
    [715, 599, 1057, 774],
    [1097, 599, 1307, 774],
  ].map(([left, top, right, bottom]) => [
    left / 1774, top / 887, (right - left) / 1774, (bottom - top) / 887,
  ]);

  function wrap(value, period) {
    const remainder = value % period;
    return remainder < 0 ? remainder + period : remainder;
  }

  function createScene(canvas, images) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const walkerHeight = H * .24;
    const walkerWidth = walkerHeight * 272 / 724;
    const farWidth = Math.round(W * .93);
    const farHeight = Math.round(H * .93);
    const { sky, far, middle, street } = app.camera.layers;
    const tilePlanes = {
      far: { tiles: [images.far], width: farWidth, height: farHeight, y: H - 480 - farHeight, factor: far },
      middle: { tiles: images.middle, width: W, height: H, y: -300, factor: middle },
      street: { tiles: images.streets, width: W, height: H, y: 0, factor: street, extendGround: true },
    };
    const car = {
      id: 'car', x: 0, y: H * .635, width: W * .45, height: W * .45 / 3,
      layer: 'car', plane: 'car', sprite: images.cars, frame: 0,
    };
    const busStop = {
      id: 'bus-stop', x: W * 1.57, y: H * .964, width: H * .754, height: H * .377,
      layer: 'foreground', plane: 'street', anchor: { x: 0, y: 850 / 887 },
      sprite: images.busStop, repeat: false, snap: false,
      clipAreas: benchAreas, clipOutside: true,
    };
    const bench = { ...busStop, id: 'bus-stop-bench', clipOutside: false };
    const benchX = busStop.x + busStop.width * (890 / 1774);
    const benchSeatY = busStop.y + (706 / 887 - busStop.anchor.y) * busStop.height;
    const walkerRoute = {
      spawnDistance: W * .86,
      benchX,
      startX: benchX + H * .28,
    };
    const standingY = H * .955;
    const walker = {
      id: 'walker', x: 0, y: standingY, width: walkerWidth, height: walkerHeight,
      layer: 'foreground', plane: 'street', anchor: { x: .51, y: .94 }, sprite: images.walker.walking,
      frame: 0, visible: false, repeat: false, snap: false,
    };
    // Align the bottom of the pelvis in sitting_wait/03.png to the seat surface.
    const seatedY = benchSeatY + (walker.anchor.y - 548 / 724) * walkerHeight;
    const objects = [car, bench, walker, busStop];

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

    function strip({ tiles, width, height, extendGround }, { pixelOffset, y, span }) {
      const start = wrap(pixelOffset, span);
      let index = Math.floor(start / width), x = -(start % width);
      while (x < W) {
        const image = tiles[index % tiles.length];
        draw(image, x, y, width, height);
        if (extendGround && y < 0 && image.complete && image.naturalWidth) {
          // Continue the pavement edge into the sliver exposed below the tile.
          ctx.drawImage(image, 0, image.naturalHeight - 1, image.naturalWidth, 1, x, y + height, width, -y);
        }
        x += width;
        index++;
      }
    }

    function projectPlanes(worldDistance, camera) {
      const distance = worldDistance + (camera.x + camera.framePan);
      const planes = {};
      for (const [name, plane] of Object.entries(tilePlanes)) {
        const offset = distance * plane.factor.x;
        const vertical = camera.y * plane.factor.y;
        planes[name] = {
          offset,
          pixelOffset: Math.round(offset),
          y: plane.y + (name === 'street' ? Math.round(-vertical) : -Math.round(vertical)),
          span: plane.width * plane.tiles.length,
        };
      }
      planes.car = { offset: camera.frame, pixelOffset: camera.frame, y: planes.street.y, span: 0 };
      return planes;
    }

    function drawObject(object, planes) {
      const { x, y, width, height, layer, anchor, sprite, frame = 0 } = object;
      const plane = planes[object.plane ?? (tilePlanes[layer] ? layer : 'street')];
      const offset = object.snap === false ? plane.offset : plane.pixelOffset;
      const left = x - (anchor?.x ?? 0) * width - offset;
      const top = y - (anchor?.y ?? 0) * height + plane.y;
      const image = Array.isArray(sprite) ? sprite[frame % sprite.length] : sprite;

      if (object.repeat === false || !plane.span) {
        if (left + width <= 0 || left >= W) return;
        if (object.clipAreas) {
          ctx.save();
          ctx.beginPath();
          if (object.clipOutside) ctx.rect(left, top, width, height);
          for (const [x, y, w, h] of object.clipAreas) {
            ctx.rect(left + x * width, top + y * height, w * width, h * height);
          }
          ctx.clip('evenodd');
          draw(image, left, top, width, height);
          ctx.restore();
          return;
        }
        draw(image, left, top, width, height);
        return;
      }
      // Include the copy that may enter the viewport from the preceding tile cycle.
      const first = wrap(left + width, plane.span) - width;
      for (let copy = first; copy < W; copy += plane.span) {
        if (copy + width > 0) draw(image, copy, top, width, height);
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
      const { worldDistance, carFrame, walkerWorldX, walkerState, walkerFrame, animationTime } = motion;
      const planes = projectPlanes(worldDistance, camera);
      car.frame = carFrame;
      walker.visible = walkerWorldX !== null;
      walker.x = walkerWorldX;
      const pose = walkerState === 'waiting' ? 'sitting_wait' : walkerState;
      walker.sprite = images.walker[pose];
      walker.frame = walkerFrame;
      const sitProgress = pose === 'sitting_wait' ? walkerFrame / (walker.sprite.length - 1) : 0;
      walker.y = standingY + (seatedY - standingY) * sitProgress;

      ctx.clearRect(0, 0, W, H);
      drawSky(-Math.round(camera.y * sky.y));
      for (const layer of objectLayers) {
        if (tilePlanes[layer]) strip(tilePlanes[layer], planes[layer]);
        for (const object of objects) {
          if (object.layer === layer && object.visible !== false) drawObject(object, planes);
        }
      }
      drawRain(animationTime);
    }

    return { render, walkerRoute, objects };
  }

  app.createScene = createScene;
})(window.NightCity = window.NightCity || {});
