import json
import os

# We will read all recovered json parts if present and assemble the final backup
base_dir = './src/data'
os.makedirs(base_dir, exist_ok=True)
os.makedirs('./public', exist_ok=True)

print("Extractor workspace ready")
