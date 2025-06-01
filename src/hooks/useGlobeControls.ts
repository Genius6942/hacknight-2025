import { useState, useEffect, useRef } from "react";

export function useWindowDimensions() {
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

  return windowDimensions;
}

export function useCameraAltitude(globeEl: React.RefObject<any>) {
  const [cameraAltitude, setCameraAltitude] = useState<number>(2.5);
  const cameraChangeTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (globeEl.current) {
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
  }, [globeEl]);

  return cameraAltitude;
}
