import { useRef, useEffect, useState } from "react";
import Globe from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";

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
    coordinates: number[];
  };
}

interface AppCity {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  originalProperties: GeoJsonProperties;
}

function App() {
  const globeEl = useRef<GlobeMethods>(null as any);
  const [coastlines, setCoastlines] = useState<any[]>([]);
  const [cities, setCities] = useState<AppCity[]>([]);
  const [riskThresholdMiles, setRiskThresholdMiles] = useState<number>(25);
  const [cameraAltitude, setCameraAltitude] = useState<number>(2.5);

  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

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

  // Function to calculate distance between two points using Haversine formula
  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in miles
  };

  // Function to find minimum distance from a city to any coastline
  const getDistanceToCoast = (city: AppCity): number => {
    let minDistance = Infinity;

    coastlines.forEach((coastlineFeature: any) => {
      const coordinates = coastlineFeature.geometry.coordinates;

      // Handle different geometry types (LineString vs MultiLineString)
      const processCoordinates = (coords: number[][]) => {
        coords.forEach((coord: number[]) => {
          const distance = calculateDistance(city.lat, city.lng, coord[1], coord[0]);
          minDistance = Math.min(minDistance, distance);
        });
      };

      if (coastlineFeature.geometry.type === "LineString") {
        processCoordinates(coordinates);
      } else if (coastlineFeature.geometry.type === "MultiLineString") {
        coordinates.forEach((lineString: number[][]) => {
          processCoordinates(lineString);
        });
      }
    });

    return minDistance === Infinity ? 0 : minDistance;
  };

  useEffect(() => {
    setCoastlines(coastlineData.features);

    const transformedCities = (citiesRawData.features as GeoJsonFeature[]).map(
      (feature, index) => ({
        id: feature.properties.name + index,
        name: feature.properties.name,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        originalProperties: feature.properties,
      })
    );
    setCities(transformedCities);

    if (globeEl.current) {
      globeEl.current.controls().autoRotate = false;
      globeEl.current.controls().autoRotateSpeed = 0.2;

      // Add event listener for camera changes to track zoom level
      const controls = globeEl.current.controls();
      const onCameraChange = () => {
        if (globeEl.current) {
          const pov = globeEl.current.pointOfView();
          setCameraAltitude(pov.altitude);
        }
      };

      // Listen for control changes (zoom, pan, rotate)
      controls.addEventListener("change", onCameraChange);

      // Clean up event listener
      return () => {
        controls.removeEventListener("change", onCameraChange);
      };
    }
  }, []);

  // Calculate dynamic label size based on camera altitude
  const getDynamicLabelSize = () => {
    // Base size when fully zoomed out (altitude ~2.5)
    const baseSize = 0.6;
    const minSize = 0.2;
    const maxSize = 1.0;

    // Scale inversely with altitude - closer zoom means smaller labels
    const scaleFactor = Math.max(0.3, Math.min(1.5, cameraAltitude / 1.5));
    const dynamicSize = baseSize * scaleFactor;

    return Math.max(minSize, Math.min(maxSize, dynamicSize));
  };

  const isCityAtRisk = (city: AppCity) => {
    if (coastlines.length === 0) return false; // No coastline data loaded yet
    const distanceToCoast = getDistanceToCoast(city);
    return distanceToCoast <= riskThresholdMiles;
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar (unchanged) */}
      <div className="w-1/5 bg-gray-100 p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Coastal Cities Monitor</h2>

        {/* Risk Threshold Slider */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Risk Threshold: {riskThresholdMiles} miles from coast
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
            <span>0 miles</span>
            <span>50 miles</span>
          </div>
        </div>

        {/* At-Risk Cities List */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">
            High Risk Cities ({cities.filter(isCityAtRisk).length})
          </h3>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {cities.filter(isCityAtRisk).map((city) => {
              const distance = coastlines.length > 0 ? getDistanceToCoast(city) : 0;
              return (
                <li key={city.id} className="text-sm text-red-600 font-semibold">
                  {city.name} ({distance.toFixed(1)} mi)
                </li>
              );
            })}
          </ul>
        </div>

        {/* All Cities List */}
        <h3 className="text-lg font-semibold mt-4 mb-2">All Major Cities</h3>
        <ul className="space-y-1 max-h-96 overflow-y-auto">
          {cities.map((city) => {
            const distance = coastlines.length > 0 ? getDistanceToCoast(city) : 0;
            const isAtRisk = isCityAtRisk(city);
            return (
              <li
                key={city.id}
                className={`text-sm ${isAtRisk ? "text-red-600 font-semibold" : ""}`}
              >
                {city.name} ({distance.toFixed(1)} mi)
              </li>
            );
          })}
        </ul>
      </div>

      {/* Globe Section */}
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
          pathsData={coastlines}
          pathPoints={(d: any) => d.geometry.coordinates}
          pathPointLat={(coord: number[]) => coord[1]}
          pathPointLng={(coord: number[]) => coord[0]}
          pathColor={() => "#00FFFF"}
          pathStroke={() => 0.5}
          pathDashGap={0}
          pathDashInitialGap={0}
          labelsData={cities}
          labelLat={(d: any) => d.lat}
          labelLng={(d: any) => d.lng}
          labelText={(d: any) => d.name}
          labelSize={getDynamicLabelSize()}
          labelDotRadius={0.3}
          labelColor={(d: any) => (isCityAtRisk(d as AppCity) ? "red" : "yellow")}
          labelResolution={2}
          onLabelClick={(label: any) => {
            if (globeEl.current) {
              globeEl.current.pointOfView(
                { lat: (label as AppCity).lat, lng: (label as AppCity).lng, altitude: 1 },
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
