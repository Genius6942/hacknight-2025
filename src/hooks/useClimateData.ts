import { useState, useEffect, useRef } from "react";

// Interface for a single data point from climate_data_for_globe.json
interface ClimatePoint {
  lat: number;
  lng: number;
  coordinates: [number, number]; // [lng, lat]
  // Temperature data for different periods, e.g., temp_2021-2040
  [key: string]: number | [number, number];
}

import type { LineFeatureCollection, TemperatureAnomalyDataPoint } from "../types"; // Added TemperatureAnomalyDataPoint

export const useClimateData = () => {
  const [climateData, setClimateData] = useState<ClimatePoint[]>([]);
  const [landBoundaries, setLandBoundaries] = useState<LineFeatureCollection | null>(
    null
  );
  const [temperatureAnomalyData, setTemperatureAnomalyData] = useState<
    TemperatureAnomalyDataPoint[]
  >([]); // New state for anomaly data
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

    const loadDataWithProgress = async <T>(
      url: string,
      onProgress: (loaded: number, total: number) => void
    ): Promise<{ data: T; total: number }> => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      if (!response.body) throw new Error("Response body is null");
      const contentLength = Number(response.headers.get("Content-Length") || "0");
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

        const { data: climateJson, total: climateTotal } = await loadDataWithProgress<
          ClimatePoint[]
        >(
          "/data/climate_data_for_globe.json",
          (loaded, total) => setProgress(loaded / (total * 3)) // Adjusted for three files
        );
        setClimateData(climateJson);
        if (climateTotal === 0) setProgress(1 / 3);

        const { data: boundaryJson, total: boundaryTotal } =
          await loadDataWithProgress<LineFeatureCollection>(
            "/data/allLandBoundaries.json",
            (loaded, total) => setProgress(1 / 3 + loaded / (total * 3)) // Adjusted for three files
          );
        setLandBoundaries(boundaryJson);
        if (boundaryTotal === 0) setProgress(2 / 3);

        const { data: anomalyJson, total: anomalyTotal } = await loadDataWithProgress<
          TemperatureAnomalyDataPoint[]
        >(
          "/data/temperature_data.json", // Path to the new data file
          (loaded, total) => setProgress(2 / 3 + loaded / (total * 3)) // Adjusted for three files
        );
        setTemperatureAnomalyData(anomalyJson);
        if (anomalyTotal === 0) setProgress(1);

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

  return {
    climateData,
    landBoundaries,
    temperatureAnomalyData, // Expose new data
    loading,
    error,
    progress, // Expose progress
    timePeriods,
    getTemperatureAtLocation,
    getTemperatureChange,
  };
};
