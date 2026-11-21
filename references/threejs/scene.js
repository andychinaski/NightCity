import {
  BoxGeometry, CircleGeometry, Group, Mesh, MeshBasicMaterial,
  PlaneGeometry, Scene, Shape, ShapeGeometry,
} from 'three';
import { SEGMENT_LENGTH } from './motion.js';

const materials = new Map();

function mesh(parent, geometry, color, x, y, z) {
  if (!materials.has(color)) materials.set(color, new MeshBasicMaterial({ color }));
  const object = new Mesh(geometry, materials.get(color));
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function panel(parent, color, width, height, x, y, z) {
  return mesh(parent, new PlaneGeometry(width, height), color, x, y, z);
}

function ground(parent, color, width, depth, x, y, z) {
  const surface = panel(parent, color, width, depth, x, y, z);
  surface.rotation.x = -Math.PI / 2;
  return surface;
}

function disk(parent, color, radius, x, y, z) {
  return mesh(parent, new CircleGeometry(radius, 32), color, x, y, z);
}

function imagePanel(parent, texture, width, height, x, y, z, cutout = false) {
  const material = new MeshBasicMaterial({
    map: texture,
    alphaTest: cutout ? 0.5 : 0,
    alphaToCoverage: cutout,
  });
  const object = new Mesh(new PlaneGeometry(width, height), material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function makeSky(texture) {
  const sky = new Group();
  sky.name = 'sky';
  if (texture) {
    const width = 116;
    const height = width * texture.image.height / texture.image.width;
    // Use the clouds on both sides of the baked moon, leaving the moon itself to the disc below.
    const leftWidth = width * 0.69;
    const rightWidth = width - leftWidth;
    const left = imagePanel(sky, texture, leftWidth, height, (leftWidth - width) / 2, -12, -43);
    const right = imagePanel(sky, texture, rightWidth, height, leftWidth / 2, -12, -43);
    for (const [panel, start, end] of [[left, 0, 0.60], [right, 0.74, 1]]) {
      const uv = panel.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setX(i, start + uv.getX(i) * (end - start));
      }
    }

    // Sample the moon from the same PNG so its scale and position are independent.
    const moonGeometry = new CircleGeometry(4.2, 64);
    const moonUv = moonGeometry.attributes.uv;
    for (let i = 0; i < moonUv.count; i++) {
      const u = (1119 + (moonUv.getX(i) - 0.5) * 212) / texture.image.width;
      const v = 1 - (219 - (moonUv.getY(i) - 0.5) * 212) / texture.image.height;
      moonUv.setXY(i, u, v);
    }
    const moon = new Mesh(moonGeometry, left.material);
    moon.name = 'moon';
    moon.position.set(11, 3.7, -42.9);
    sky.add(moon);
    return sky;
  }

  panel(sky, '#232741', 100, 40, 0, 8, -43).name = 'sky-plane';
  disk(sky, '#414463', 1.5, -12.5, 8.5, -42.95);
  disk(sky, '#c5badf', 1.05, -12.5, 8.5, -42.9).name = 'moon';
  disk(sky, '#8985ac', 0.16, -12.85, 8.32, -42.89);

  for (let i = 0; i < 35; i++) {
    const x = -46 + i * 2.69;
    const y = 5.5 + (i * 19 % 23) * 0.23;
    const size = i % 6 === 0 ? 0.11 : 0.055;
    const star = panel(sky, i % 6 === 0 ? '#d4c6e7' : '#7d819f', size, size, x, y, -42.85);
    star.rotation.z = Math.PI / 4;
  }
  return sky;
}

function addDistantImage(segment, texture) {
  const height = 17.5;
  imagePanel(segment, texture, SEGMENT_LENGTH, height, SEGMENT_LENGTH / 2, height / 2, -31, true)
    .name = 'distant-skyline';
}

function addMiddleImages(segment, textures) {
  const edgeInset = 6;
  const totalPixels = textures.reduce((sum, texture) => sum + texture.image.width - 2 * edgeInset, 0);
  const height = 12.5;
  // The facade bases are at row 874. The painted strip below them goes under the ground.
  const baseFraction = 874 / 941;
  let left = 0;
  for (const [index, texture] of textures.entries()) {
    const pixels = texture.image.width - 2 * edgeInset;
    const width = SEGMENT_LENGTH * pixels / totalPixels;
    // Ignore the low-alpha artifact at the outer edges of the source strips.
    texture.offset.x = edgeInset / texture.image.width;
    texture.repeat.x = pixels / texture.image.width;
    imagePanel(segment, texture, width, height, left + width / 2, height * (baseFraction - 0.5), -17.5, true)
      .name = `mid-city-${index + 1}`;
    left += width;
  }
}

function addStreetImages(segment, [street, park, supermarket]) {
  const sections = [
    ['street', street], ['park', park], ['supermarket', supermarket],
  ];
  const width = SEGMENT_LENGTH / sections.length;
  const facadeBase = 590;
  const edgeInset = 3;

  for (const [index, [name, texture]] of sections.entries()) {
    const pixels = texture.image.width - 2 * edgeInset;
    const height = width * facadeBase / pixels;
    const facade = imagePanel(segment, texture, width, height, (index + 0.5) * width, height / 2, -3.8, true);
    facade.name = `street-${name}-${index + 1}`;
    // The identical road-and-sidewalk strip begins at row 590 in all three PNGs.
    const uv = facade.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = (edgeInset + uv.getX(i) * pixels) / texture.image.width;
      const v = 1 - (facadeBase - 0.5) * (1 - uv.getY(i)) / texture.image.height;
      uv.setXY(i, u, v);
    }
  }
}

function addDistantSilhouette(segment) {
  const heightPattern = [4.8, 5.55, 4.95, 6.1, 5.1, 4.7, 5.9, 5.25];
  const spacing = SEGMENT_LENGTH / heightPattern.length;
  const depth = -31;
  for (const [index, height] of heightPattern.entries()) {
    const x = (index + 0.5) * spacing;
    const width = spacing * (index % 3 === 0 ? 0.94 : 0.78);
    panel(segment, '#363651', width, height, x, height / 2, depth).name = `distant-building-${index}`;
    if (index % 2 === 1) {
      panel(segment, '#363651', width * 0.48, 0.31, x, height + 0.155, depth);
    }
  }
}

function addSkyline(segment, depth, count, palette, isNear) {
  const heights = isNear ? [2.3, 2.65, 2.12, 2.95, 2.42] : [3.45, 4.45, 3.75, 4.85, 3.65, 4.1];
  const step = SEGMENT_LENGTH / count;
  for (let i = 0; i < count; i++) {
    const x = (i + (isNear ? 0.5 : 0.65)) * step;
    const height = heights[i % heights.length];
    const width = step * (i % 3 === 0 ? 0.66 : 0.87);
    const facade = panel(segment, palette[i % palette.length], width, height, x, height / 2, depth);
    facade.name = `${isNear ? 'street' : 'middle'}-building-${i}`;
    const trim = isNear ? '#636984' : '#51516c';
    panel(segment, trim, width, 0.065, x, height - 0.035, depth + 0.015);
    if (i % 4 === 1 && !isNear) panel(segment, trim, 0.055, 0.4, x + width * 0.27, height + 0.2, depth);

    for (let column = 0; column < 3; column++) {
      const wx = x + (column - 1) * width * 0.25;
      const tint = isNear ? '#8b839e' : (i + column) % 3 === 0 ? '#958999' : '#63647e';
      panel(segment, tint, width * 0.125, isNear ? 0.19 : 0.12, wx, height * 0.75, depth + 0.02);
      if (!isNear) panel(segment, '#575b78', width * 0.125, 0.12, wx, height * 0.56, depth + 0.02);
    }
    if (isNear) {
      panel(segment, '#30394f', width * 0.72, 0.76, x, 0.48, depth + 0.02);
      panel(segment, i % 3 === 0 ? '#ad8a80' : '#777d9b', width * 0.76, 0.13, x, 0.93, depth + 0.025);
    }
  }
}

function addContinuousRoad(scene) {
  // The plane spans the local render window, so the visible road has no mesh joins.
  const width = SEGMENT_LENGTH * 3;
  const center = SEGMENT_LENGTH / 2;
  ground(scene, '#282f42', width, 58, center, -0.035, -18).name = 'ground-plane';
  ground(scene, '#343c51', width, 6.8, center, 0, 0).name = 'road';
  for (const side of [-1, 1]) {
    ground(scene, '#737b94', width, 0.11, center, 0.005, side * 3.4);
    ground(scene, '#404860', width, 0.05, center, 0.005, side * 3);
  }
  ground(scene, '#414961', width, 0.045, center, -0.025, 5.66);
}

function addStreetDetails(segment) {
  const marks = 16;
  for (let i = 0; i < marks; i++) {
    const x = (i + 0.5) * SEGMENT_LENGTH / marks;
    ground(segment, '#a29378', 1.42, 0.095, x, 0.009, -0.95).name = `road-mark-${i}`;
    ground(segment, '#363e55', 0.035, 2.2, x, -0.025, 4.54);
  }

  for (const x of [10, 24, 38, 52]) {
    mesh(segment, new BoxGeometry(0.55, 0.13, 0.44), '#192230', x, 0.03, 4.18);
    mesh(segment, new BoxGeometry(0.26, 2.65, 0.26), '#192230', x, 1.325, 4.18).name = `post-${x}`;
    mesh(segment, new BoxGeometry(0.06, 2.52, 0.018), '#444d65', x - 0.065, 1.33, 4.319);
    mesh(segment, new BoxGeometry(0.66, 0.19, 0.35), '#192230', x + 0.19, 2.66, 4.18);
    panel(segment, '#bdb0c2', 0.31, 0.045, x + 0.25, 2.63, 4.356);
  }
}

function carPolygon(car, color, z, points) {
  const shape = new Shape();
  shape.moveTo(...points[0]);
  for (const point of points.slice(1)) shape.lineTo(...point);
  shape.closePath();
  mesh(car, new ShapeGeometry(shape), color, 0, 0, z);
}

function makeCar() {
  const car = new Group();
  car.name = 'flat-car';
  carPolygon(car, '#74dbc0', 0, [
    [-2.06, 0.36], [-2.13, 0.66], [-1.88, 0.9], [-1.44, 0.97],
    [-0.88, 1.39], [0.45, 1.39], [1.08, 0.97], [1.85, 0.87],
    [2.08, 0.69], [2.08, 0.36], [1.71, 0.26], [-1.78, 0.27],
  ]);
  carPolygon(car, '#23354d', 0.005, [
    [-1.24, 0.97], [-0.83, 1.28], [0.36, 1.28], [0.84, 0.97],
  ]);
  carPolygon(car, '#3c5c73', 0.01, [
    [-0.22, 1.22], [0.32, 1.22], [0.63, 1.01], [-0.35, 1.01],
  ]);
  panel(car, '#4ba794', 3.54, 0.10, -0.04, 0.46, 0.012);
  panel(car, '#215d5d', 0.21, 0.036, 0.22, 0.87, 0.013);
  panel(car, '#ffb7aa', 0.18, 0.1, -1.965, 0.71, 0.013);
  panel(car, '#fff2bd', 0.22, 0.1, 1.92, 0.7, 0.013);
  for (const x of [-1.28, 1.31]) {
    // Ground-plane markers make each tire's contact legible without lighting.
    const contact = disk(car, '#242d40', 0.25, x, 0.002, 0.016);
    contact.rotation.x = -Math.PI / 2;
    disk(car, '#111724', 0.34, x, 0.34, 0.016);
    disk(car, '#8994a7', 0.20, x, 0.34, 0.019);
    disk(car, '#404b60', 0.091, x, 0.34, 0.021);
  }
  return car;
}

function addCarImage(car, frames) {
  const { width, height } = frames[0].image;
  // All eight PNGs share the same alpha silhouette and tire contact line.
  const unitsPerPixel = 4 / (1723 - 451);
  const centerX = (451 + 1723) / 2;
  const tireLine = 558;
  const compositionX = -1.6;
  const sprite = imagePanel(car, frames[0], width * unitsPerPixel, height * unitsPerPixel,
    compositionX + (width / 2 - centerX) * unitsPerPixel, (tireLine - height / 2) * unitsPerPixel, 0, true);
  sprite.name = 'car-sprite';

  // Use the original cartoon's cadence at cruising speed. Route time freezes after braking.
  const framesPerRouteSecond = 36;
  return routeTime => {
    const frame = Math.floor(routeTime * framesPerRouteSecond) % frames.length;
    sprite.material.map = frames[frame];
  };
}

export function createScene(textures = {}) {
  const scene = new Scene();
  const sky = makeSky(textures.sky);
  scene.add(sky);
  addContinuousRoad(scene);

  const segment = new Group();
  segment.name = 'street-segment';
  if (textures.distant) addDistantImage(segment, textures.distant);
  else addDistantSilhouette(segment);
  if (textures.middle) addMiddleImages(segment, textures.middle);
  else addSkyline(segment, -17.5, 12, ['#43435e', '#41415a', '#4a4965'], false);
  if (textures.street) addStreetImages(segment, textures.street);
  else addSkyline(segment, -7.2, 16, ['#505a75', '#4a506b', '#575b77'], true);
  addStreetDetails(segment);

  // At the origin shift, the neighbor occupies the identical visible position.
  const previous = segment.clone();
  const next = segment.clone();
  previous.position.x = -SEGMENT_LENGTH;
  next.position.x = SEGMENT_LENGTH;
  scene.add(previous, segment, next);

  const car = textures.car?.length ? new Group() : makeCar();
  const updateCarFrame = textures.car?.length ? addCarImage(car, textures.car) : undefined;
  scene.add(car);
  return { scene, car, sky, updateCarFrame };
}
