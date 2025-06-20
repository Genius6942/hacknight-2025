import React, { useState, useEffect, useCallback } from "react";
import type {
  AppCity,
  ViewMode,
  GlobePoint,
  Stats,
  ProcessedEmissionsData,
  YearlyEmissions,
  GeoJsonFeature, // Added GeoJsonFeature
} from "../../types";
import { useClimateData } from "../../hooks/useClimateData";
import CountryEmissionDetailsDisplay from "./CountryEmissionDetailsDisplay"; // Import the new component

interface SidebarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  riskThresholdMiles: number;
  setRiskThresholdMiles: (threshold: number) => void;
  currentPeriod: string;
  setCurrentPeriod: (period: string) => void;
  comparisonPeriod: string;
  setComparisonPeriod: (period: string) => void;
  cities: AppCity[];
  highRiskCities: AppCity[];
  citiesWithRealTemp: AppCity[];
  extremeTempCities: AppCity[];
  citiesWithTempChange: AppCity[];
  getTemperatureColor: (temp: number | undefined | null) => string;
  getTemperatureChangeColor: (change: number) => string;
  isTemperatureExtreme: (temp: number) => boolean;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  showStats: boolean;
  setShowStats: (show: boolean) => void;
  stats: Stats | null;
  timePeriods: string[];
  getPointColor?: (diff: number | undefined | null) => string;
  // Emissions specific props
  selectedEmissionYear: number | null;
  setSelectedEmissionYear: (year: number) => void;
  emissionYears: number[];
  // Country selection props
  selectedCountryIsoA3: string | null;
  onCountrySelect: (isoA3: string | null) => void; // To clear selection
  countries: GeoJsonFeature[]; // For country names
  getCountryEmissionDetails: (
    countryCodeA3: string,
    year: number
  ) => YearlyEmissions | null;
  getTotalGlobalEmissionsForYear: (year: number) => number | null;
}

