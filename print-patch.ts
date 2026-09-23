import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/components/TermsAndConditionsInfo.tsx', 'utf-8');

// Add imports
if (!content.includes('import { useNotification }')) {
  content = content.replace(
    "import React, { useState } from 'react';",
    "import React, { useState, useRef } from 'react';\nimport { useNotification } from '../contexts/NotificationContext';\nimport html2canvas from 'html2canvas';\nimport jsPDF from 'jspdf';"
  );
} else {
  // If useNotification is imported, just add html2canvas and jsPDF and useRef
  if (!content.includes('import html2canvas')) {
    content = content.replace(
        "import React, { useState } from 'react';",
        "import React, { useState, useRef } from 'react';\nimport html2canvas from 'html2canvas';\nimport jsPDF from 'jspdf';"
    );
  }
}

// Add state and hooks
content = content.replace(
  "const [searchTerm, setSearchTerm] = useState('');",
  "const [searchTerm, setSearchTerm] = useState('');\n  const { showToast } = useNotification();\n  const [isPrinting, setIsPrinting] = useState(false);\n  const printRef = useRef<HTMLDivElement>(null);"
);

// Replace handlePrintCertificate
const newPrintFn = `const handlePrintCertificate = async () => {
    if (!printRef.current) return;
    
    // Si estamos en iframe sin permisos, window.print falla silenciosamente.
    // En su lugar, generamos un PDF
    setIsPrinting(true);
    showToast('Generando documento PDF...', 'info');
    
    const el = printRef.current;
    
    try {
      // Configuramos el html2canvas para que renderice con fondo blanco y tome todo el scroll
      const canvas = await html2canvas(el, { 
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 1024,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(\`Constancia_Terminos_\${activeDocument === 'DERICK_PRIVATE' ? 'Derick' : 'Generales'}.pdf\`);
      showToast('Documento PDF generado y descargado con éxito', 'success');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      showToast('Error al generar PDF. Tu navegador podría estar bloqueándolo.', 'error');
    } finally {
      setIsPrinting(false);
    }
  };`;

content = content.replace(
  /const handlePrintCertificate = \(\) => \{\s*window\.print\(\);\s*\};/,
  newPrintFn
);

// Add ref and fix styles to the content wrapper so it can be captured properly
// We need to capture the whole section, not just the scrollable part. Or at least the scrollable part but without overflow.
// Let's add ref to the parent of the scrollable part, or the scrollable part itself.
// But wait, html2canvas respects scrollHeight if we pass it the element. But to be safe, let's wrap the document content in a div with the ref.
// Currently:
// <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-h-[75vh] overflow-y-auto overflow-x-auto overscroll-contain touch-pan-y">
//   <div className="w-full max-w-4xl mx-auto space-y-8 text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm leading-relaxed text-left sm:text-justify break-words">

content = content.replace(
  '<div className="w-full max-w-4xl mx-auto space-y-8 text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm leading-relaxed text-left sm:text-justify break-words">',
  '<div ref={printRef} className="w-full max-w-4xl mx-auto space-y-8 text-neutral-700 dark:text-neutral-300 text-xs sm:text-sm leading-relaxed text-left sm:text-justify break-words bg-white dark:bg-neutral-900 p-8 rounded-2xl">'
);

// Update button to show loading state
content = content.replace(
  '<Printer className="w-4 h-4 text-neutral-500" />\n              Imprimir Constancia',
  `{isPrinting ? (
                <div className="w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Printer className="w-4 h-4 text-neutral-500" />
              )}
              {isPrinting ? 'Generando...' : 'Imprimir Constancia'}`
);
content = content.replace(
  'onClick={handlePrintCertificate}\n              className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"',
  `onClick={handlePrintCertificate}
              disabled={isPrinting}
              className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"`
);

writeFileSync('src/components/TermsAndConditionsInfo.tsx', content);
