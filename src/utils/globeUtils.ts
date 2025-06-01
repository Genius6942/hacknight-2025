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

export const getTemperatureChangeColor = (change: number | null | undefined): string => {
  if (change === null || change === undefined) return "rgba(128,128,128,0.3)"; // Faint grey for no data
  if (change < -2) return "#0066cc"; // Deep blue for strong cooling
  if (change < -1) return "#4da6ff"; // Medium blue
  if (change < -0.5) return "#66ccff"; // Light blue
  if (change < 0.5) return "#f0f0f0"; // Near zero change (light grey/white)
  if (change < 1) return "#ffcc00"; // Light orange for slight warming
  if (change < 2) return "#ff9900"; // Medium orange
  if (change >= 2) return "#ff0000"; // Bright red for strong warming (changed from cc0000 for more impact)
  return "rgba(128,128,128,0.3)"; // Default fallback
};

export const isTemperatureExtreme = (temperature: number): boolean => {
  return temperature > 35 || temperature < -10;
};

export const getPointSize = (temperature: number | undefined | null): number => {
  if (temperature === undefined || temperature === null) return 0.1;
  return Math.max(0.1, Math.min(0.8, Math.abs(temperature) / 50));
};

export const getAnomalyColor = (diff: number): string => {
  if (diff < -3) return "#0000FF"; // Deep Blue (strong cooling)
  if (diff < -1.5) return "#00FFFF"; // Cyan (moderate cooling)
  if (diff < 0) return "#ADD8E6"; // Light Blue (slight cooling)
  if (diff === 0) return "#FFFFFF"; // White (no change)
  if (diff < 1.5) return "#FFFF00"; // Yellow (slight warming)
  if (diff < 3) return "#FFA500"; // Orange (moderate warming)
  return "#FF0000"; // Red (strong warming)
};

export const getAnomalyAltitude = (diff: number): number => {
  // Scale altitude based on the magnitude of the difference
  // Let's say max diff is around 5-6 degrees, scale to 0.0 to 0.3 for altitude
  const scale = 0.05;
  return Math.max(0.001, Math.abs(diff) * scale);
};

export const getAnomalyPointSize = (diff: number): number => {
  // Base size + increment based on magnitude of difference
  const baseSize = 0.15;
  const increment = Math.abs(diff) * 0.05;
  return Math.min(0.5, baseSize + increment);
};

export function getPointColor(diff: number | undefined | null): string {
  if (diff === undefined || diff === null) return "grey";

  const interpolateColor = (
    value: number,
    p1_val: number,
    p1_rgb: number[],
    p2_val: number,
    p2_rgb: number[]
  ) => {
    // Clamp value to the range [p1_val, p2_val] for interpolation
    const clampedValue = Math.max(p1_val, Math.min(value, p2_val));
    const ratio = p2_val === p1_val ? 1 : (clampedValue - p1_val) / (p2_val - p1_val);
    return [
      Math.round(p1_rgb[0] + ratio * (p2_rgb[0] - p1_rgb[0])),
      Math.round(p1_rgb[1] + ratio * (p2_rgb[1] - p1_rgb[1])),
      Math.round(p1_rgb[2] + ratio * (p2_rgb[2] - p1_rgb[2])),
    ];
  };

  const toRGB = (colorNameOrHex: string) => {
    const colors: { [key: string]: number[] } = {
      lightblue: [173, 216, 230],
      "#FFFFE0": [255, 255, 224], // light yellow
      yellow: [255, 255, 0],
      orange: [255, 165, 0],
      red: [255, 0, 0],
      darkred: [139, 0, 0],
      grey: [128, 128, 128],
    };
    if (colors[colorNameOrHex]) return colors[colorNameOrHex];
    if (colorNameOrHex.startsWith("#") && colorNameOrHex.length === 7) {
      const bigint = parseInt(colorNameOrHex.slice(1), 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }
    return colors["grey"]; // Fallback
  };

  const formatRGB = (rgbArray: number[]) =>
    `rgb(${rgbArray[0]},${rgbArray[1]},${rgbArray[2]})`;

  // Define anchor points for the color scale - adjusted for more sensitivity
  const p0_val = 0,
    p0_rgb = toRGB("lightblue"); // No change or cooler
  const p1_val = 0.75,
    p1_rgb = toRGB("#FFFFE0"); // Slight warming (light yellow)
  const p2_val = 1.5,
    p2_rgb = toRGB("yellow"); // Mild warming
  const p3_val = 3.5,
    p3_rgb = toRGB("orange"); // Moderate warming
  const p4_val = 6,
    p4_rgb = toRGB("red"); // Strong warming
  const p5_val = 16,
    p5_rgb = toRGB("darkred"); // Very strong warming (max expected diff)

  let finalRgb;

  if (diff <= p0_val) finalRgb = p0_rgb;
  else if (diff <= p1_val)
    finalRgb = interpolateColor(diff, p0_val, p0_rgb, p1_val, p1_rgb);
  else if (diff <= p2_val)
    finalRgb = interpolateColor(diff, p1_val, p1_rgb, p2_val, p2_rgb);
  else if (diff <= p3_val)
    finalRgb = interpolateColor(diff, p2_val, p2_rgb, p3_val, p3_rgb);
  else if (diff <= p4_val)
    finalRgb = interpolateColor(diff, p3_val, p3_rgb, p4_val, p4_rgb);
  else finalRgb = interpolateColor(diff, p4_val, p4_rgb, p5_val, p5_rgb); // Scale from red to darkred up to p5_val

  return formatRGB(finalRgb);
}

export function getPointAltitude(diff: number | undefined | null): number {
  const baseAltitude = 0.005; // Ensure points are slightly above surface
  if (diff === undefined || diff === null || diff <= 0) return baseAltitude;
  // Scale altitude based on difference. Max expected diff around 16-20.
  // Let's aim for a max altitude of ~0.3 for a diff of 20. Multiplier = 0.3 / 20 = 0.015
  return baseAltitude + Math.abs(diff) * 0.015;
}
