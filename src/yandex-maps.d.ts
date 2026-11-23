interface YandexMapEvent {
  get(name: 'coords'): [number, number];
}

interface YandexPlacemark {
  geometry: {
    setCoordinates(coordinates: [number, number]): void;
  };
}

interface YandexMap {
  events: {
    add(name: 'click', callback: (event: YandexMapEvent) => void): void;
  };
  geoObjects: {
    add(object: YandexPlacemark): void;
    remove(object: YandexPlacemark): void;
  };
  container: {
    fitToViewport(): void;
  };
  setCenter(coordinates: [number, number], zoom?: number, options?: { duration?: number }): void;
}

interface YandexMapsAPI {
  ready(callback: () => void): void;
  Map: new (
    element: string,
    state: { center: [number, number]; zoom: number; controls?: string[] },
  ) => YandexMap;
  Placemark: new (
    coordinates: [number, number],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YandexPlacemark;
}

interface Window {
  ymaps?: YandexMapsAPI;
}
