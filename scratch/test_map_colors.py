from PIL import Image, ImageOps, ImageEnhance
import numpy as np

im = Image.open('New_York_City_.png').convert('RGB')
arr = np.array(im)

# Inspect colors in New_York_City_.png
print("Unique sample colors:", arr[::100, ::100, :].reshape(-1, 3)[:10])

# Let's create a dark-themed version or test styling:
# In New_York_City_.png:
# Water is white [255, 255, 255]
# Land (NYC Boroughs) is dark gray [96, 96, 96]
# Neighborhood borders are white/light gray
# Non-NYC land is medium gray [179, 179, 179]
