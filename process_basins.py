import geopandas as gpd
import pandas as pd
import os
import json

def process_subbasins():
    # Paths
    base_dir = "/home/aniket/sem-8/Hydro/ass-2"
    shp_path = os.path.join(base_dir, "zone-12-drainage-basins-vector.shp")
    csv_path = os.path.join(base_dir, "output", "catchment_characteristics.csv")
    output_path = "/home/aniket/sem-8/Hydro/ass-2/website/flood_das/geojson/layers/drainage_basins_enriched.geojson"

    print(f"Reading shapefile: {shp_path}")
    gdf = gpd.read_file(shp_path)
    
    # Ensure CRS is 4326 for Leaflet
    if gdf.crs != "EPSG:4326":
        print(f"Reprojecting from {gdf.crs} to EPSG:4326")
        gdf = gdf.to_crs("EPSG:4326")

    print(f"Reading CSV: {csv_path}")
    df = pd.read_csv(csv_path)

    # Convert Basin_ID to same type as DN for joining
    # DN is usually the value from the raster (integer)
    gdf['DN'] = gdf['DN'].astype(int)
    df['Basin_ID'] = df['Basin_ID'].astype(int)

    # Merge
    print("Merging attributes...")
    merged_gdf = gdf.merge(df, left_on='DN', right_on='Basin_ID', how='inner')

    # Save to GeoJSON
    print(f"Saving enriched GeoJSON to: {output_path}")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    merged_gdf.to_file(output_path, driver='GeoJSON')
    print("Success!")

if __name__ == "__main__":
    process_subbasins()
