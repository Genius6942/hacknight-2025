import React from "react";
import type { YearlyEmissions, GeoJsonFeature, SectorEmission } from "../../types";
import EmissionsPieChart from "../EmissionsPieChart/EmissionsPieChart"; // Adjust path as needed

interface CountryEmissionDetailsDisplayProps {
  countryName: string;
  selectedYear: number;
  emissionDetails: YearlyEmissions | null;
  globalTotalEmissions: number;
  onClearSelection: () => void;
}

const CountryEmissionDetailsDisplay: React.FC<CountryEmissionDetailsDisplayProps> = ({
  countryName,
  selectedYear,
  emissionDetails,
  globalTotalEmissions,
  onClearSelection,
}) => {
  if (!emissionDetails) {
    return (
      <div className="p-3 text-sm text-gray-400">
        No emission data available for this country and year.
      </div>
    );
  }

  const totalCountryEmissions = emissionDetails.total;
  const percentageOfGlobal =
    globalTotalEmissions > 0 ? (totalCountryEmissions / globalTotalEmissions) * 100 : 0;

  return (
    <div className="mt-4 p-3 bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-white">
          {countryName} - {selectedYear}
        </h3>
        <button
          onClick={onClearSelection}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          Clear
        </button>
      </div>

      <div className="text-xs text-gray-300 mb-1">
        Total Emissions:{" "}
        <strong className="text-white">
          {parseInt(totalCountryEmissions.toFixed(0)).toLocaleString()} MtCO₂e
        </strong>
      </div>
      <div className="text-xs text-gray-300 mb-3">
        Share of Global Emissions:{" "}
        <strong className="text-white">{percentageOfGlobal.toFixed(2)}%</strong>
      </div>

      <EmissionsPieChart
        sectors={emissionDetails.sectors}
        size={120}
        title="Sector Breakdown"
      />
    </div>
  );
};

export default CountryEmissionDetailsDisplay;
