import { useState, useEffect, useRef, useMemo } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { useClimateData } from "./hooks/useClimateData";
import citiesRawData from "./data/cities.json";
import type { LineFeatureCollection, LineStringFeature } from "./types";
import type { AppCity, GeoJsonFeature, ViewMode, CityRiskCategory } from "./types";
import {
  calculateDistance,
  getTemperatureColor,
  getTemperatureChangeColor,
  isTemperatureExtreme,
  getPointSize,
  getPointColor,
  getPointAltitude,
} from "./utils/globeUtils";
import { useWindowDimensions, useCameraAltitude } from "./hooks/useGlobeControls";
import Sidebar from "./components/Sidebar/Sidebar";
import GlobeDisplay from "./components/GlobeDisplay/GlobeDisplay";

// landBoundaries will be loaded dynamically via useClimateData
function App() {
  const globeEl = useRef<GlobeMethods>(null as any);
  const windowDimensions = useWindowDimensions();
  const cameraAltitude = useCameraAltitude(globeEl);

  const [coastlines, setCoastlines] = useState<LineStringFeature[]>([]);
  const [cities, setCities] = useState<AppCity[]>([]);
  const [riskThresholdMiles, setRiskThresholdMiles] = useState<number>(10);
  const [viewMode, setViewMode] = useState<ViewMode>("coastal");
  const [currentPeriod, setCurrentPeriod] = useState<string>("2021-2040");
  const [comparisonPeriod, setComparisonPeriod] = useState<string>("2081-2100");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showStats, setShowStats] = useState(true);

  const {
    climateData,
    landBoundaries,
    temperatureAnomalyData,
    loading: climateLoading,
    error: climateError,
    progress,
    timePeriods,
    getTemperatureAtLocation,
    getTemperatureChange,
  } = useClimateData();

  // computeDistanceToCoast remains the same
  const computeDistanceToCoast = (
    city: Omit<AppCity, "distanceToCoast">,
    coastlineFeatures: LineStringFeature[]
  ): number => {
    let minDistance = Infinity;
    coastlineFeatures.forEach((feature: any) => {
      const geometry = feature.geometry;
      const coords = geometry.coordinates;

      const processLineString = (lineCoords: number[][]) => {
        for (const coord of lineCoords) {
          const shoreLng = coord[0];
          const shoreLat = coord[1];
          const dist = calculateDistance(city.lat, city.lng, shoreLat, shoreLng);
          if (dist < minDistance) minDistance = dist;
        }
      };

      if (geometry.type === "LineString") {
        processLineString(coords as number[][]);
      } else if (geometry.type === "MultiLineString") {
        (coords as number[][][]).forEach((lineString) => {
          processLineString(lineString);
        });
      }
    });
    return isFinite(minDistance) ? minDistance : 0;
  };

  useEffect(() => {
    if (!landBoundaries) return;
    setCoastlines(landBoundaries.features);

    const rawCities: Omit<AppCity, "distanceToCoast">[] = (
      citiesRawData.features as GeoJsonFeature[]
    ).map((feature, idx) => ({
      id: feature.properties.name + "_" + idx,
      name: feature.properties.name,
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      originalProperties: feature.properties,
    }));

    const computedCities: AppCity[] = rawCities.map((city) => {
      const dist = computeDistanceToCoast(city, landBoundaries.features);
      return { ...city, distanceToCoast: dist };
    });
    setCities(computedCities);

    if (globeEl.current) {
      globeEl.current.controls().autoRotate = false;
      globeEl.current.controls().autoRotateSpeed = 0.2;
    }
  }, [landBoundaries]);

  // Auto-play animation for time periods
  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (isPlaying && timePeriods.length > 0) {
      interval = setInterval(() => {
        setCurrentPeriod((prev: string) => {
          const currentIndex = timePeriods.indexOf(prev);
          const nextIndex = (currentIndex + 1) % timePeriods.length;
          return timePeriods[nextIndex];
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timePeriods]);

  const getDynamicLabelSize = () => {
    const baseSize = 0.6;
    const minSize = 0;
    const maxSize = 1.0;
    const scaleFactor = Math.max(0.3, Math.min(1.5, cameraAltitude / 1.5));
    const dynamicSize = baseSize * scaleFactor;
    return Math.max(minSize, Math.min(maxSize, dynamicSize));
  };

  const getCityRiskCategory = (city: AppCity): CityRiskCategory => {
    if (city.distanceToCoast <= riskThresholdMiles) {
      return "submerged";
    }
    if (city.distanceToCoast <= riskThresholdMiles + 10) {
      return "at_risk";
    }
    return "low_risk";
  };

  const citiesWithRiskCategory = useMemo(() => {
    return cities.map((city) => ({
      ...city,
      riskCategory: getCityRiskCategory(city),
    }));
  }, [cities, riskThresholdMiles]);

  const highRiskCities = useMemo(() => {
    return citiesWithRiskCategory.filter(
      (city) => city.riskCategory === "submerged" || city.riskCategory === "at_risk"
    );
  }, [citiesWithRiskCategory]);

  const globePointsData = useMemo(() => {
    if (viewMode === "climate_change") {
      if (!temperatureAnomalyData || temperatureAnomalyData.length === 0) return [];
      return temperatureAnomalyData.map((point: any) => ({
        ...point,
        color: getPointColor(point.diff),
        altitude: getPointAltitude(point.diff),
        size: 0.1,
      }));
    }

    if (!climateData || Object.keys(climateData).length === 0) return [];
    return cities.map((city) => {
      const temp = getTemperatureAtLocation(city.lat, city.lng, currentPeriod);
      return {
        ...city,
        lat: city.lat,
        lng: city.lng,
        temperature: temp,
        color: getTemperatureColor(temp),
        size: getPointSize(temp),
      };
    });
  }, [
    cities,
    currentPeriod,
    climateData,
    getTemperatureAtLocation,
    viewMode,
    temperatureAnomalyData,
  ]);

  const stats = useMemo(() => {
    if (globePointsData.length === 0) return null;
    const temps = globePointsData
      .map((d) => d.temperature)
      .filter((t) => t !== undefined && t !== null && !isNaN(t)) as number[];
    if (temps.length === 0) return null;
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
    return { min, max, avg, count: temps.length };
  }, [globePointsData]);

  const citiesWithRealTemp = useMemo(() => {
    return cities.map((city) => {
      const temp = getTemperatureAtLocation(city.lat, city.lng, currentPeriod);
      return { ...city, realTemp: temp };
    });
  }, [cities, currentPeriod, climateData, getTemperatureAtLocation]);

  const citiesWithTempChange = useMemo(() => {
    return cities.map((city) => {
      const change = getTemperatureChange(
        city.lat,
        city.lng,
        currentPeriod,
        comparisonPeriod
      );
      return { ...city, tempChange: change };
    });
  }, [cities, currentPeriod, comparisonPeriod, climateData, getTemperatureChange]);

  const extremeTempCities = useMemo(() => {
    return citiesWithRealTemp.filter((c) => {
      const temp = c.realTemp;
      return temp !== null && temp !== undefined && isTemperatureExtreme(temp);
    });
  }, [citiesWithRealTemp]);

  if (climateLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#000",
        }}
      >
        <div style={{ color: "white", fontSize: "18px", marginBottom: "20px" }}>
          Loading climate data...
        </div>
        {/* Progress Bar */}
        <div
          style={{
            width: "50%",
            height: "20px",
            backgroundColor: "#333",
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid #555",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              backgroundColor: "#4caf50",
              transition: "width 0.2s ease-in-out",
            }}
          ></div>
        </div>
        <div style={{ color: "white", fontSize: "14px", marginTop: "10px" }}>
          {Math.round(progress * 100)}%
        </div>
      </div>
    );
  }

  if (climateError) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#000",
        }}
      >
        <div style={{ color: "red", fontSize: "18px" }}>
          Error loading climate data: {climateError}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black">
      <Sidebar
        viewMode={viewMode}
        setViewMode={setViewMode}
        riskThresholdMiles={riskThresholdMiles}
        setRiskThresholdMiles={setRiskThresholdMiles}
        currentPeriod={currentPeriod}
        setCurrentPeriod={setCurrentPeriod}
        comparisonPeriod={comparisonPeriod}
        setComparisonPeriod={setComparisonPeriod}
        cities={citiesWithRiskCategory}
        highRiskCities={highRiskCities}
        citiesWithRealTemp={citiesWithRealTemp}
        extremeTempCities={extremeTempCities}
        citiesWithTempChange={citiesWithTempChange}
        getTemperatureColor={getTemperatureColor}
        getTemperatureChangeColor={getTemperatureChangeColor}
        isTemperatureExtreme={isTemperatureExtreme}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        showStats={showStats}
        setShowStats={setShowStats}
        stats={stats}
        timePeriods={timePeriods}
        getPointColor={getPointColor}
      />
      <GlobeDisplay
        globeEl={globeEl}
        windowDimensions={windowDimensions}
        viewMode={viewMode}
        coastlines={coastlines}
        cities={citiesWithRiskCategory}
        citiesWithRealTemp={citiesWithRealTemp}
        citiesWithTempChange={citiesWithTempChange}
        getDynamicLabelSize={getDynamicLabelSize}
        getCityRiskCategory={getCityRiskCategory}
        getTemperatureColor={getTemperatureColor}
        getTemperatureChangeColor={getTemperatureChangeColor}
        pointsData={globePointsData}
        currentPeriod={currentPeriod}
        temperatureAnomalyData={temperatureAnomalyData}
        selectedAnomalyComparisonPeriod={comparisonPeriod}
        getPointColor={getPointColor}
        getPointAltitude={getPointAltitude}
      />
      {isPlaying && climateLoading && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "8px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            zIndex: 1000,
          }}
        >
          🔄 Animating & Loading...
        </div>
      )}
    </div>
  );
}

export default App;
