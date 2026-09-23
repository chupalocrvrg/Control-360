import re

with open('src/pages/CheckSearch.tsx', 'r') as f:
    content = f.read()

# Replace the validInvoiceIds logic
old_logic = """    const validInvoiceIds = new Set(filteredChecks.map(c => c.invoiceId));
    let filteredInvoices = invoices.filter(inv => validInvoiceIds.has(inv.id));"""

new_logic = """    const validInvoiceIds = new Set(filteredChecks.map(c => c.invoiceId));
    let filteredInvoices = invoices.filter(inv => validInvoiceIds.has(inv.id));
    
    // Auto-generate virtual invoices for orphaned checks
    const foundInvoiceIds = new Set(filteredInvoices.map(inv => inv.id));
    const orphanedChecks = filteredChecks.filter(c => !foundInvoiceIds.has(c.invoiceId));
    
    if (orphanedChecks.length > 0) {
      // Group orphaned checks by their missing invoiceId or just a dummy ID
      const orphanedGroups = new Map<string, any>();
      orphanedChecks.forEach(c => {
        const id = c.invoiceId || 'orphan-' + c.id;
        if (!orphanedGroups.has(id)) {
          orphanedGroups.set(id, {
            id,
            invoiceNumber: 'S/N',
            beneficiaryName: c.beneficiaryName,
            concept: c.concept || 'Registro sin factura',
            status: c.status === 'PAID' ? 'PAID' : 'PENDING'
          });
        }
      });
      filteredInvoices = [...filteredInvoices, ...Array.from(orphanedGroups.values()) as any];
    }"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
else:
    print("Could not find old_logic block to replace!")

with open('src/pages/CheckSearch.tsx', 'w') as f:
    f.write(content)
