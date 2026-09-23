import fs from 'fs';
import { parseAllDocs } from './reconstruct_helpers.ts';

// Read raw dump from user
const raw = JSON.parse(fs.readFileSync('./dump_raw.json', 'utf-8'));
const mainDbKey = Object.keys(raw.indexedDBDump).find(k => k.startsWith('firestore/'));
if (!mainDbKey) {
  console.error("No firestore db key found");
  process.exit(1);
}

const remoteDocs = raw.indexedDBDump[mainDbKey].remoteDocumentsV14 || [];
const parsed = parseAllDocs(remoteDocs);

console.log("=========================================");
console.log("DOCUMENTOS EXTRAÍDOS EXITOSAMENTE:");
for (const [k, v] of Object.entries(parsed)) {
  console.log(`  - ${k}: ${v.length} documentos`);
}
console.log("=========================================");

const backupFile = {
  version: "4.52.0",
  exportDate: new Date().toISOString(),
  totalRecords: Object.values(parsed).reduce((acc, curr) => acc + curr.length, 0),
  dbData: parsed
};

fs.writeFileSync('./public/backup_restaurado_automatico.json', JSON.stringify(backupFile, null, 2));
fs.writeFileSync('./src/data/recoveredBackup.json', JSON.stringify(backupFile, null, 2));

console.log("Generados archivos en ./public/backup_restaurado_automatico.json y ./src/data/recoveredBackup.json");