const Sidebar: React.FC<SidebarProps> = ({
  viewMode,
  setViewMode,
  riskThresholdMiles,
  setRiskThresholdMiles,
  currentPeriod,
  setCurrentPeriod,
  comparisonPeriod,
  setComparisonPeriod,
  cities,
  highRiskCities,
  citiesWithRealTemp,
  extremeTempCities,
  citiesWithTempChange,
  getTemperatureColor,
  getTemperatureChangeColor,
  isTemperatureExtreme,
  isPlaying,
  setIsPlaying,
  showStats,
  setShowStats,
  stats,
  timePeriods: allTimePeriods,
  getPointColor,
  // Emissions specific props
  selectedEmissionYear,
  setSelectedEmissionYear,
  emissionYears,
  // Country selection props
  selectedCountryIsoA3,
  onCountrySelect,
  countries,
  getCountryEmissionDetails,
  getTotalGlobalEmissionsForYear,
}) => {
  const {
    loading: climateLoading,
    error: climateError,
    // emissionsData, // No longer directly needed here for this component's primary display
  } = useClimateData();

  const getPeriodIndex = (period: string): number => {
    return allTimePeriods.indexOf(period);
  };

  const handlePeriodSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(event.target.value, 10);
    setCurrentPeriod(allTimePeriods[idx]);
    setIsPlaying(false); // Stop playing when slider is manually changed
  };

  const handleComparisonSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(event.target.value, 10);
    setComparisonPeriod(allTimePeriods[idx]);
  };

  const handleEmissionYearSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const year = parseInt(event.target.value, 10);
    setSelectedEmissionYear(year);
    // Potentially stop other animations if needed: setIsPlaying(false);
  };

  const handleClearCountrySelection = () => {
    onCountrySelect(null);
  };

  const selectedCountryDetails = React.useMemo(() => {
    if (viewMode === "emissions" && selectedCountryIsoA3 && selectedEmissionYear) {
      return getCountryEmissionDetails(selectedCountryIsoA3, selectedEmissionYear);
    }
    return null;
  }, [viewMode, selectedCountryIsoA3, selectedEmissionYear, getCountryEmissionDetails]);

  const selectedCountryName = React.useMemo(() => {
    if (selectedCountryIsoA3) {
      const country = countries.find((c) => c.properties.ISO_A3 === selectedCountryIsoA3);
      return country?.properties.NAME || selectedCountryIsoA3; // Fallback to ISO code if name not found
    }
    return "";
  }, [selectedCountryIsoA3, countries]);

  const totalGlobalEmissionsForSelectedYear = React.useMemo(() => {
    if (viewMode === "emissions" && selectedEmissionYear) {
      return getTotalGlobalEmissionsForYear(selectedEmissionYear);
    }
    return null;
  }, [viewMode, selectedEmissionYear, getTotalGlobalEmissionsForYear]);

  return (
    <div className="w-1/4 bg-gray-900 text-white p-4 overflow-y-auto shadow-2xl scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
      {" "}
      {/* Added scrollbar styling */}
      {/* <h2 className="text-2xl font-bold mb-6 text-center">Climate Change Dashboard</h2> */}
      {/* View Mode Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2 text-gray-300">View Mode</label>
        <div className="flex flex-col space-y-2 relative">
          <button
            onClick={() => setViewMode("temp_anomaly")}
            className={`px-4 py-2 rounded text-sm font-semibold transition-all duration-150 ease-in-out ${
              viewMode === "temp_anomaly"
                ? "bg-purple-600 hover:bg-purple-700 text-white shadow-md"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
            }`}
          >
            Temperature Anomaly
          </button>
          <button
            onClick={() => setViewMode("emissions")}
            className={`px-4 py-2 rounded text-sm font-semibold transition-all duration-150 ease-in-out ${
              viewMode === "emissions"
                ? "bg-green-600 hover:bg-green-700 text-white shadow-md"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
            }`}
          >
            Global Emissions
          </button>
          <div className="flex gap-2 items-center w-full">
            <button
              onClick={() => setViewMode("temperature")}
              className={`flex-1 px-4 py-2 rounded text-sm font-semibold transition-all duration-150 ease-in-out ${
                viewMode === "temperature"
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
              }`}
            >
              Global Temperature
            </button>
            <button
              onClick={() => setViewMode("climate_change")}
              className={`flex-1 px-4 py-2 rounded text-sm font-semibold transition-all duration-150 ease-in-out ${
                viewMode === "climate_change"
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
              }`}
            >
              Temperature Change
            </button>
          </div>
          <button
            onClick={() => setViewMode("coastal")}
            className={`px-4 py-2 rounded text-sm font-semibold transition-all duration-150 ease-in-out ${
              viewMode === "coastal"
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                : "bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
            }`}
          >
            Coastal Risk
          </button>
        </div>
      </div>
      {/* Loading/Error Indicators */}
      {(viewMode === "temperature" ||
        viewMode === "climate_change" ||
        viewMode === "temp_anomaly" ||
        viewMode === "emissions") && // Added emissions
        climateLoading && (
          <div className="mb-4 p-3 bg-blue-800 bg-opacity-50 text-blue-300 rounded border border-blue-700">
            Loading climate data...
          </div>
        )}
      {(viewMode === "temperature" ||
        viewMode === "climate_change" ||
        viewMode === "temp_anomaly" ||
        viewMode === "emissions") && // Added emissions
        climateError && (
          <div className="mb-4 p-3 bg-red-800 bg-opacity-50 text-red-300 rounded border border-red-700">
            Error: {climateError}
          </div>
        )}
      {/* Emissions Year Slider */}
      {viewMode === "emissions" && emissionYears.length > 0 && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
          <label className="block text-sm font-medium mb-2 text-gray-300">
            Emission Year: {selectedEmissionYear}
          </label>
          <input
            type="range"
            min={emissionYears[0]}
            max={emissionYears[emissionYears.length - 1]}
            value={selectedEmissionYear || emissionYears[0]}
            onChange={handleEmissionYearSliderChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{emissionYears[0]}</span>
            <span>{emissionYears[emissionYears.length - 1]}</span>
          </div>
        </div>
      )}
      {/* Global Emissions Summary Card*/}
      {viewMode === "emissions" &&
        selectedEmissionYear &&
        totalGlobalEmissionsForSelectedYear !== null && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-md font-semibold mb-2 text-gray-200 text-center">
              Global Emissions Summary
            </h3>
            <div className="text-center text-sm text-gray-300">
              Total Emissions for {selectedEmissionYear}:{" "}
              <span className="font-bold text-green-400">
                {parseInt(
                  totalGlobalEmissionsForSelectedYear.toFixed(0)
                ).toLocaleString()}{" "}
                MtCO₂e
              </span>
            </div>
          </div>
        )}
      {/* Country Emission Details Display */}
      {viewMode === "emissions" &&
        selectedCountryIsoA3 &&
        selectedCountryDetails &&
        selectedEmissionYear && (
          <CountryEmissionDetailsDisplay
            countryName={selectedCountryName}
            emissionDetails={selectedCountryDetails}
            selectedYear={selectedEmissionYear}
            globalTotalEmissions={totalGlobalEmissionsForSelectedYear ?? 0}
            onClearSelection={handleClearCountrySelection}
          />
        )}
      {/* Time Period Controls */}
      {(viewMode === "temperature" || viewMode === "climate_change") && // temp_anomaly will have its own controls
        !climateLoading &&
        allTimePeriods.length > 0 && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-300">
                Time Period: {currentPeriod}
              </label>
              {/* <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-3 py-1.5 rounded text-xs font-bold transition-colors duration-150 ease-in-out shadow-md
                ${
                  isPlaying
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                } text-white`}
              >
                {isPlaying ? "⏸️ Pause" : "▶️ Play"}
              </button> */}
            </div>
            <input
              type="range"
              min="0"
              max={allTimePeriods.length - 1}
              value={getPeriodIndex(currentPeriod)}
              onChange={handlePeriodSliderChange}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 range-slider-thumb"
              // style={{ background: 'linear-gradient(to right, #4CAF50, #FF9800, #F44336)' }} // Using Tailwind class instead if possible or keep for specific gradient
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              {allTimePeriods.map((period) => (
                <span
                  key={period}
                  className="transform -rotate-30 whitespace-nowrap origin-center text-[10px] text-center w-1/${allTimePeriods.length}"
                >
                  {period.split("-")[0]}
                </span>
              ))}
            </div>
          </div>
        )}
      {/* Comparison Period Slider - only if viewMode is climate_change */}
      {viewMode === "climate_change" && !climateLoading && allTimePeriods.length > 0 && (
        <div className="my-6 p-4 bg-gray-800 rounded-lg shadow-lg">
          <label className="block text-sm font-medium mb-2 text-gray-300">
            Compare with: {comparisonPeriod}
          </label>
          <input
            type="range"
            min="0"
            max={allTimePeriods.length - 1}
            value={getPeriodIndex(comparisonPeriod)}
            onChange={handleComparisonSliderChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 range-slider-thumb"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            {allTimePeriods.map((period) => (
              <span
                key={period}
                className="transform -rotate-30 whitespace-nowrap origin-center text-[10px] text-center w-1/${allTimePeriods.length}"
              >
                {period.split("-")[0]}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Comparison Period Controls for Temperature Anomaly */}
      {viewMode === "temp_anomaly" && !climateLoading && allTimePeriods.length > 0 && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            Comparison Period (vs. 2021-2040): {comparisonPeriod}
          </label>
          <input
            type="range"
            min="0"
            max={allTimePeriods.length - 1}
            value={getPeriodIndex(comparisonPeriod)}
            onChange={handleComparisonSliderChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 range-slider-thumb"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            {allTimePeriods.map((period) => (
              <span
                key={period}
                className={`transform -rotate-30 whitespace-nowrap origin-center text-[10px] text-center w-1/${
                  allTimePeriods.length
                } ${period === "2021-2040" ? "font-bold text-purple-400" : ""}`}
              >
                {period.split("-")[0]}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Baseline: 2021-2040</p>
        </div>
      )}
      {/* Statistics Display */}
      {(viewMode === "temperature" || viewMode === "climate_change") &&
        showStats &&
        stats &&
        !climateLoading && (
          <div className="mb-6 p-3 bg-gray-800 rounded-lg shadow-lg">
            <div className="text-sm mb-2 font-semibold text-gray-300">
              📊 Temperature Statistics ({currentPeriod})
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-300">
              <div>Min: {stats.min.toFixed(1)}°C</div>
              <div>Avg: {stats.avg.toFixed(1)}°C</div>
              <div>Max: {stats.max.toFixed(1)}°C</div>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Data points: {stats.count}
            </div>
          </div>
        )}
      {/* Color Legend */}
      {viewMode === "temperature" && !climateLoading && (
        <div className="mb-6 p-3 bg-gray-800 rounded-lg shadow-lg">
          <div className="text-sm mb-2 font-semibold text-gray-300">
            Temperature Scale
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">-50°C</span>
            <div
              className="h-3 flex-1 mx-3 rounded-md shadow-inner"
              style={{
                background:
                  "linear-gradient(to right, rgb(0,128,255), rgb(0,255,255), rgb(128,255,128), rgb(255,255,0), rgb(255,128,0), rgb(255,0,0))",
              }}
            ></div>
            <span className="text-xs text-gray-400">+50°C</span>
          </div>
        </div>
      )}
      {viewMode === "climate_change" && !climateLoading && (
        <div className="mb-6 p-3 bg-gray-800 rounded-lg shadow-lg">
          <div className="text-sm mb-2 font-semibold text-gray-300">
            Temperature Scale
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">-2°C</span>
            <div
              className="h-3 flex-1 mx-3 rounded-md shadow-inner"
              style={{
                background:
                  "linear-gradient(to right, rgb(0,128,255), rgb(0,255,255), rgb(128,255,128), rgb(255,255,0), rgb(255,128,0), rgb(255,0,0))",
              }}
            ></div>
            <span className="text-xs text-gray-400">+2°C</span>
          </div>
        </div>
      )}
      {/* Temperature Anomaly Color Legend */}
      {viewMode === "temp_anomaly" && !climateLoading && (
        <div className="mb-6 p-3 bg-gray-800 rounded-lg shadow-lg">
          <div className="text-sm mb-2 font-semibold text-gray-300">
            🌡️ Temperature Anomaly Scale (°C)
          </div>
          <div className="relative w-full h-8 mb-2">
            <div
              className="w-full h-full rounded-md shadow-inner"
              style={{
                background: `linear-gradient(to right, 
                  ${getPointColor ? getPointColor(-2) : "grey"}, 
                  ${getPointColor ? getPointColor(0) : "grey"}, 
                  ${getPointColor ? getPointColor(0.75) : "grey"}, 
                  ${getPointColor ? getPointColor(1.5) : "grey"}, 
                  ${getPointColor ? getPointColor(3.5) : "grey"}, 
                  ${getPointColor ? getPointColor(6) : "grey"}, 
                  ${getPointColor ? getPointColor(16) : "grey"}
                )`,
              }}
            ></div>
            <div className="absolute top-full left-0 w-full flex justify-between text-xs text-gray-400 mt-1">
              <span>-2°</span>
              <span>0°</span>
              <span>+16°</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-4">
            Colors represent the temperature difference compared to the 2021-2040
            baseline.
          </p>
        </div>
      )}
      {/* Toggle Controls */}
      {(viewMode === "temperature" || viewMode === "climate_change") &&
        !climateLoading && (
          <div className="flex justify-between items-center text-xs text-gray-400 mt-4 p-3 bg-gray-800 rounded-lg shadow-lg">
            <button
              onClick={() => setShowStats(!showStats)}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600 px-2 py-1 rounded text-xs transition-colors duration-150"
            >
              {showStats ? "Hide Stats" : "Show Stats"}
            </button>
            <div className="text-[10px]">Source: WorldClim / ACCESS-CM2</div>
          </div>
        )}
      {/* Coastal Risk specific UI */}
      {viewMode === "coastal" && (
        <>
          <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Sea Level Rise: {riskThresholdMiles} miles inland
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={riskThresholdMiles}
              onChange={(e) => setRiskThresholdMiles(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 range-slider-thumb"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0</span>
              <span>50</span>
            </div>
          </div>

          <div className="mb-4 p-3 bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-200">
              High Risk Cities ({highRiskCities.length})
            </h3>
            <ul className="space-y-1 max-h-40 overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {highRiskCities.map((city) => (
                <li
                  key={city.id}
                  className={`font-semibold ${
                    city.riskCategory === "submerged" ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  {city.name} ({city.distanceToCoast.toFixed(1)} mi)
                  {city.riskCategory === "submerged" && " (Submerged)"}
                  {city.riskCategory === "at_risk" && " (At Risk)"}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-200">All Major Cities</h3>
            <ul className="space-y-1 max-h-48 overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              {cities.map((city) => {
                let textColor = "text-green-400";
                let riskLabel = " (Low Risk)";
                if (city.riskCategory === "submerged") {
                  textColor = "text-red-400 font-semibold";
                  riskLabel = " (Submerged)";
                } else if (city.riskCategory === "at_risk") {
                  textColor = "text-yellow-400 font-semibold";
                  riskLabel = " (At Risk)";
                }
                return (
                  <li key={city.id} className={`${textColor}`}>
                    {city.name} ({city.distanceToCoast.toFixed(1)} mi)
                    {riskLabel}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
      {/* Coastal Risk Controls */}
      {viewMode === "coastal" && !climateLoading && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            Comparison Period (for Coastal Risk): {comparisonPeriod}
          </label>
          <input
            type="range"
            min="0"
            max={allTimePeriods.length - 1}
            value={getPeriodIndex(comparisonPeriod)}
            onChange={handleComparisonSliderChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500 range-slider-thumb"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            {allTimePeriods.map((period) => (
              <span
                key={period}
                className={`transform -rotate-30 whitespace-nowrap origin-center text-[10px] text-center w-1/${
                  allTimePeriods.length
                } ${period === "2021-2040" ? "font-bold text-purple-400" : ""}`}
              >
                {period.split("-")[0]}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Baseline: 2021-2040</p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
