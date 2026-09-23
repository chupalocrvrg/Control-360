import re

with open('src/data/termsData.tsx', 'r') as f:
    content = f.read()

content = content.replace("export const CURRENT_TERMS_VERSION = 'v2_2026_08_25';import React", "export const CURRENT_TERMS_VERSION = 'v2_2026_08_25';\nimport React")

with open('src/data/termsData.tsx', 'w') as f:
    f.write(content)
