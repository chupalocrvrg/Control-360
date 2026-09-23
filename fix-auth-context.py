import re

with open('src/contexts/AuthContext.tsx', 'r') as f:
    content = f.read()

if "termsVersion?: string;" not in content:
    content = content.replace("termsAcceptedAt?: string;", "termsAcceptedAt?: string;\n  termsVersion?: string;")

with open('src/contexts/AuthContext.tsx', 'w') as f:
    f.write(content)
