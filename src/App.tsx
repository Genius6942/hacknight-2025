import { useState, useEffect, useRef, useMemo } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { useClimateData } from "./hooks/useClimateData";
import citiesRawData from "./data/cities.json";
import type { LineFeatureCollection, LineStringFeature } from "./types";
import type { AppCity, GeoJsonFeature, ViewMode, CityRiskCategory } from "./types";
import {
  calculateDistance,
  getTemperatureColor, // Updated import
  getTemperatureChangeColor,
  isTemperatureExtreme,
  getPointSize, // Added import
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
    loading: climateLoading,
    error: climateError,
    progress, // Get progress from the hook
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
    let interval: ReturnType<typeof setTimeout>; // Changed NodeJS.Timeout to ReturnType<typeof setTimeout>
    if (isPlaying && timePeriods.length > 0) {
      interval = setInterval(() => {
        setCurrentPeriod((prev) => {
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

  // Enhanced: Use climateData from useClimateData for points on the globe
  const globePointsData = useMemo(() => {
    if (!climateData || Object.keys(climateData).length === 0) return [];

    // Assuming climateData is now an object keyed by period, as in useClimateData.ts
    // And each period has a 'data' field which is an array of points with lat, lng, and temp_PERIOD
    // This needs to align with how useClimateData structures its output or how it's processed here.
    // The provided ClimateGlobe component expects a flat array of points where each point has temp_PERIOD fields.
    // We will use the getTemperatureAtLocation for each city for the current period for simplicity here.
    // For a full globe point display like in ClimateGlobe, you'd iterate over a grid or predefined points.

    // This example will show temperatures for the *cities* we already have.
    // For a dense point layer like in the original ClimateGlobe, you'd need a different data source or processing of the grid data.
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
  }, [cities, currentPeriod, climateData, getTemperatureAtLocation]);

  // Stats calculation based on current globePointsData
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
          flexDirection: "column", // Align items vertically
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
      {" "}
      {/* Added bg-black for consistent theme */}
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
        // Pass new props for playback and stats
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        showStats={showStats}
        setShowStats={setShowStats}
        stats={stats} // Pass calculated stats
        timePeriods={timePeriods} // Pass all available time periods
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
        // Pass new props for points display
        pointsData={globePointsData} // Pass the new points data for temperature visualization
        currentPeriod={currentPeriod} // Pass current period for point labels
      />
      {/* Loading indicator for data updates (optional, if isPlaying causes re-renders often) */}
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
            zIndex: 1000, // Ensure it's on top
          }}
        >
          🔄 Animating & Loading...
        </div>
      )}
    </div>
  );
}

export default App;
