import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/components/TermsAndConditionsInfo.tsx', 'utf-8');

// Replace html2canvas import with html-to-image
content = content.replace("import html2canvas from 'html2canvas';", "import { toPng } from 'html-to-image';");

// Replace html2canvas call
const oldCanvasCall = `const canvas = await html2canvas(el, { 
        scale: 2,
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#171717' : '#ffffff',
        windowWidth: 1024,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;`;

const newCanvasCall = `const imgData = await toPng(el, {
        cacheBust: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#171717' : '#ffffff',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => (img.onload = resolve));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;`;

// Fallback regex replacement if the string match fails
if (content.includes(oldCanvasCall)) {
  content = content.replace(oldCanvasCall, newCanvasCall);
} else {
  // Let's use regex to replace everything between try { and let heightLeft
  const fnMatch = content.match(/try \{\s*\/\/ Configuramos[\s\S]*?let heightLeft/);
  if (fnMatch) {
    const replacement = `try {
      const imgData = await toPng(el, {
        cacheBust: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#171717' : '#ffffff',
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const img = new Image();
      img.src = imgData;
      await new Promise((resolve) => (img.onload = resolve));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      let heightLeft`;
    content = content.replace(fnMatch[0], replacement);
  } else {
    console.log("Could not match html2canvas block");
  }
}

// Fix another canvas reference
content = content.replace(/heightLeft -= pageHeight;\s*while \(heightLeft > 0\) \{/g, `heightLeft -= pageHeight;\n\n      while (heightLeft > 0) {`);


writeFileSync('src/components/TermsAndConditionsInfo.tsx', content);
