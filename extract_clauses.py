import re

with open('src/components/TermsAndConditionsInfo.tsx', 'r') as f:
    content = f.read()

# Match the interface ClauseSection
clause_section_match = re.search(r'(interface ClauseSection \{.*?\})', content, re.DOTALL)
if clause_section_match:
    clause_section = clause_section_match.group(1)
else:
    clause_section = ""

# Match generalClauses
general_clauses_match = re.search(r'(const generalClauses: ClauseSection\[\] = \[.*?\}\s*\];)', content, re.DOTALL)
if general_clauses_match:
    general_clauses = general_clauses_match.group(1)
else:
    general_clauses = ""

# Match privateDerickClauses
private_clauses_match = re.search(r'(const privateDerickClauses: ClauseSection\[\] = \[.*?\}\s*\];)', content, re.DOTALL)
if private_clauses_match:
    private_clauses = private_clauses_match.group(1)
else:
    private_clauses = ""

new_file_content = f"""import React from 'react';

export {clause_section}

export {general_clauses}

export {private_clauses}
"""

with open('src/data/termsData.tsx', 'w') as f:
    f.write(new_file_content)

# Remove them from TermsAndConditionsInfo.tsx
new_content = content.replace(clause_section, "")
new_content = new_content.replace(general_clauses, "")
new_content = new_content.replace(private_clauses, "")

# Add import
new_content = new_content.replace(
    "import { format, parseISO } from 'date-fns';",
    "import { format, parseISO } from 'date-fns';\nimport { ClauseSection, generalClauses, privateDerickClauses } from '../data/termsData';"
)

with open('src/components/TermsAndConditionsInfo.tsx', 'w') as f:
    f.write(new_content)

print("Extracted successfully.")
