import { useState, useEffect } from "react";

interface ClimateMetadata {
  bounds: [number, number, number, number];
  shape: [number, number];
  crs: string;
  min_temp: number;
  max_temp: number;
  mean_temp: number;
  transform: number[];
}

interface PeriodData {
  period: string;
  metadata: ClimateMetadata;
  data: (number | null)[][];
}

interface ClimateData {
  [period: string]: PeriodData;
}

export const useClimateData = () => {
  const [climateData, setClimateData] = useState<ClimateData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timePeriods = ["2021-2040", "2041-2060", "2061-2080", "2081-2100"];

  useEffect(() => {
    const loadClimateData = async () => {
      try {
        setLoading(true);
        const data: ClimateData = {};

        // Load grid format data for each period
        for (const period of timePeriods) {
          const response = await fetch(`/output/temperature_grid_${period}.json`);
          if (!response.ok) {
            throw new Error(`Failed to load data for ${period}`);
          }
          const periodData = await response.json();
          data[period] = periodData;
        }

        setClimateData(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load climate data");
        setLoading(false);
      }
    };

    loadClimateData();
  }, []);

  // Convert grid data to point data for cities
  const getTemperatureAtLocation = (
    lat: number,
    lng: number,
    period: string
  ): number | null => {
    const periodData = climateData[period];
    if (!periodData || !periodData.data || !periodData.metadata) {
      return null;
    }

    const { data: gridData, metadata } = periodData;
    const { bounds, shape } = metadata;
    const [minLng, minLat, maxLng, maxLat] = bounds;
    const [height, width] = shape;

    // Convert lat/lng to grid coordinates
    const x = Math.round(((lng - minLng) / (maxLng - minLng)) * (width - 1));
    const y = Math.round(((maxLat - lat) / (maxLat - minLat)) * (height - 1));

    // Check bounds
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return null;
    }

    const temp = gridData[y]?.[x];
    return typeof temp === "number" && !isNaN(temp) ? temp : null;
  };

  // Get temperature change between two periods
  const getTemperatureChange = (
    lat: number,
    lng: number,
    fromPeriod: string,
    toPeriod: string
  ): number | null => {
    const fromTemp = getTemperatureAtLocation(lat, lng, fromPeriod);
    const toTemp = getTemperatureAtLocation(lat, lng, toPeriod);

    if (fromTemp === null || toTemp === null) {
      return null;
    }

    return toTemp - fromTemp;
  };

  // Get all metadata for a period
  const getPeriodMetadata = (period: string): ClimateMetadata | null => {
    return climateData[period]?.metadata || null;
  };

  return {
    climateData,
    loading,
    error,
    timePeriods,
    getTemperatureAtLocation,
    getTemperatureChange,
    getPeriodMetadata,
  };
};
