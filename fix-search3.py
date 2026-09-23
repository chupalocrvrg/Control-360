import re

with open('src/pages/CheckSearch.tsx', 'r') as f:
    content = f.read()

content = content.replace("const invoiceChecks = filteredData.checks.filter(c => c.invoiceId === invoice.id)", 
                          "const invoiceChecks = filteredData.checks.filter(c => (c.invoiceId || 'orphan-' + c.id) === invoice.id)")

with open('src/pages/CheckSearch.tsx', 'w') as f:
    f.write(content)
