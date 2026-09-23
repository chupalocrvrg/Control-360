with open('src/components/SecurityGuard.tsx', 'r') as f:
    content = f.read()

content = content.replace("import * as OTPAuth from 'otpauth';import TermsAcceptanceModal from './TermsAcceptanceModal';import { TERMS_VERSION_CURRENT } from '../data/termsData';export default function SecurityGuard({ children }: { children: React.ReactNode }) {",
"import * as OTPAuth from 'otpauth';\\nimport TermsAcceptanceModal from './TermsAcceptanceModal';\\nimport { TERMS_VERSION_CURRENT } from '../data/termsData';\\nexport default function SecurityGuard({ children }: { children: React.ReactNode }) {")

# Also format termsData.tsx
with open('src/data/termsData.tsx', 'r') as f:
    td = f.read()
td = td.replace("export const TERMS_VERSION_CURRENT = 'v2_2026_08_25';import React from 'react';", "export const TERMS_VERSION_CURRENT = 'v2_2026_08_25';\\nimport React from 'react';")
with open('src/data/termsData.tsx', 'w') as f:
    f.write(td)

with open('src/components/SecurityGuard.tsx', 'w') as f:
    f.write(content)

