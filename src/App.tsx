import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { useClimateData } from "./hooks/useClimateData";
import citiesRawData from "./data/cities.json";
import type {
  AppCity,
  GeoJsonFeature,
  ViewMode,
  CityRiskCategory,
  LineStringFeature,
} from "./types";
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
  const [selectedEmissionYear, setSelectedEmissionYear] = useState<number | null>(null);
  const [countries, setCountries] = useState<GeoJsonFeature[]>([]); // For country polygons
  const [selectedCountryIsoA3, setSelectedCountryIsoA3] = useState<string | null>(null); // New state for selected country

  const {
    climateData,
    landBoundaries,
    temperatureAnomalyData,
    emissionsData,
    emissionYears,
    loading: climateLoading,
    error: climateError,
    progress,
    timePeriods,
    getTemperatureAtLocation,
    getTemperatureChange,
    getEmissionsForYear,
    getCountryEmissionDetails,
  } = useClimateData();

  // Initialize selectedEmissionYear when emissionYears are loaded
  useEffect(() => {
    if (emissionYears && emissionYears.length > 0 && selectedEmissionYear === null) {
      setSelectedEmissionYear(emissionYears[0]);
    }
  }, [emissionYears, selectedEmissionYear]);

  // Effect to load country polygon data (e.g., countries.geojson)
  useEffect(() => {
    fetch("/data/countries.geojson") // Assuming this is the path to your country polygons
      .then((res) => res.json())
      .then((data) => {
        setCountries(data.features);
      })
      .catch((err) => console.error("Error loading countries.geojson:", err));
  }, []);

  // computeDistanceToCoast remains the same
  const computeDistanceToCoast = useMemo(
    () =>
      (
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
      },
    []
  );

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
  }, [landBoundaries, computeDistanceToCoast]);

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

  const getDynamicLabelSize = useCallback(() => {
    const baseSize = 0.6;
    const minSize = 0;
    const maxSize = 1.0;
    const scaleFactor = Math.max(0.3, Math.min(1.5, cameraAltitude / 1.5));
    const dynamicSize = baseSize * scaleFactor;
    return Math.max(minSize, Math.min(maxSize, dynamicSize));
  }, [cameraAltitude]);

  const getCityRiskCategory = useCallback(
    (city: AppCity): CityRiskCategory => {
      if (city.distanceToCoast <= riskThresholdMiles) {
        return "submerged";
      }
      if (city.distanceToCoast <= riskThresholdMiles + 10) {
        return "at_risk";
      }
      return "low_risk";
    },
    [riskThresholdMiles]
  );

  const citiesWithRiskCategory = useMemo(() => {
    return cities.map((city) => ({
      ...city,
      riskCategory: getCityRiskCategory(city),
    }));
  }, [cities, getCityRiskCategory]);

  const highRiskCities = useMemo(() => {
    return citiesWithRiskCategory.filter(
      (city) => city.riskCategory === "submerged" || city.riskCategory === "at_risk"
    );
  }, [citiesWithRiskCategory]);

  const globePointsData = useMemo(() => {
    if (viewMode === "temperature") {
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
    }
    return []; // Default for other modes or if data not ready
  }, [
    cities,
    currentPeriod,
    comparisonPeriod, // Added
    climateData,
    getTemperatureAtLocation,
    viewMode,
    temperatureAnomalyData,
    getPointColor, // Added
    getPointAltitude, // Added
  ]);

  const stats = useMemo(() => {
    if (viewMode !== "temperature" || globePointsData.length === 0) return null;
    const temps = globePointsData
      .map((d: any) => d.temperature) // d is GlobePoint which has temperature
      .filter(
        (t?: number | null) => t !== undefined && t !== null && !isNaN(t)
      ) as number[];
    if (temps.length === 0) return null;
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const avg = temps.reduce((sum, t) => sum + t, 0) / temps.length;
    return { min, max, avg, count: temps.length };
  }, [globePointsData, viewMode]);

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
        currentPeriod, // Base period for change calculation
        comparisonPeriod // Target period for change calculation
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

  // Reset selected country when viewMode changes or selected year changes
  useEffect(() => {
    setSelectedCountryIsoA3(null);
  }, [viewMode, selectedEmissionYear]);

  const totalGlobalEmissionsForYear = useMemo(() => {
    if (viewMode !== "emissions" || !getEmissionsForYear || !selectedEmissionYear)
      return 0;
    const yearEmissions = getEmissionsForYear(selectedEmissionYear);
    return Array.from(yearEmissions.values()).reduce((sum, val) => sum + (val || 0), 0);
  }, [viewMode, getEmissionsForYear, selectedEmissionYear]);

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
        // Emissions props
        selectedEmissionYear={selectedEmissionYear}
        setSelectedEmissionYear={setSelectedEmissionYear}
        emissionYears={emissionYears}
        // New props for country details display
        selectedCountryIsoA3={selectedCountryIsoA3}
        countries={countries} // Pass country features for name lookup
        getCountryEmissionDetails={getCountryEmissionDetails}
        getTotalGlobalEmissionsForYear={() => totalGlobalEmissionsForYear}
				onCountrySelect={setSelectedCountryIsoA3} // New prop to handle country selection
      />
      <GlobeDisplay
        globeEl={globeEl}
        windowDimensions={windowDimensions}
        viewMode={viewMode}
        coastlines={coastlines}
        cities={citiesWithRiskCategory} // For coastal/temp modes if still needed
        // Pass other relevant data for existing modes
        citiesWithRealTemp={citiesWithRealTemp}
        citiesWithTempChange={citiesWithTempChange}
        getDynamicLabelSize={getDynamicLabelSize}
        // getCityRiskCategory={getCityRiskCategory} // Already applied in citiesWithRiskCategory
        getTemperatureColor={getTemperatureColor}
        getTemperatureChangeColor={getTemperatureChangeColor}
        pointsData={globePointsData} // For temperature/anomaly modes
        currentPeriod={currentPeriod} // For temperature mode
        temperatureAnomalyData={temperatureAnomalyData} // For anomaly mode
        selectedAnomalyComparisonPeriod={comparisonPeriod} // For anomaly mode
        getPointColor={getPointColor} // For anomaly mode
        getPointAltitude={getPointAltitude} // For anomaly mode
        // Emissions specific props
        countries={countries}
        emissionsData={emissionsData} // This might still be useful for direct access if needed, or can be removed if only getEmissionsForYear is used
        selectedEmissionYear={selectedEmissionYear}
        getEmissionsForYear={getEmissionsForYear}
        getCountryEmissionDetails={getCountryEmissionDetails} // Keep for direct use if any, though primary use is now in Sidebar
        emissionYears={emissionYears} // Keep for context if needed
        // New prop for handling country click
        onCountrySelect={setSelectedCountryIsoA3}
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
