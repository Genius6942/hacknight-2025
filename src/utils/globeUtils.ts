export const calculateDistance = (
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

export const getTemperatureColor = (temperature: number | undefined | null): string => {
  if (temperature === undefined || temperature === null) return "rgba(128,128,128,0.6)";

  // Temperature range: typically -50 to 50°C for this color scale
  const normalized = Math.max(0, Math.min(1, (temperature + 50) / 100));

  // Blue to Red color scale
  const r = Math.floor(255 * normalized);
  const b = Math.floor(255 * (1 - normalized));
  const g = Math.floor(128 * (1 - Math.abs(normalized - 0.5) * 2));

  return `rgba(${r},${g},${b},0.8)`;
};

export const getTemperatureChangeColor = (change: number): string => {
  if (change < -2) return "#0066cc";
  if (change < -1) return "#4da6ff";
  if (change < -0.5) return "#66ccff";
  if (change < 0.5) return "#ffff66";
  if (change < 1) return "#ff9933";
  if (change < 2) return "#ff6600";
  return "#cc0000";
};

export const isTemperatureExtreme = (temperature: number): boolean => {
  return temperature > 35 || temperature < -10;
};

export const getPointSize = (temperature: number | undefined | null): number => {
  if (temperature === undefined || temperature === null) return 0.1;
  return Math.max(0.1, Math.min(0.8, Math.abs(temperature) / 50));
};
