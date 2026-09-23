import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/components/TermsAndConditionsInfo.tsx', 'utf-8');

// Fix html2canvas call
content = content.replace(
  "backgroundColor: '#ffffff',",
  "backgroundColor: document.documentElement.classList.contains('dark') ? '#171717' : '#ffffff',"
);

writeFileSync('src/components/TermsAndConditionsInfo.tsx', content);
