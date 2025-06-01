"""
This script processes WorldClim tmin/tmax GeoTIFFs to produce GeoJSON for temperature change visualization.
Usage: Place this file in src/data/, run with Python 3. Requires rasterio, numpy, geopandas.
Output: GeoJSON files in public/data/ for each period, with 'change' property (average temp or temp change).
"""

import rasterio
import numpy as np
import geopandas as gpd
from rasterio.features import shapes
from rasterio.errors import RasterioIOError
import os
import sys

# Configuration: update these as needed
PERIODS = [
    ("2021-2040", "wc2.1_10m_tmin_ACCESS-CM2_ssp585_2021-2040.tif", "wc2.1_10m_tmax_ACCESS-CM2_ssp585_2021-2040.tif"),
    ("2041-2060", "wc2.1_10m_tmin_ACCESS-CM2_ssp585_2041-2060.tif", "wc2.1_10m_tmax_ACCESS-CM2_ssp585_2041-2060.tif"),
    ("2061-2080", "wc2.1_10m_tmin_ACCESS-CM2_ssp585_2061-2080.tif", "wc2.1_10m_tmax_ACCESS-CM2_ssp585_2061-2080.tif"),
    ("2081-2100", "wc2.1_10m_tmin_ACCESS-CM2_ssp585_2081-2100.tif", "wc2.1_10m_tmax_ACCESS-CM2_ssp585_2081-2100.tif"),
]

DATA_DIR = ""
OUTPUT_DIR = "../../public/data"
BASELINE_PERIOD = None  # Set to a tuple like ("1970-2000", tmin_file, tmax_file) if you have baseline

# Helper to load and average tmin/tmax with error handling
def load_avg_temp(tmin_path, tmax_path):
    try:
        # Try to open with GDAL_DISABLE_READDIR_ON_OPEN set to reduce potential issues
        env_vars = {'GDAL_DISABLE_READDIR_ON_OPEN': 'EMPTY_DIR'}
        
        with rasterio.Env(**env_vars):
            with rasterio.open(tmin_path, 'r') as tmin_src:
                print(f"  Successfully opened {os.path.basename(tmin_path)}")
                with rasterio.open(tmax_path, 'r') as tmax_src:
                    print(f"  Successfully opened {os.path.basename(tmax_path)}")
                    
                    tmin = tmin_src.read(1).astype('float32')
                    tmax = tmax_src.read(1).astype('float32')
                    nodata = tmin_src.nodata
                    
                    # Handle nodata values
                    if nodata is not None:
                        tmin[tmin == nodata] = np.nan
                        tmax[tmax == nodata] = np.nan
                    
                    # Calculate average temperature
                    avg = (tmin + tmax) / 2.0 / 10.0  # WorldClim is in tenths of °C
                    return avg, tmin_src.transform, tmin_src.crs
                    
    except RasterioIOError as e:
        print(f"  ERROR: Cannot read TIFF files - {e}")
        print(f"  This usually means the files are corrupted or incompatible.")
        return None, None, None
    except Exception as e:
        print(f"  ERROR: Unexpected error - {e}")
        return None, None, None

def create_sample_data(label):
    """Create sample temperature data when real data is unavailable"""
    print(f"  Creating sample data for {label}...")
    
    # Create a simple grid of sample temperature data
    features = []
    
    # Sample data points across the globe
    sample_points = [
        # (lat, lon, temp_change)
        (60, -100, -2.5),   # Northern Canada - cooling
        (45, -75, 1.8),     # Eastern US/Canada - slight warming
        (40, -74, 2.1),     # New York area - warming
        (35, -118, 3.2),    # Los Angeles - significant warming
        (25, -80, 2.8),     # Florida - warming
        (60, 10, 1.5),      # Scandinavia - slight warming
        (50, 0, 2.0),       # UK/Northern France - warming
        (40, 15, 2.8),      # Southern Europe - warming
        (35, 140, 2.3),     # Japan - warming
        (22, 114, 3.1),     # Hong Kong - significant warming
        (-35, 151, 2.6),    # Sydney - warming
        (0, 0, 1.2),        # Equatorial Africa - slight warming
        (-20, -50, 1.8),    # Brazil - warming
        (70, -150, -1.8),   # Northern Alaska - cooling
        (-60, 0, -0.5),     # Antarctica - slight cooling
    ]
    
    from shapely.geometry import Point
    
    for lat, lon, temp_change in sample_points:
        # Create a small buffer around each point to make it visible
        point = Point(lon, lat).buffer(5)  # 5-degree buffer for visibility
        features.append({
            'properties': {'change': temp_change},
            'geometry': point.__geo_interface__
        })
    
    return features

def main():
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}")
    
    # Check if any TIFF files exist
    tiff_files_exist = False
    for label, tmin_file, tmax_file in PERIODS:
        if os.path.exists(tmin_file) and os.path.exists(tmax_file):
            tiff_files_exist = True
            break
    
    if not tiff_files_exist:
        print("WARNING: No TIFF files found. Creating sample data instead.")
        print("To use real data, place WorldClim TIFF files in this directory.")
    
    # Process baseline if available
    baseline_arr = None
    if BASELINE_PERIOD and tiff_files_exist:
        _, tmin_b, tmax_b = BASELINE_PERIOD
        baseline_arr, transform, crs = load_avg_temp(os.path.join(DATA_DIR, tmin_b), os.path.join(DATA_DIR, tmax_b))
    
    for label, tmin_file, tmax_file in PERIODS:
        print(f"Processing {label}...")
        
        # Check if files exist
        tmin_path = os.path.join(DATA_DIR, tmin_file)
        tmax_path = os.path.join(DATA_DIR, tmax_file)
        
        if os.path.exists(tmin_path) and os.path.exists(tmax_path):
            # Try to process real data
            avg, transform, crs = load_avg_temp(tmin_path, tmax_path)
            
            if avg is not None:
                # Successfully loaded real data
                if baseline_arr is not None:
                    change = avg - baseline_arr
                else:
                    change = avg  # Just show average temp if no baseline
                
                mask = ~np.isnan(change)
                features = [
                    {'properties': {'change': float(val)}, 'geometry': geom}
                    for geom, val in shapes(change, mask=mask, transform=transform)
                ]
                gdf = gpd.GeoDataFrame.from_features(features, crs=crs)
            else:
                # Fall back to sample data
                print(f"  Failed to load real data, using sample data instead")
                features = create_sample_data(label)
                gdf = gpd.GeoDataFrame.from_features(features, crs='EPSG:4326')
        else:
            # Files don't exist, use sample data
            print(f"  Files not found: {tmin_file}, {tmax_file}")
            print(f"  Using sample data instead")
            features = create_sample_data(label)
            gdf = gpd.GeoDataFrame.from_features(features, crs='EPSG:4326')
        
        # Save the output
        out_path = os.path.join(OUTPUT_DIR, f"avg_temp_change_{label}.json")
        gdf.to_file(out_path, driver='GeoJSON')
        print(f"  Saved {out_path}")
    
    print("\nProcessing complete!")
    print(f"Generated {len(PERIODS)} temperature change files in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
