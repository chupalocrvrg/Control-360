import re

with open('src/pages/CheckSearch.tsx', 'r') as f:
    content = f.read()

old_logic = """    if (filters.invoice) {
      const term = filters.invoice.toLowerCase();
      filteredInvoices = filteredInvoices.filter(inv => (inv.invoiceNumber || '').toLowerCase().includes(term));
      const finalInvoiceIds = new Set(filteredInvoices.map(inv => inv.id));
      filteredChecks = filteredChecks.filter(c => finalInvoiceIds.has(c.invoiceId));
    }"""

new_logic = """    if (filters.invoice) {
      const term = filters.invoice.toLowerCase();
      filteredInvoices = filteredInvoices.filter(inv => (inv.invoiceNumber || '').toLowerCase().includes(term));
      const finalInvoiceIds = new Set(filteredInvoices.map(inv => inv.id));
      filteredChecks = filteredChecks.filter(c => finalInvoiceIds.has(c.invoiceId || 'orphan-' + c.id));
    }"""

content = content.replace(old_logic, new_logic)

with open('src/pages/CheckSearch.tsx', 'w') as f:
    f.write(content)
