import re

with open('src/data/termsData.tsx', 'r') as f:
    content = f.read()

content = "export const CURRENT_TERMS_VERSION = 'v2_2026_08_25';\n" + content

with open('src/data/termsData.tsx', 'w') as f:
    f.write(content)
