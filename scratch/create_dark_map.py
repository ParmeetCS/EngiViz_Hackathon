from PIL import Image, ImageFilter
import numpy as np

im = Image.open('New_York_City_.png').convert('RGB')
arr = np.array(im)
gray = arr[:, :, 0]

out = np.zeros_like(arr)

# Enhanced contrast palette:
# Water: #080f20 -> [8, 15, 32]
# Non-NYC Land (NJ): #0f182c -> [15, 24, 44]
# NYC Landmass: #162035 -> [22, 32, 53]
# Neighborhood Lines: #415278 -> [65, 82, 120] (sharp clear blue-gray lines)
# Coastlines / Water edges: #566c9e -> [86, 108, 158]

is_water = gray > 240
is_boundary = (gray > 195) & (gray <= 240)
is_nj = (gray > 135) & (gray <= 195)
is_nyc = gray <= 135

out[is_water] = [8, 15, 32]
out[is_nj] = [15, 24, 44]
out[is_nyc] = [22, 32, 53]
out[is_boundary] = [70, 88, 128]

dark_map = Image.fromarray(out.astype(np.uint8))
dark_map.save('New_York_City_dark.png')
dark_map.save('stitch_assets/New_York_City_dark.png')
print("Saved refined New_York_City_dark.png!")
