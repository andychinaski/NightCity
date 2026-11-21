import { SRGBColorSpace, TextureLoader } from 'three';

const carFrameUrls = Object.entries(import.meta.glob('../assets/pilot/car/frame-*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})).sort(([first], [second]) => first.localeCompare(second)).map(([, url]) => url);

export async function loadSceneTextures(renderer) {
  const loader = new TextureLoader();

  async function load(url) {
    const texture = await loader.loadAsync(url);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  async function loadLayer(name, urls) {
    const results = await Promise.allSettled(urls.map(load));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) {
      for (const result of results) {
        if (result.status === 'fulfilled') result.value.dispose();
      }
      console.warn(`Не удалось загрузить текстуры слоя «${name}». Используется тестовая геометрия.`, failure.reason);
      return null;
    }
    return results.map(result => result.value);
  }

  const [sky, distant, middle, street, car] = await Promise.all([
    loadLayer('Небо', [new URL('../assets/pilot/sky/sky-reference.png', import.meta.url).href]),
    loadLayer('Дальний город', [new URL('../assets/pilot/city/distant-skyline.png', import.meta.url).href]),
    loadLayer('Средний город', [
      new URL('../assets/pilot/city/mid-city.png', import.meta.url).href,
      new URL('../assets/pilot/city/mid-city-continuation.png', import.meta.url).href,
    ]),
    loadLayer('Ближняя улица', [
      new URL('../assets/pilot/reference/street.png', import.meta.url).href,
      new URL('../assets/pilot/reference/park.png', import.meta.url).href,
      new URL('../assets/pilot/reference/supermarket.png', import.meta.url).href,
    ]),
    loadLayer('Автомобиль', carFrameUrls),
  ]);

  // Upload the animation frames before playback so the first cycle can reuse them.
  for (const frame of car ?? []) renderer.initTexture(frame);
  return { sky: sky?.[0], distant: distant?.[0], middle, street, car };
}
