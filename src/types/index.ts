export interface GeoJsonProperties {
  name: string;
  [key: string]: any;
}

export interface GeoJsonFeature {
  type: "Feature";
  properties: GeoJsonProperties;
  geometry: {
    type: "Point";
    coordinates: number[]; // [lng, lat]
  };
}

export interface AppCity {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  population?: number;
  country?: string;
  originalProperties: Record<string, any>;
  distanceToCoast: number; // Added this line
  realTemp?: number | null;
  tempChange?: number | null;
  riskCategory?: CityRiskCategory;
}

export type ViewMode = "coastal" | "temperature" | "climate_change" | "temp_anomaly"; // Added "temp_anomaly"

export type CityRiskCategory = "submerged" | "at_risk" | "low_risk";

// Added from ClimateGlobe integration
export interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  temperature?: number | null;
  // You can add other properties if needed from your climate_data_for_globe.json structure
  [key: string]: any; // Allow other properties if they exist
}

/** A GeoJSON Feature with a LineString geometry */
export interface LineStringFeature {
  type: "Feature";
  properties: GeoJsonProperties;
  geometry: {
    type: "LineString";
    coordinates: number[][]; // [lng, lat] pairs
  };
}

/** A GeoJSON FeatureCollection of LineStringFeatures */
export interface LineFeatureCollection {
  type: "FeatureCollection";
  features: LineStringFeature[];
}

export interface Stats {
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface TemperatureAnomalyPeriodData {
  avg: number;
  diff: number;
}

export interface TemperatureAnomalyDataPoint {
  lat: number;
  lon: number; // Note: some datasets use 'lon', others 'lng'. Standardize if possible or handle both.
  periods: {
    [key: string]: TemperatureAnomalyPeriodData;
  };
}
