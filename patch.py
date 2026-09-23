import re

with open('src/pages/CheckSearch.tsx', 'r') as f:
    content = f.read()

auto_expand_code = """
  // Auto-expand invoices when filtering
  useEffect(() => {
    const hasFilter = Object.values(filters).some(val => val !== '' && val !== 'ALL');
    if (hasFilter) {
      setExpandedInvoices(new Set(filteredData.invoices.map(inv => inv.id)));
    } else {
      setExpandedInvoices(new Set());
    }
  }, [filters, filteredData.invoices]);

  const toggleInvoice = (id: string) => {
"""

content = content.replace("  const toggleInvoice = (id: string) => {", auto_expand_code)

with open('src/pages/CheckSearch.tsx', 'w') as f:
    f.write(content)
