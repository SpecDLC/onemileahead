import Dexie, { type EntityTable } from 'dexie';
import type { Marker } from '../types/marker';

export interface MetaEntry {
  key: string;
  value: string;
}

export class OneMileAheadDB extends Dexie {
  markers!: EntityTable<Marker, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor() {
    super('OneMileAheadDB');

    this.version(1).stores({
      markers: 'id, markerNumber, title, county, city',
      meta: 'key',
    });
  }
}

export const db = new OneMileAheadDB();
