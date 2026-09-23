import re

with open('src/data/termsData.tsx', 'r') as f:
    content = f.read()
content = content.replace('CURRENT_TERMS_VERSION', 'TERMS_VERSION_CURRENT')
with open('src/data/termsData.tsx', 'w') as f:
    f.write(content)

with open('src/components/SecurityGuard.tsx', 'r') as f:
    content = f.read()
content = content.replace('CURRENT_TERMS_VERSION', 'TERMS_VERSION_CURRENT')
with open('src/components/SecurityGuard.tsx', 'w') as f:
    f.write(content)

