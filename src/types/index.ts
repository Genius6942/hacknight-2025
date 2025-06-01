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

export type ViewMode =
  | "coastal"
  | "temperature"
  | "climate_change"
  | "temp_anomaly"
  | "emissions"; // Added "emissions"

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

export interface EmissionDataRow {
  IPCC_annex: string;
  C_group_IM24_sh: string;
  Country_code_A3: string;
  Name: string;
  ipcc_code_2006_for_standard_report: string;
  ipcc_code_2006_for_standard_report_name: string; // Sector name
  Substance: string;
  fossil_bio: string;
  [yearKey: string]: string | number; // For Y_YYYY fields
}

export interface SectorEmission {
  sectorName: string;
  value: number;
}

export interface YearlyEmissions {
  year: number;
  total: number;
  sectors: SectorEmission[];
}

export interface CountryEmissionsData {
  countryCodeA3: string;
  countryName: string;
  emissionsByYear: Map<number, YearlyEmissions>;
}

export type ProcessedEmissionsData = Map<string, CountryEmissionsData>; // Keyed by Country_code_A3
