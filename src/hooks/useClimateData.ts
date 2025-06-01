import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";

// Interface for a single data point from climate_data_for_globe.json
interface ClimatePoint {
  lat: number;
  lng: number;
  coordinates: [number, number]; // [lng, lat]
  // Temperature data for different periods, e.g., temp_2021-2040
  [key: string]: number | [number, number];
}

import type {
  LineFeatureCollection,
  TemperatureAnomalyDataPoint,
  EmissionDataRow,
  ProcessedEmissionsData,
  CountryEmissionsData,
  YearlyEmissions,
  SectorEmission,
} from "../types"; // Added EmissionDataRow and ProcessedEmissionsData

export const useClimateData = () => {
  const [climateData, setClimateData] = useState<ClimatePoint[]>([]);
  const [landBoundaries, setLandBoundaries] = useState<LineFeatureCollection | null>(
    null
  );
  const [temperatureAnomalyData, setTemperatureAnomalyData] = useState<
    TemperatureAnomalyDataPoint[]
  >([]);
  const [emissionsData, setEmissionsData] = useState<ProcessedEmissionsData | null>(null); // New state for emissions data
  const [emissionYears, setEmissionYears] = useState<number[]>([]); // New state for available years in emissions data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // Add progress state
  const fetched = useRef(false);

  const timePeriods = ["2021-2040", "2041-2060", "2061-2080", "2081-2100"];

  useEffect(() => {
    if (fetched.current) {
      return;
    }
    fetched.current = true;

    const parseAndProcessEmissions = (
      csvText: string
    ): { processedData: ProcessedEmissionsData; years: number[] } => {
      const parseResult = Papa.parse<EmissionDataRow>(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });

      const data: ProcessedEmissionsData = new Map();
      const yearSet = new Set<number>();

      parseResult.data.forEach((row) => {
        if (!row.Country_code_A3 || !row.Name) return;

        const countryCode = row.Country_code_A3;
        let countryData = data.get(countryCode);
        if (!countryData) {
          countryData = {
            countryCodeA3: countryCode,
            countryName: row.Name,
            emissionsByYear: new Map<number, YearlyEmissions>(),
          };
          data.set(countryCode, countryData);
        }

        Object.keys(row).forEach((key) => {
          if (key.startsWith("Y_")) {
            const year = parseInt(key.substring(2));
            if (
              !isNaN(year) &&
              row[key] !== null &&
              row[key] !== undefined &&
              row[key] !== ""
            ) {
              yearSet.add(year);
              let yearlyData = countryData!.emissionsByYear.get(year);
              if (!yearlyData) {
                yearlyData = {
                  year: year,
                  total: 0,
                  sectors: [],
                };
                countryData!.emissionsByYear.set(year, yearlyData);
              }

              const emissionValue = Number(row[key]);
              if (!isNaN(emissionValue)) {
                yearlyData.total += emissionValue;

                const sectorName =
                  row.ipcc_code_2006_for_standard_report_name || "Unknown Sector";
                let sectorEntry = yearlyData.sectors.find(
                  (s) => s.sectorName === sectorName
                );
                if (sectorEntry) {
                  sectorEntry.value += emissionValue;
                } else {
                  yearlyData.sectors.push({ sectorName, value: emissionValue });
                }
              }
            }
          }
        });
      });
      const sortedYears = Array.from(yearSet).sort((a, b) => a - b);
      return { processedData: data, years: sortedYears };
    };

    const loadDataWithProgress = async <T>(
      url: string,
      onProgress: (loaded: number, total: number) => void
    ): Promise<{ data: T; total: number }> => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      if (!response.body) throw new Error("Response body is null");
      const contentLength = Number(response.headers.get("Content-Length") || "0");

      if (url.endsWith(".csv")) {
        // Handle CSV differently for now, or adapt progress if needed
        const text = await response.text();
        onProgress(1, 1); // Simulate completion for progress tracking
        return { data: text as any, total: text.length }; // Casting to any, actual type handled by parser
      }

      if (contentLength === 0) {
        // No length header: fetch whole JSON at once and skip progress
        const json = await response.json();
        return { data: json as T, total: 0 };
      }
      const reader = response.body.getReader();
      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedLength += value.length;
          onProgress(receivedLength, contentLength);
        }
      }

      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      const result = new TextDecoder("utf-8").decode(chunksAll);
      return { data: JSON.parse(result) as T, total: contentLength };
    };

    const loadAllData = async () => {
      try {
        setLoading(true);
        setProgress(0);
        const numFiles = 4; // Adjusted for four files now

        const { data: climateJson, total: climateTotal } = await loadDataWithProgress<
          ClimatePoint[]
        >("/data/climate_data_for_globe.json", (loaded, total) =>
          setProgress(loaded / (total * numFiles))
        );
        setClimateData(climateJson);
        if (climateTotal === 0) setProgress(1 / numFiles);

        const { data: boundaryJson, total: boundaryTotal } =
          await loadDataWithProgress<LineFeatureCollection>(
            "/data/allLandBoundaries.json",
            (loaded, total) => setProgress(1 / numFiles + loaded / (total * numFiles))
          );
        setLandBoundaries(boundaryJson);
        if (boundaryTotal === 0) setProgress(2 / numFiles);

        const { data: anomalyJson, total: anomalyTotal } = await loadDataWithProgress<
          TemperatureAnomalyDataPoint[]
        >("/data/temperature_data.json", (loaded, total) =>
          setProgress(2 / numFiles + loaded / (total * numFiles))
        );
        setTemperatureAnomalyData(anomalyJson);
        if (anomalyTotal === 0) setProgress(3 / numFiles);

        // Load Emissions Data
        const { data: emissionsCsvText, total: emissionsTotal } =
          await loadDataWithProgress<string>("/data/emissions.csv", (loaded, total) =>
            setProgress(3 / numFiles + loaded / (total * numFiles))
          );
        const { processedData: parsedEmissionsData, years: parsedEmissionYears } =
          parseAndProcessEmissions(emissionsCsvText);
        setEmissionsData(parsedEmissionsData);
        setEmissionYears(parsedEmissionYears);
        if (emissionsTotal === 0) setProgress(1); // Or handle if it was already 1

        setLoading(false);
        setProgress(1); // Ensure progress is 100% at the end
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
        setLoading(false);
        setProgress(0); // Reset progress on error
      }
    };
    loadAllData();
  }, []);

  // Helper function to calculate squared Euclidean distance (faster for finding closest)
  const simpleDistSq = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const dLat = lat1 - lat2;
    const dLng = lng1 - lng2;
    return dLat * dLat + dLng * dLng;
  };

  const getTemperatureAtLocation = (
    lat: number,
    lng: number,
    period: string
  ): number | null => {
    if (loading || error || climateData.length === 0) {
      return null;
    }

    let closestPoint: ClimatePoint | null = null;
    let minDistanceSq = Infinity;

    for (const point of climateData) {
      const distanceSq = simpleDistSq(lat, lng, point.lat, point.lng);
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        closestPoint = point;
      }
    }

    if (closestPoint) {
      const tempKey = `temp_${period}`;
      const tempValue = closestPoint[tempKey];
      if (typeof tempValue === "number" && !isNaN(tempValue)) {
        return tempValue;
      }
    }
    return null;
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

  const getEmissionsForYear = (year: number): Map<string, number> => {
    const yearlyEmissionsMap = new Map<string, number>();
    if (!emissionsData) return yearlyEmissionsMap;

    emissionsData.forEach((countryData) => {
      const yearData = countryData.emissionsByYear.get(year);
      if (yearData) {
        yearlyEmissionsMap.set(countryData.countryCodeA3, yearData.total);
      }
    });
    return yearlyEmissionsMap;
  };

  const getCountryEmissionDetails = (
    countryCodeA3: string,
    year: number
  ): YearlyEmissions | null => {
    if (!emissionsData) return null;
    const countryData = emissionsData.get(countryCodeA3);
    if (!countryData) return null;
    return countryData.emissionsByYear.get(year) || null;
  };

  return {
    climateData,
    landBoundaries,
    temperatureAnomalyData,
    emissionsData, // Expose new emissions data
    emissionYears, // Expose available emission years
    loading,
    error,
    progress, // Expose progress
    timePeriods,
    getTemperatureAtLocation,
    getTemperatureChange,
    getEmissionsForYear, // Expose new function
    getCountryEmissionDetails, // Expose new function
  };
};
