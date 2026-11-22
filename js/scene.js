// Canvas 2D rendering from simulation state and the projected camera pose.
(function (app) {
  'use strict';

  const objectLayers = ['far', 'middle', 'street', 'car', 'foreground'];

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
    // All three street PNGs share these ground rows in the 941px source.
    const roadStart = H * 620 / 941;
    const nearCurb = H * 867 / 941;
    const sidewalkBaseColor = '#0e0c23';
    const roadDepth = nearCurb - roadStart;
    const roadBands = 12;
    const sourceRows = Array.from({ length: roadBands + 1 },
      (_, row) => Math.round(roadStart + roadDepth * row / roadBands));
    const { sky, far, middle, street } = app.camera.layers;
    const tilePlanes = {
      far: { tiles: [images.far], width: farWidth, height: farHeight, y: H - 480 - farHeight, factor: far },
      middle: { tiles: images.middle, width: W, height: H, y: -300, factor: middle },
      street: { tiles: images.streets, width: W, height: H, y: 0, factor: street },
    };
    const car = {
      id: 'car', x: W * .45 / 2, y: H * .635 + (W * .45 / 3) * (700 / 724),
      width: W * .45, height: W * .45 / 3, anchor: { x: .5, y: 700 / 724 },
      layer: 'car', plane: 'car', sprite: images.cars, frame: 0,
    };
    const busStop = {
      id: 'bus-stop', x: W * 1.57, y: H * .964, width: H * .754, height: H * .377,
      layer: 'foreground', plane: 'street', anchor: { x: 0, y: 850 / 887 },
      sprite: images.busStop, snap: false,
    };
    const benchX = busStop.x + busStop.width * (890 / 1774);
    const benchSeatY = busStop.y + (706 / 887 - busStop.anchor.y) * busStop.height;
    const walkerRoute = {
      routeLength: tilePlanes.street.width * tilePlanes.street.tiles.length,
      spawnDistance: W * 1.06,
      benchX,
      startX: benchX + H * .55,
    };
    const standingY = H * .955;
    const walker = {
      id: 'walker', x: 0, y: standingY, width: walkerWidth, height: walkerHeight,
      layer: 'foreground', plane: 'street', anchor: { x: .51, y: .94 }, sprite: images.walker.walking,
      frame: 0, visible: false, repeat: false, snap: false,
    };
    // Align the bottom of the pelvis in sitting_wait/03.png to the seat surface.
    const seatedY = benchSeatY + (walker.anchor.y - 548 / 724) * walkerHeight;
    const objects = [car, walker, busStop];

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

    function strip({ tiles, width, height }, { pixelOffset, y, span }, drawTile = draw) {
      const start = wrap(pixelOffset, span);
      let index = Math.floor(start / width), x = -(start % width);
      while (x < W) {
        const image = tiles[index % tiles.length];
        drawTile(image, x, y, width, height);
        x += width;
        index++;
      }
    }

    function projectGround(cameraY) {
      const perspectiveStrength = cameraY > 0 ? 3 : 1;
      const facadeShift = cameraY * (cameraY < 0 ? .72 : .074) * perspectiveStrength;
      const curbShift = cameraY * (cameraY < 0 ? 1.72 : .27);
      // Reframe the stronger projection around the near curb to keep the sidewalk visible.
      const framingShift = curbShift * (perspectiveStrength - 1);
      const sidewalkScale = 1 - curbShift / H * .4;
      const carScale = 1 - curbShift / H * .22;

      function roadY(y) {
        const depth = (y - roadStart) / roadDepth;
        const curvature = cameraY < 0 ? .28 : .12;
        const blend = depth * (1 - curvature * (1 - depth));
        return y + facadeShift - framingShift + (curbShift * perspectiveStrength - facadeShift) * blend;
      }

      function sidewalkY(y) {
        return nearCurb + curbShift + (y - nearCurb) * sidewalkScale;
      }

      // Share rounded boundaries between adjacent bands and tiles.
      const destinationRows = sourceRows.map((row, index) =>
        Math.round(index === roadBands ? sidewalkY(row) : roadY(row)));
      const tileTop = destinationRows[0] - sourceRows[0];
      const tileBottom = Math.round(sidewalkY(H));

      function drawStreetTile(img, x, y, w, h) {
        if (cameraY === 0) {
          draw(img, x, y, w, h);
          return;
        }
        if (!img.complete || !img.naturalWidth) return;

        const sourceScale = img.naturalHeight / H;
        function slice(from, to, top, bottom) {
          ctx.drawImage(img, 0, from * sourceScale, img.naturalWidth, (to - from) * sourceScale,
            x, top, w, bottom - top);
        }

        slice(0, sourceRows[0], tileTop, destinationRows[0]);
        for (let i = 0; i < roadBands; i++) {
          slice(sourceRows[i], sourceRows[i + 1], destinationRows[i], destinationRows[i + 1]);
        }
        slice(sourceRows[roadBands], H, destinationRows[roadBands], tileBottom);
      }

      function drawStreet(plane) {
        strip(tilePlanes.street, plane, drawStreetTile);
        if (tileBottom < H) {
          // Match the dark edge of the source pavement below the projected tile.
          ctx.fillStyle = sidewalkBaseColor;
          ctx.fillRect(0, tileBottom, W, H - tileBottom);
        }
      }

      return { facadeShift, framingShift, roadY, sidewalkY, carScale, sidewalkScale, drawStreet };
    }

    function projectPlanes(worldDistance, camera, ground) {
      const distance = worldDistance + (camera.x + camera.framePan);
      const planes = {};
      for (const [name, plane] of Object.entries(tilePlanes)) {
        const offset = distance * plane.factor.x;
        planes[name] = {
          offset,
          pixelOffset: Math.round(offset),
          y: plane.y + Math.round(ground.facadeShift * plane.factor.y - ground.framingShift),
          span: plane.width * plane.tiles.length,
        };
      }
      planes.street.projectY = ground.sidewalkY;
      planes.street.scale = ground.sidewalkScale;
      planes.car = {
        offset: camera.frame, pixelOffset: camera.frame, span: 0,
        projectY: ground.roadY, scale: ground.carScale,
      };
      return planes;
    }

    function drawObject(object, planes) {
      const { x, y, layer, anchor, sprite, frame = 0 } = object;
      const plane = planes[object.plane ?? (tilePlanes[layer] ? layer : 'street')];
      const offset = object.snap === false ? plane.offset : plane.pixelOffset;
      const width = object.width * (plane.scale ?? 1);
      const height = object.height * (plane.scale ?? 1);
      const anchorX = anchor?.x ?? 0;
      let left = x - offset - anchorX * width;
      if (object.plane === 'street') {
        // Use the bench of this route cycle as the shared scale origin.
        const lap = Math.round((x - benchX) / plane.span);
        const pivot = benchX + lap * plane.span;
        left = pivot - offset + (x - pivot) * plane.scale - anchorX * width;
      }
      const top = (plane.projectY ? plane.projectY(y) : y + plane.y) - (anchor?.y ?? 0) * height;
      const image = Array.isArray(sprite) ? sprite[frame % sprite.length] : sprite;

      if (object.repeat === false || !plane.span) {
        if (left + width <= 0 || left >= W) return;
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
      const ground = projectGround(camera.y);
      const planes = projectPlanes(worldDistance, camera, ground);
      car.frame = carFrame;
      walker.visible = walkerWorldX !== null;
      walker.x = walkerWorldX;
      const pose = walkerState === 'waiting' ? 'sitting_wait' : walkerState;
      walker.sprite = images.walker[pose];
      walker.frame = walkerFrame;
      const sitProgress = pose === 'sitting_wait' ? walkerFrame / (walker.sprite.length - 1) : 0;
      walker.y = standingY + (seatedY - standingY) * sitProgress;

      ctx.clearRect(0, 0, W, H);
      drawSky(Math.round(ground.facadeShift * sky.y - ground.framingShift));
      for (const layer of objectLayers) {
        if (layer === 'street') ground.drawStreet(planes.street);
        else if (tilePlanes[layer]) strip(tilePlanes[layer], planes[layer]);
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
