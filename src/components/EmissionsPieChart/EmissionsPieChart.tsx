import React from "react";
import type { SectorEmission } from "../../types";

interface EmissionsPieChartProps {
  sectors: SectorEmission[];
  size?: number;
  title?: string;
}

const EmissionsPieChart: React.FC<EmissionsPieChartProps> = ({
  sectors,
  size = 100,
  title,
}) => {
  if (!sectors || sectors.length === 0) {
    return (
      <div
        style={{
          fontSize: "12px",
          color: "#aaa",
          textAlign: "center",
          padding: "10px 0",
        }}
      >
        No sector data available
      </div>
    );
  }

	sectors = sectors.sort((a, b) => b.value - a.value); // Sort sectors by value in descending order

  const totalValue = sectors.reduce((sum, item) => sum + item.value, 0);

  if (totalValue === 0) {
    return (
      <div
        style={{
          fontSize: "12px",
          color: "#aaa",
          textAlign: "center",
          padding: "10px 0",
        }}
      >
        Sector emissions are zero.
      </div>
    );
  }

  let accumulatedAngle = -90; // Start from top for a more standard pie chart look
  const colors = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#FFCD56",
    "#C9CBCF",
    "#F7464A",
    "#46BFBD",
    "#FDB45C",
    "#949FB1",
  ];
  const radius = size / 2.2; // Slightly smaller radius for segments to fit within the viewbox

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {title && (
        <div
          style={{
            fontSize: "13px",
            fontWeight: "bold",
            marginBottom: "8px",
            color: "#e0e0e0",
          }}
        >
          {title}
        </div>
      )}
      <svg
        width={size}
        height={size}
        viewBox={`-${size / 2} -${size / 2} ${size} ${size}`}
      >
        <g>
          {sectors.map((item, index) => {
            if (item.value <= 0) return null; // Don't render segments for zero/negative values
            const angle = (item.value / totalValue) * 360;
            const startAngleRad = (Math.PI / 180) * accumulatedAngle;
            accumulatedAngle += angle;
            const endAngleRad = (Math.PI / 180) * accumulatedAngle;

            const x1 = Math.cos(startAngleRad) * radius;
            const y1 = Math.sin(startAngleRad) * radius;
            const x2 = Math.cos(endAngleRad) * radius;
            const y2 = Math.sin(endAngleRad) * radius;
            const largeArcFlag = angle > 180 ? 1 : 0;

            const pathD = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
            return (
              <path
                key={item.sectorName}
                d={pathD}
                fill={colors[index % colors.length]}
              />
            );
          })}
        </g>
      </svg>
      <div
        style={{
          fontSize: "11px",
          marginTop: "10px",
          maxHeight: "100px",
          overflowY: "auto",
          width: "100%",
          paddingRight: "5px",
        }}
      >
        {sectors.map((item, index) => {
          if (item.value <= 0) return null;
          const percentage = ((item.value / totalValue) * 100).toFixed(1);
          return (
            <div
              key={`${item.sectorName}-legend`}
              style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  backgroundColor: colors[index % colors.length],
                  marginRight: "6px",
                  borderRadius: "3px",
                  flexShrink: 0,
                }}
              ></span>
              <span
                style={{
                  // color: "#ccc",
                  // whiteSpace: "nowrap",
                  // overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={`${item.sectorName}: ${item.value.toFixed(
                  2
                )} MtCO₂e (${percentage}%)`}
              >
                {item.sectorName}: {parseInt(item.value.toFixed(0)).toLocaleString()} MtCO₂e ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmissionsPieChart;
