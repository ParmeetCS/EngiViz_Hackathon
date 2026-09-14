import pandas as pd
from PIL import Image

im = Image.open('New_York_City_.png')
w, h = im.size
print(f"Image dimensions: {w} x {h}")

df = pd.read_csv('AB_NYC_2019.csv')
lon_min, lon_max = -74.258, -73.700
lat_min, lat_max = 40.49979, 40.9153

print('Lon in range:', ((df['longitude'] >= lon_min) & (df['longitude'] <= lon_max)).mean())
print('Lat in range:', ((df['latitude'] >= lat_min) & (df['latitude'] <= lat_max)).mean())

for _, row in df.sample(5, random_state=42).iterrows():
    x = int(((row['longitude'] - lon_min) / (lon_max - lon_min)) * w)
    y = int(((lat_max - row['latitude']) / (lat_max - lat_min)) * h)
    print(f"{row['name'][:25]} | {row['neighbourhood']} ({row['neighbourhood_group']}) -> pixel ({x}, {y})")
