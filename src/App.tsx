import { useRef, useEffect, useState, useMemo } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { useClimateData } from "./useClimateData";

import earthImage from "./assets/earth.jpg";
import coastlineData from "./data/coastline.json";
import citiesRawData from "./data/cities.json";

interface GeoJsonProperties {
  name: string;
  [key: string]: any;
}

interface GeoJsonFeature {
  type: "Feature";
  properties: GeoJsonProperties;
  geometry: {
    type: "Point";
    coordinates: number[]; // [lng, lat]
  };
}

interface AppCity {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  originalProperties: GeoJsonProperties;
  distanceToCoast: number; // precomputed once on load
}

type ViewMode = "coastal" | "temperature" | "climate_change";

function App() {
  const globeEl = useRef<GlobeMethods>(null as any);

  // Raw coastline features
  const [coastlines, setCoastlines] = useState<any[]>([]);
  // Cities array now includes distanceToCoast
  const [cities, setCities] = useState<AppCity[]>([]);
  const [riskThresholdMiles, setRiskThresholdMiles] = useState<number>(25);
  const [cameraAltitude, setCameraAltitude] = useState<number>(2.5);
  const cameraChangeTimeoutRef = useRef<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>("coastal");

  // Climate data states
  const [currentPeriod, setCurrentPeriod] = useState<string>("2021-2040");
  const [comparisonPeriod, setComparisonPeriod] = useState<string>("2081-2100");

  const {
    climateData,
    loading: climateLoading,
    error: climateError,
    timePeriods,
    getTemperatureAtLocation,
    getTemperatureChange,
    getPeriodMetadata,
  } = useClimateData();

  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Haversine distance (miles)
  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Compute minimum distance from a city to any coastline point
  const computeDistanceToCoast = (
    city: Omit<AppCity, "distanceToCoast">,
    coastlineFeatures: any[]
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

  // On mount: load coastline features and compute distanceToCoast for each city
  useEffect(() => {
    // 1) Load raw coastlines
    setCoastlines(coastlineData.features);

    // 2) Transform raw city GeoJSON into AppCity shape (without distance yet)
    const rawCities: Omit<AppCity, "distanceToCoast">[] = (
      citiesRawData.features as GeoJsonFeature[]
    ).map((feature, idx) => ({
      id: feature.properties.name + "_" + idx,
      name: feature.properties.name,
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      originalProperties: feature.properties,
    }));

    // 3) Compute distanceToCoast for each city exactly once
    const computedCities: AppCity[] = rawCities.map((city) => {
      const dist = computeDistanceToCoast(city, coastlineData.features);
      return { ...city, distanceToCoast: dist };
    });
    setCities(computedCities);

    // 4) Set up globe controls (disable auto-rotate, listen to camera changes)
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = false;
      globeEl.current.controls().autoRotateSpeed = 0.2;
      const controls = globeEl.current.controls();
      const onCameraChange = () => {
        if (globeEl.current) {
          const pov = globeEl.current.pointOfView();
          if (cameraChangeTimeoutRef.current) {
            clearTimeout(cameraChangeTimeoutRef.current);
          }
          cameraChangeTimeoutRef.current = window.setTimeout(() => {
            setCameraAltitude(pov.altitude);
          }, 300);
        }
      };
      controls.addEventListener("change", onCameraChange);
      return () => {
        controls.removeEventListener("change", onCameraChange);
        if (cameraChangeTimeoutRef.current) {
          clearTimeout(cameraChangeTimeoutRef.current);
        }
      };
    }
  }, []);

  // Dynamic label size based on camera altitude
  const getDynamicLabelSize = () => {
    const baseSize = 0.6;
    const minSize = 0;
    const maxSize = 1.0;
    const scaleFactor = Math.max(0.3, Math.min(1.5, cameraAltitude / 1.5));
    const dynamicSize = baseSize * scaleFactor;
    return Math.max(minSize, Math.min(maxSize, dynamicSize));
  };

  // Determine if a city is at risk (coastal mode)
  const isCityAtRisk = (city: AppCity) => {
    return city.distanceToCoast <= riskThresholdMiles;
  };

  // Helper: get index of a period string
  const getPeriodIndex = (period: string): number => {
    return timePeriods.indexOf(period);
  };

  // Handlers for period sliders
  const handlePeriodSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(event.target.value, 10);
    setCurrentPeriod(timePeriods[idx]);
  };
  const handleComparisonSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(event.target.value, 10);
    setComparisonPeriod(timePeriods[idx]);
  };

  // Memoize real temperatures per city for the current period
  const citiesWithRealTemp = useMemo(() => {
    return cities.map((city) => {
      const temp = getTemperatureAtLocation(city.lat, city.lng, currentPeriod);
      return { ...city, realTemp: temp };
    });
    // Recompute when cities list changes, or when currentPeriod changes, or when climateData updates
  }, [cities, currentPeriod, climateData]);

  // Memoize temperature changes per city (comparison of two periods)
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
  }, [cities, currentPeriod, comparisonPeriod, climateData]);

  // Memoize high-risk cities (coastal mode)
  const highRiskCities = useMemo(() => {
    return cities.filter((city) => isCityAtRisk(city));
  }, [cities, riskThresholdMiles]);

  // Memoize cities with extreme real temps
  const extremeTempCities = useMemo(() => {
    return citiesWithRealTemp.filter((c) => {
      const temp = c.realTemp;
      return temp !== null && (temp > 35 || temp < -10);
    });
  }, [citiesWithRealTemp]);

  // Memoize cities with significant temp changes (> 1°C)
  const significantChangeCities = useMemo(() => {
    return citiesWithTempChange.filter((c) => {
      const change = c.tempChange;
      return change !== null && Math.abs(change) > 1;
    });
  }, [citiesWithTempChange]);

  // Helpers for coloring
  const isTemperatureExtreme = (temperature: number): boolean => {
    return temperature > 35 || temperature < -10;
  };
  const getTemperatureColor = (temperature: number): string => {
    if (temperature < -10) return "#0066cc";
    if (temperature < 0) return "#4da6ff";
    if (temperature < 10) return "#66ccff";
    if (temperature < 20) return "#ffff66";
    if (temperature < 30) return "#ff9933";
    if (temperature < 35) return "#ff6600";
    return "#cc0000";
  };
  const getTemperatureChangeColor = (change: number): string => {
    if (change < -2) return "#0066cc";
    if (change < -1) return "#4da6ff";
    if (change < -0.5) return "#66ccff";
    if (change < 0.5) return "#ffff66";
    if (change < 1) return "#ff9933";
    if (change < 2) return "#ff6600";
    return "#cc0000";
  };

  return (
    <div className="flex h-screen">
      {/* ================= SIDEBAR ================= */}
      <div className="w-1/5 bg-gray-100 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Climate Monitor</h2>

        {/* Mode Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">View Mode</label>
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => setViewMode("coastal")}
              className={`px-3 py-2 rounded text-sm font-medium ${
                viewMode === "coastal"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 border border-gray-300"
              }`}
            >
              Coastal Risk
            </button>
            <button
              onClick={() => setViewMode("temperature")}
              className={`px-3 py-2 rounded text-sm font-medium ${
                viewMode === "temperature"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 border border-gray-300"
              }`}
            >
              Climate Data (2021–2100)
            </button>
            <button
              onClick={() => setViewMode("climate_change")}
              className={`px-3 py-2 rounded text-sm font-medium ${
                viewMode === "climate_change"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 border border-gray-300"
              }`}
            >
              Temperature Change
            </button>
          </div>
        </div>

        {/* Climate Loading/Error */}
        {(viewMode === "temperature" || viewMode === "climate_change") &&
          climateLoading && (
            <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">
              Loading climate data...
            </div>
          )}
        {(viewMode === "temperature" || viewMode === "climate_change") &&
          climateError && (
            <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
              Error: {climateError}
            </div>
          )}

        {/* —— COASTAL RISK MODE —— */}
        {viewMode === "coastal" && (
          <>
            {/* Risk Threshold Slider */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Risk Threshold: {riskThresholdMiles} miles
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={riskThresholdMiles}
                onChange={(e) => setRiskThresholdMiles(Number(e.target.value))}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>50</span>
              </div>
            </div>

            {/* High Risk Cities */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">
                High Risk Cities ({highRiskCities.length})
              </h3>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {highRiskCities.map((city) => (
                  <li key={city.id} className="text-sm text-red-600 font-semibold">
                    {city.name} ({city.distanceToCoast.toFixed(1)} mi)
                  </li>
                ))}
              </ul>
            </div>

            {/* All Cities List */}
            <h3 className="text-lg font-semibold mt-4 mb-2">All Major Cities</h3>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {cities.map((city) => {
                const atRisk = city.distanceToCoast <= riskThresholdMiles;
                return (
                  <li
                    key={city.id}
                    className={`text-sm ${atRisk ? "text-red-600 font-semibold" : ""}`}
                  >
                    {city.name} ({city.distanceToCoast.toFixed(1)} mi)
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* —— CLIMATE DATA TEMPERATURE MODE —— */}
        {viewMode === "temperature" && !climateLoading && (
          <>
            {/* Time Period Slider */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Time Period: {currentPeriod}
              </label>
              <input
                type="range"
                min="0"
                max={timePeriods.length - 1}
                value={getPeriodIndex(currentPeriod)}
                onChange={handlePeriodSliderChange}
                className="w-full h-2 bg-gradient-to-r from-blue-300 to-red-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                {timePeriods.map((period) => (
                  <span key={period}>{period.split("-")[0]}</span>
                ))}
              </div>
            </div>

            {/* Global Statistics */}
            {getPeriodMetadata(currentPeriod) && (
              <div className="mb-4 p-3 bg-white rounded border">
                <h3 className="text-sm font-semibold mb-2">
                  Global Statistics ({currentPeriod})
                </h3>
                <div className="text-xs space-y-1">
                  <div>
                    Min: {getPeriodMetadata(currentPeriod)?.min_temp.toFixed(1)}°C
                  </div>
                  <div>
                    Max: {getPeriodMetadata(currentPeriod)?.max_temp.toFixed(1)}°C
                  </div>
                  <div>
                    Mean: {getPeriodMetadata(currentPeriod)?.mean_temp.toFixed(1)}°C
                  </div>
                </div>
              </div>
            )}

            {/* Temperature Legend */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Temperature Scale (°C)</h3>
              <div className="space-y-1 text-xs">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#cc0000" }}
                  ></div>
                  <span>Very Hot (35°C+)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#ff6600" }}
                  ></div>
                  <span>Hot (30–35°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#ff9933" }}
                  ></div>
                  <span>Warm (20–30°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#ffff66" }}
                  ></div>
                  <span>Mild (10–20°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#66ccff" }}
                  ></div>
                  <span>Cool (0–10°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#4da6ff" }}
                  ></div>
                  <span>Cold (-10–0°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#0066cc" }}
                  ></div>
                  <span>Very Cold (-10°C–)</span>
                </div>
              </div>
            </div>

            {/* Extreme Temperature Cities */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">
                Extreme Temperatures ({extremeTempCities.length})
              </h3>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {extremeTempCities.map((c) => (
                  <li
                    key={c.id}
                    className="text-sm font-semibold"
                    style={{ color: getTemperatureColor(c.realTemp!) }}
                  >
                    {c.name} ({c.realTemp!.toFixed(1)}°C)
                  </li>
                ))}
              </ul>
            </div>

            {/* All Cities – Real Climate Data */}
            <h3 className="text-lg font-semibold mt-4 mb-2">
              Cities – Real Climate Data
            </h3>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {citiesWithRealTemp.map((c) => {
                const temp = c.realTemp;
                if (temp === null) {
                  return (
                    <li key={c.id} className="text-sm text-gray-400">
                      {c.name} (No data)
                    </li>
                  );
                }
                const isExtreme = isTemperatureExtreme(temp);
                return (
                  <li
                    key={c.id}
                    className={`text-sm ${isExtreme ? "font-semibold" : ""}`}
                    style={{ color: getTemperatureColor(temp) }}
                  >
                    {c.name} ({temp.toFixed(1)}°C)
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* —— TEMPERATURE CHANGE MODE —— */}
        {viewMode === "climate_change" && !climateLoading && (
          <>
            {/* From Period Slider */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                From Period: {currentPeriod}
              </label>
              <input
                type="range"
                min="0"
                max={timePeriods.length - 1}
                value={getPeriodIndex(currentPeriod)}
                onChange={handlePeriodSliderChange}
                className="w-full h-2 bg-blue-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                {timePeriods.map((period) => (
                  <span key={period}>{period.split("-")[0]}</span>
                ))}
              </div>
            </div>

            {/* To Period Slider */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                To Period: {comparisonPeriod}
              </label>
              <input
                type="range"
                min="0"
                max={timePeriods.length - 1}
                value={getPeriodIndex(comparisonPeriod)}
                onChange={handleComparisonSliderChange}
                className="w-full h-2 bg-red-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                {timePeriods.map((period) => (
                  <span key={period}>{period.split("-")[0]}</span>
                ))}
              </div>
            </div>

            {/* Temperature Change Legend */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Temperature Change (°C)</h3>
              <div className="space-y-1 text-xs">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#cc0000" }}
                  ></div>
                  <span>Strong Warming (+2°C+)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#ff6600" }}
                  ></div>
                  <span>Warming (+1 to +2°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#ff9933" }}
                  ></div>
                  <span>Slight Warming (+0.5 to +1°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#ffff66" }}
                  ></div>
                  <span>No Change (-0.5 to +0.5°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#66ccff" }}
                  ></div>
                  <span>Slight Cooling (-1 to -0.5°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#4da6ff" }}
                  ></div>
                  <span>Cooling (-2 to -1°C)</span>
                </div>
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 mr-2"
                    style={{ backgroundColor: "#0066cc" }}
                  ></div>
                  <span>Strong Cooling (-2°C+)</span>
                </div>
              </div>
            </div>

            {/* Temperature Change Cities */}
            <h3 className="text-lg font-semibold mt-4 mb-2">
              Temperature Change ({currentPeriod} → {comparisonPeriod})
            </h3>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {citiesWithTempChange.map((c) => {
                const change = c.tempChange;
                if (change === null) {
                  return (
                    <li key={c.id} className="text-sm text-gray-400">
                      {c.name} (No data)
                    </li>
                  );
                }
                const isSignificant = Math.abs(change) > 1;
                return (
                  <li
                    key={c.id}
                    className={`text-sm ${isSignificant ? "font-semibold" : ""}`}
                    style={{ color: getTemperatureChangeColor(change) }}
                  >
                    {c.name} ({change >= 0 ? "+" : ""}
                    {change.toFixed(1)}°C)
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* ================= GLOBE SECTION ================= */}
      <div className="w-4/5 h-full">
        <Globe
          ref={globeEl}
          width={(windowDimensions.width * 4) / 5}
          height={windowDimensions.height}
          globeImageUrl={earthImage}
          backgroundImageUrl={
            "//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png"
          }
          backgroundColor="rgba(0,0,0,0)"
          // Only show coastlines in coastal mode
          pathsData={viewMode === "coastal" ? coastlines : []}
          pathPoints={(d: any) => d.geometry.coordinates}
          pathPointLat={(coord: number[]) => coord[1]}
          pathPointLng={(coord: number[]) => coord[0]}
          pathColor={() => "#00FFFF"}
          pathStroke={() => 0.5}
          pathDashGap={0}
          pathDashInitialGap={0}
          // Choose labelsData depending on mode
          labelsData={
            viewMode === "temperature"
              ? citiesWithRealTemp
              : viewMode === "climate_change"
              ? citiesWithTempChange
              : cities
          }
          labelLat={(d: any) => d.lat}
          labelLng={(d: any) => d.lng}
          labelText={(d: any) => {
            const city = d as AppCity & { realTemp: number; tempChange: number };
            if (viewMode === "climate_change") {
              const change = city.tempChange;
              if (change !== null) {
                return `${city.name} (${change >= 0 ? "+" : ""}${change.toFixed(1)}°C)`;
              }
            } else if (viewMode === "temperature") {
              const temp = city.realTemp;
              if (temp !== null) {
                return `${city.name} (${temp.toFixed(1)}°C)`;
              }
            }
            return city.name;
          }}
          labelSize={getDynamicLabelSize()}
          labelDotRadius={0.3}
          labelResolution={2}
          labelColor={(d: any) => {
            const city = d as AppCity & { realTemp: number; tempChange: number };
            if (viewMode === "coastal") {
              return isCityAtRisk(city) ? "red" : "yellow";
            } else if (viewMode === "temperature") {
              const temp = city.realTemp;
              if (temp !== null) {
                return getTemperatureColor(temp);
              }
              return "gray";
            } else if (viewMode === "climate_change") {
              const change = city.tempChange;
              if (change !== null) {
                return getTemperatureChangeColor(change);
              }
              return "gray";
            }
            return "yellow";
          }}
          onLabelClick={(label: any) => {
            if (globeEl.current) {
              globeEl.current.pointOfView(
                {
                  lat: (label as AppCity).lat,
                  lng: (label as AppCity).lng,
                  altitude: 1,
                },
                1000
              );
            }
          }}
        />
      </div>
    </div>
  );
}

export default App;
