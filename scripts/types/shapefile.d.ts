declare module 'shapefile' {
  interface Feature {
    properties: Record<string, unknown>;
    geometry: {
      type: string;
      coordinates: number[];
    };
  }

  interface Source {
    read(): Promise<{ done: boolean; value: Feature }>;
  }

  function open(shp: string, dbf?: string): Promise<Source>;
}
