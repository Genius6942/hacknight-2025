const shapefile = require("shapefile");
const fs = require("fs");

async function process() {
  const source = "./natural_earth_countries/ne_50m_admin_0_countries.shp";
  const result = {
    type: "FeatureCollection",
    features: [],
  };

  const reader = await shapefile.open(source);
  let record;

  while (!(record = await reader.read()).done) {
    const { geometry, properties } = record.value;
    if (geometry.type === "Polygon") {
      const rings = geometry.coordinates;
      result.features.push({
        type: "Feature",
        properties,
        geometry: { type: "LineString", coordinates: rings[0] },
      });
    } else if (geometry.type === "MultiPolygon") {
      geometry.coordinates.forEach((polygon) => {
        result.features.push({
          type: "Feature",
          properties,
          geometry: { type: "LineString", coordinates: polygon[0] },
        });
      });
    }
  }

  fs.writeFileSync("../src/data/allLandBoundaries.geojson", JSON.stringify(result));
  console.log("GeoJSON saved to src/data/allLandBoundaries.geojson");
}

process().catch((err) => console.error(err));
