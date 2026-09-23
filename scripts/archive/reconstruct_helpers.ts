import fs from 'fs';

// Helper to convert Firestore timestamp map / timestampValue to ISO string or timestamp
function cleanValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') return val;
  if (val.mapValue?.fields) {
    const f = val.mapValue.fields;
    if (f.seconds !== undefined) {
      const s = parseInt(f.seconds.integerValue || f.seconds, 10);
      const ns = parseInt(f.nanoseconds?.integerValue || f.nanoseconds || 0, 10);
      return new Date(s * 1000 + ns / 1000000).toISOString();
    }
    const res: any = {};
    for (const [k, v] of Object.entries(f)) {
      res[k] = cleanValue(v);
    }
    return res;
  }
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  if (val.arrayValue?.values) {
    return val.arrayValue.values.map(cleanValue);
  }
  return val;
}

export function parseAllDocs(remoteDocs: any[]) {
  const result: Record<string, any[]> = {
    employees: [],
    budgets: [],
    checks: [],
    collections: [],
    sales: [],
    auditLogs: [],
    users: [],
    settings: [],
    userSettings: [],
    versions: []
  };

  for (const item of remoteDocs) {
    const col = item.collectionGroup;
    const docId = item.documentId;
    const fields = item.document?.fields || {};
    const data: any = { id: docId };
    
    for (const [key, val] of Object.entries(fields)) {
      data[key] = cleanValue(val);
    }

    if (!result[col]) result[col] = [];
    result[col].push(data);
  }

  return result;
}
