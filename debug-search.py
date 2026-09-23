import re

with open('src/pages/CheckSearch.tsx', 'r') as f:
    content = f.read()

debug_log = """
    console.log("Filters:", filters);
    console.log("Checks before filter:", checks.length);
    console.log("Filtered checks count:", filteredChecks.length);
    console.log("Valid invoice IDs count:", validInvoiceIds.size);
    console.log("Filtered invoices count:", filteredInvoices.length);
    
    return { invoices: filteredInvoices, checks: filteredChecks };
"""

content = content.replace("return { invoices: filteredInvoices, checks: filteredChecks };", debug_log)

with open('src/pages/CheckSearch.tsx', 'w') as f:
    f.write(content)
