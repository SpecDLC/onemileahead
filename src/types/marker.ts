export interface Marker {
  id: number;
  markerNumber: string;
  title: string;
  county: string;
  city: string;
  lat: number;
  lng: number;
  markerText: string;
  markerDate: string;
  subjectCodes: string[];
  isRTHL: boolean;
  size: string;
}
