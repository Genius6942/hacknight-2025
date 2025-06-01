import React from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import type { AppCity, ViewMode, CityRiskCategory, GlobePoint } from "../../types";
import earthImage from "../../assets/earth.jpg";

interface GlobeDisplayProps {
  globeEl: React.RefObject<GlobeMethods>;
  windowDimensions: { width: number; height: number };
  viewMode: ViewMode;
  coastlines: any[];
  cities: AppCity[];
  citiesWithRealTemp: AppCity[];
  citiesWithTempChange: AppCity[];
  getDynamicLabelSize: () => number;
  getCityRiskCategory: (city: AppCity) => CityRiskCategory;
  getTemperatureColor: (temp: number | undefined | null) => string;
  getTemperatureChangeColor: (change: number) => string;
  pointsData: GlobePoint[];
  currentPeriod: string;
}

const GlobeDisplay: React.FC<GlobeDisplayProps> = ({
  globeEl,
  windowDimensions,
  viewMode,
  coastlines,
  cities,
  citiesWithRealTemp,
  citiesWithTempChange,
  getDynamicLabelSize,
  getCityRiskCategory,
  getTemperatureColor,
  getTemperatureChangeColor,
  pointsData,
  currentPeriod,
}) => {
  return (
    <div className="w-4/5 h-full relative">
      <Globe
        ref={globeEl}
        width={(windowDimensions.width * 4) / 5}
        height={windowDimensions.height}
        globeImageUrl={earthImage}
        backgroundImageUrl={"//unpkg.com/three-globe/example/img/night-sky.png"}
        backgroundColor="rgba(0,0,0,0)"
        pathsData={viewMode === "coastal" ? coastlines : []}
        pathPoints={(d: any) => d.geometry.coordinates}
        pathPointLat={(coord: number[]) => coord[1]}
        pathPointLng={(coord: number[]) => coord[0]}
        pathColor={() => "#00FFFF"}
        pathStroke={() => 0.3}
        pathDashGap={0}
        pathDashInitialGap={0}
        pointsData={
          viewMode === "temperature" || viewMode === "climate_change" ? pointsData : []
        }
        pointLat={(d) => (d as GlobePoint).lat}
        pointLng={(d) => (d as GlobePoint).lng}
        pointColor={(d) => (d as GlobePoint).color}
        pointAltitude={0.01}
        pointRadius={(d) => (d as GlobePoint).size}
        pointLabel={(d) => `
          <div style="background: rgba(0,0,0,0.85); color: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); font-family: sans-serif;">
            <div style="font-size: 14px; font-weight: bold; margin-bottom: 6px;">
              ${(d as GlobePoint).temperature?.toFixed(1)}°C
            </div>
            <div style="font-size: 11px; opacity: 0.85;">
              Period: ${currentPeriod}<br/>
              Location: ${(d as GlobePoint).lat.toFixed(2)}°, ${(
          d as GlobePoint
        ).lng.toFixed(2)}°
            </div>
          </div>
        `}
        labelsData={
          viewMode === "temperature"
            ? citiesWithRealTemp
            : viewMode === "climate_change"
            ? citiesWithTempChange
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
        labelSize={getDynamicLabelSize}
        labelDotRadius={0.3}
        labelResolution={2}
        labelColor={(d) => {
          const city = d as AppCity;
          if (viewMode === "coastal") {
            const riskCategory = getCityRiskCategory(city);
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
        enablePointerInteraction={true}
        animateIn={true}
      />
    </div>
  );
};

export default GlobeDisplay;
