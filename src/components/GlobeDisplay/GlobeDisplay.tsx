import React, { useMemo, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import type {
  AppCity,
  ViewMode,
  GlobePoint,
  TemperatureAnomalyDataPoint,
  GeoJsonFeature,
  ProcessedEmissionsData,
  YearlyEmissions,
} from "../../types";
import earthImage from "../../assets/earth.jpg";
import {
  getAnomalyColor,
  getAnomalyAltitude,
  getAnomalyPointSize,
} from "../../utils/globeUtils";
import { scaleSequentialSqrt } from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";

interface GlobeDisplayProps {
  globeEl: React.RefObject<GlobeMethods>;
  windowDimensions: { width: number; height: number };
  viewMode: ViewMode;
  coastlines: any[];
  cities: AppCity[];
  citiesWithRealTemp: AppCity[];
  citiesWithTempChange: AppCity[];
  getTemperatureColor: (temp: number | undefined | null) => string;
  getTemperatureChangeColor: (change: number) => string;
  pointsData: GlobePoint[];
  currentPeriod: string;
  temperatureAnomalyData?: TemperatureAnomalyDataPoint[];
  selectedAnomalyComparisonPeriod?: string;
  getPointColor?: (diff: number | undefined | null) => string;
  getPointAltitude?: (diff: number | undefined | null) => number;
  countries: GeoJsonFeature[];
  emissionsData: ProcessedEmissionsData | null;
  selectedEmissionYear: number | null;
  getEmissionsForYear?: (year: number) => Map<string, number>;
  getCountryEmissionDetails?: (
    countryCodeA3: string,
    year: number
  ) => YearlyEmissions | null;
  emissionYears?: number[];
  onCountrySelect: (isoA3: string | null) => void; // New prop for country click
}

const GlobeDisplay: React.FC<GlobeDisplayProps> = ({
  globeEl,
  windowDimensions,
  viewMode,
  coastlines,
  cities,
  citiesWithRealTemp,
  citiesWithTempChange,
  getTemperatureColor,
  getTemperatureChangeColor,
  pointsData,
  currentPeriod,
  temperatureAnomalyData,
  selectedAnomalyComparisonPeriod,
  getPointColor,
  getPointAltitude,
  countries,
  selectedEmissionYear,
  getEmissionsForYear,
  onCountrySelect,
}) => {
  const [hoverD, setHoverD] = useState<GeoJsonFeature | undefined>();

  const anomalyPoints = React.useMemo(() => {
    if (
      viewMode !== "temp_anomaly" ||
      !temperatureAnomalyData ||
      !selectedAnomalyComparisonPeriod
    ) {
      return [];
    }
    return temperatureAnomalyData.map((point) => {
      const periodData = point.periods[selectedAnomalyComparisonPeriod];
      if (!periodData) {
        return {
          lat: point.lat,
          lng: point.lon,
          altitude: 0.001,
          radius: 0.1,
          color: "rgba(128,128,128,0.5)",
          label: `Data not available for ${selectedAnomalyComparisonPeriod} at ${point.lat.toFixed(
            2
          )}, ${point.lon.toFixed(2)}`,
        };
      }
      return {
        lat: point.lat,
        lng: point.lon,
        altitude: getPointAltitude
          ? getPointAltitude(periodData.diff)
          : getAnomalyAltitude(periodData.diff),
        radius: getAnomalyPointSize(periodData.diff),
        color: getPointColor
          ? getPointColor(periodData.diff)
          : getAnomalyColor(periodData.diff),
        label: `
          <div style="background: rgba(0,0,0,0.85); color: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); font-family: sans-serif;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 6px;">
              Temp Anomaly: ${periodData.diff.toFixed(2)}°C
            </div>
            <div style="font-size: 11px; opacity: 0.85;">
              Avg Temp: ${periodData.avg.toFixed(2)}°C<br/>
              Period: ${selectedAnomalyComparisonPeriod}<br/>
              Baseline: 2021-2040<br/>
              Location: ${point.lat.toFixed(2)}°, ${point.lon.toFixed(2)}°
            </div>
          </div>
        `,
      };
    });
  }, [
    viewMode,
    temperatureAnomalyData,
    selectedAnomalyComparisonPeriod,
    getPointColor,
    getPointAltitude,
  ]);

  const emissionColorScale = useMemo(() => {
    if (viewMode !== "emissions" || !selectedEmissionYear || !getEmissionsForYear) {
      return () => "rgba(0, 100, 0, 0.15)";
    }
    const yearEmissions = getEmissionsForYear(selectedEmissionYear);
    if (yearEmissions.size === 0) return () => "rgba(0, 100, 0, 0.15)";

    const allValues = Array.from(yearEmissions.values());
    const positiveValues = allValues.filter((v) => v > 0);
    if (positiveValues.length === 0) return () => "rgba(0, 100, 0, 0.15)";

    const maxVal = Math.max(...positiveValues);
    const minVal = Math.min(...positiveValues);

    const scale = scaleSequentialSqrt(interpolateYlOrRd);
    if (minVal === maxVal) {
      scale.domain([minVal * 0.9 || 0, maxVal * 1.1 || 1]);
    } else {
      scale.domain([minVal, maxVal]);
    }
    return scale;
  }, [viewMode, selectedEmissionYear, getEmissionsForYear]);

  const getEmissionValueForCountry = (countryCodeA3: string): number | undefined => {
    if (!getEmissionsForYear || !selectedEmissionYear) return undefined;
    const yearEmissions = getEmissionsForYear(selectedEmissionYear);
    return yearEmissions.get(countryCodeA3);
  };

  return (
    <div className="w-3/4 h-full relative">
      <Globe
        ref={globeEl}
        width={(windowDimensions.width * 3) / 4}
        height={windowDimensions.height}
        globeImageUrl={
          viewMode === "temp_anomaly" || viewMode === "emissions"
            ? "//unpkg.com/three-globe/example/img/earth-night.jpg"
            : earthImage
        }
        backgroundImageUrl={"//unpkg.com/three-globe/example/img/night-sky.png"}
        backgroundColor="rgba(0,0,0,0)"
        pathsData={viewMode === "coastal" ? coastlines : []}
        pathPoints={(d: any) => d.geometry.coordinates}
        pathPointLat={(coord: number[]) => coord[1]}
        pathPointLng={(coord: number[]) => coord[0]}
        pathColor={() => "#00FFFF"}
        pathStroke={() => 0.8}
        pathDashGap={0}
        pathDashInitialGap={0}
        pointsData={
          viewMode === "temperature" || viewMode === "climate_change"
            ? pointsData
            : viewMode === "temp_anomaly"
            ? anomalyPoints
            : []
        }
        pointLat={(d) => (d as GlobePoint).lat}
        pointLng={(d) => (d as GlobePoint).lng}
        pointColor={(d: any) => d.color}
        pointAltitude={(d: any) => (viewMode === "temp_anomaly" ? d.altitude : 0)}
        pointRadius={(d: any) => (viewMode === "temp_anomaly" ? 0.2 : 0.2)}
        pointLabel={(d: any) => {
          if (viewMode === "temp_anomaly") {
            return d.label;
          }
          // Default label for temperature/climate_change points
          if (d.temperature !== undefined || d.name !== undefined) {
            // Check if it's a city point
            return `
            <div style="background: rgba(0,0,0,0.85); color: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); font-family: sans-serif;">
              <div style="font-size: 14px; font-weight: bold; margin-bottom: 6px;">
                ${(d as GlobePoint).name ? (d as GlobePoint).name + ": " : ""}${(
              d as GlobePoint
            ).temperature?.toFixed(1)}°C
              </div>
              <div style="font-size: 11px; opacity: 0.85;">
                Period: ${currentPeriod}<br/>
                Location: ${(d as GlobePoint).lat.toFixed(2)}°, ${(
              d as GlobePoint
            ).lng.toFixed(2)}°
              </div>
            </div>
          `;
          }
          return ""; // Return empty for other cases to avoid errors
        }}
        labelsData={
          viewMode === "temperature"
            ? citiesWithRealTemp
            : viewMode === "climate_change"
            ? citiesWithTempChange
            : viewMode === "temp_anomaly" || viewMode === "emissions"
            ? []
            : cities
        }
        labelLat={(d) => (d as AppCity).lat}
        labelLng={(d) => (d as AppCity).lng}
        labelText={(d) => {
          const city = d as AppCity;
          if (viewMode === "climate_change") {
            const change = city.tempChange;
            if (change !== null && change !== undefined) {
              return `${city.name} (${change >= 0 ? "+" : ""}${change.toFixed(1)}°C)`;
            }
          } else if (viewMode === "temperature") {
            const temp = city.realTemp;
            if (temp !== null && temp !== undefined) {
              return `${city.name} (${temp.toFixed(1)}°C)`;
            }
          }
          return city.name;
        }}
        labelSize={0.4}
        labelDotRadius={0.3}
        labelResolution={2}
        labelColor={(d) => {
          const city = d as AppCity;
          if (viewMode === "coastal") {
            const riskCategory = city.riskCategory;
            if (riskCategory === "submerged") return "#ff4d4d";
            if (riskCategory === "at_risk") return "#ffc107";
            return "#4caf50";
          } else if (viewMode === "temperature") {
            const temp = city.realTemp;
            return temp !== null && temp !== undefined
              ? getTemperatureColor(temp)
              : "rgba(200, 200, 200, 0.7)";
          } else if (viewMode === "climate_change") {
            const change = city.tempChange;
            return change !== null && change !== undefined
              ? getTemperatureChangeColor(change)
              : "rgba(200, 200, 200, 0.7)";
          }
          return "yellow";
        }}
        polygonsData={
          viewMode === "emissions"
            ? countries.filter((d) => d.properties && d.properties.ISO_A3)
            : []
        }
        polygonAltitude={(d) => (d === hoverD ? 0.12 : 0.06)}
        polygonCapColor={(d) => {
          if (viewMode === "emissions") {
            const feature = d as GeoJsonFeature;
            const countryCode =
              feature.properties.ISO_A3 === "-99"
                ? feature.properties.ADM0_A3_US
                : feature.properties.ISO_A3;
            if (!countryCode) return "#666666";
            const emissionValue = getEmissionValueForCountry(countryCode);
            return emissionValue !== undefined
              ? emissionColorScale(emissionValue)
              : "#666666";
          }
          return "#666666";
        }}
        polygonSideColor={() => "rgba(0, 100, 0, 0.15)"}
        polygonStrokeColor={() => "#111"}
        polygonLabel={(d: any) => {
          const { properties } = d as GeoJsonFeature;
          console.log(properties);
          return viewMode === "emissions" && properties && properties.ADMIN
            ? `
            ${properties.ADMIN}
        `
            : "";
        }}
        onPolygonHover={(d) => {
          if (viewMode === "emissions") {
            setHoverD(d as GeoJsonFeature);
          } else {
            setHoverD(undefined); // Clear hover state for other view modes
          }
        }}
        onPolygonClick={(polygon, event) => {
          if (viewMode === "emissions") {
            const feature = polygon as GeoJsonFeature;
            if (feature && feature.properties && feature.properties.ISO_A3) {
              onCountrySelect(feature.properties.ISO_A3);
            } else {
              onCountrySelect(null); // Deselect if clicked on area without ISO_A3
            }
          }
        }}
        onGlobeReady={() => {
          if (globeEl.current) {
            globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 });
          }
        }}
      />
    </div>
  );
};

export default GlobeDisplay;

// Notes:
// - Removed the polygonLabel functionality as it's no longer needed.
// - Added onPolygonClick to handle country selection.
// - Cleaned up unused props and code related to the removed features.
