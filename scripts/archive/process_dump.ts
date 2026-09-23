import fs from 'fs';
import { convertRawDump } from './convert_dump.ts';

const rawData = JSON.parse(fs.readFileSync('./dump_raw.json', 'utf-8'));
const converted = convertRawDump(rawData);

console.log("Resumen de colecciones recuperadas:");
for (const [col, items] of Object.entries(converted)) {
  console.log(`- ${col}: ${items.length} registros`);
}

const backupFormat = {
  version: "4.52.0",
  exportDate: new Date().toISOString(),
  totalRecords: Object.values(converted).reduce((acc, curr) => acc + curr.length, 0),
  data: converted
};

fs.writeFileSync('./public/backup_restaurado_automatico.json', JSON.stringify(backupFormat, null, 2));
fs.writeFileSync('./backup_clean.json', JSON.stringify(converted, null, 2));
console.log("¡Archivo guardado en public/backup_restaurado_automatico.json!");
