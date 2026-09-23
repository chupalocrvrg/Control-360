import fs from 'fs';
import path from 'path';

function parseProtobufValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  if (val.arrayValue !== undefined) {
    const arr = val.arrayValue.values || [];
    return arr.map(parseProtobufValue);
  }
  if (val.mapValue !== undefined) {
    const fields = val.mapValue.fields || {};
    const res: any = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = parseProtobufValue(v);
    }
    return res;
  }
  return val;
}

function parseDocument(docObj: any): { id: string; data: any; collection: string } {
  const collection = docObj.collectionGroup;
  const id = docObj.documentId;
  const fields = docObj.document?.fields || {};
  const data: any = { id };
  for (const [k, v] of Object.entries(fields)) {
    data[k] = parseProtobufValue(v);
  }
  return { id, data, collection };
}

export function convertRawDump(dumpObj: any) {
  const mainDbKey = Object.keys(dumpObj.indexedDBDump).find(k => k.startsWith('firestore/'));
  if (!mainDbKey) {
    throw new Error('No se encontró base de datos firestore en el dump');
  }
  const mainDb = dumpObj.indexedDBDump[mainDbKey];
  const remoteDocs = mainDb.remoteDocumentsV14 || [];
  
  const result: Record<string, any[]> = {
    checks: [],
    sales: [],
    collections: [],
    employees: [],
    budgets: [],
    auditLogs: [],
    settings: [],
    userSettings: [],
    users: [],
    versions: []
  };

  for (const item of remoteDocs) {
    const parsed = parseDocument(item);
    if (!result[parsed.collection]) {
      result[parsed.collection] = [];
    }
    result[parsed.collection].push(parsed.data);
  }

  return result;
}
