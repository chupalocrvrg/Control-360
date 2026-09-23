import re

with open('src/components/SecurityGuard.tsx', 'r') as f:
    content = f.read()

content = content.replace("import * as OTPAuth from 'otpauth';", "import * as OTPAuth from 'otpauth';\nimport TermsAcceptanceModal from './TermsAcceptanceModal';\nimport { CURRENT_TERMS_VERSION } from '../data/termsData';")

with open('src/components/SecurityGuard.tsx', 'w') as f:
    f.write(content)
