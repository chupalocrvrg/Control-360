import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';

export interface PrintOptions {
  title?: string;
  pageFormat?: 'A4' | 'TICKET';
  orientation?: 'portrait' | 'landscape';
}

/**
 * Imprime un elemento HTML en un iframe aislado e independiente.
 * Esto garantiza que jamás salga la página en blanco y elimina cualquier
 * conflicto con estilos globales, modales oscuros, backdrops fijos o #root.
 */
export function printElement(element: HTMLElement, options: PrintOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    const { title = 'Documento', pageFormat = 'A4' } = options;

    // Crear iframe invisible
    const iframe = document.createElement('iframe');
    iframe.id = 'isolated-print-frame-' + Date.now();
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.warn('No se pudo acceder al iframe de impresión, fallback a window.print()');
      window.print();
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    // Copiar estilos de la aplicación principal
    let stylesHtml = '';
    try {
      const styleSheets = document.styleSheets;
      for (let i = 0; i < styleSheets.length; i++) {
        try {
          const rules = styleSheets[i].cssRules;
          stylesHtml += '<style>';
          for (let j = 0; j < rules.length; j++) {
            stylesHtml += rules[j].cssText;
          }
          stylesHtml += '</style>';
        } catch (e) {
          // Fallback if we can't access rules (CORS)
          const tag = styleSheets[i].ownerNode;
          if (tag instanceof HTMLElement) {
            stylesHtml += tag.outerHTML;
          }
        }
      }
    } catch (e) {
      console.warn('Error copying styles:', e);
    }

    const isTicket = pageFormat === 'TICKET';

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title}</title>
          ${stylesHtml}
          <style>
            @page {
              size: ${isTicket ? '80mm auto' : 'A4 portrait'};
              margin: ${isTicket ? '2mm 2mm 2mm 2mm' : '15mm 15mm 15mm 15mm'};
            }
            html, body {
              background-color: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              width: 100% !important;
            }
            #print-container {
               width: 100% !important;
               background: white !important;
               color: black !important;
            }
            * {
              box-sizing: border-box !important;
              visibility: visible !important;
              color-scheme: light !important;
            }
            .no-print, .print\\:hidden, [data-html2canvas-ignore] {
              display: none !important;
            }
            /* Reset dark mode overrides specifically for print */
            @media print {
              body, html, #print-container {
                background: white !important;
                color: black !important;
              }
              .dark {
                background: white !important;
                color: black !important;
              }
              .dark * {
                background: transparent !important;
                color: black !important;
                border-color: #ccc !important;
              }
            }
          </style>
        </head>
        <body>
          <div id="print-container">
            ${element.outerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    iframeDoc.close();

    const doPrint = () => {
      // Logic handled inside iframe script now for better timing
    };

    iframe.onload = () => {
      setTimeout(() => {
        if (iframe.parentNode) {
          // We wait a bit before resolving to allow user to interact with print dialog
          setTimeout(() => resolve(), 2000);
        }
      }, 500);
    };
  });
}

/**
 * Convierte un elemento HTML en un archivo PDF descargable de alta fidelidad.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: { pageFormat?: 'A4' | 'TICKET'; orientation?: 'portrait' | 'landscape' } = {}
): Promise<void> {
  const { pageFormat = 'A4', orientation = 'portrait' } = options;
  const isTicket = pageFormat === 'TICKET';

  // Clonar temporalmente para asegurar estilos claros
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.transform = 'translateX(-150%)'; // Off-screen but technically "visible" for rendering engines
  clone.style.width = isTicket ? '380px' : '820px';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';
  clone.classList.remove('dark');
  document.body.appendChild(clone);

  try {
    const imgData = await toPng(clone, {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      quality: 0.98,
      filter: (node) => {
        if (node instanceof HTMLElement && node.classList.contains('print:hidden')) {
          return false;
        }
        return true;
      }
    });

    const img = new Image();
    img.src = imgData;
    await new Promise((resolve) => (img.onload = resolve));

    if (isTicket) {
      // Formato rollo térmico personalizado (80mm x altura proporcional)
      const ticketWidthMm = 80;
      const ticketHeightMm = Math.max(100, (img.height * ticketWidthMm) / img.width);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [ticketWidthMm, ticketHeightMm]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, ticketWidthMm, ticketHeightMm);
      pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    } else {
      // Formato A4
      const pdf = new jsPDF({
        orientation: orientation === 'landscape' ? 'l' : 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 16; // 8mm márgenes
      const imgHeight = (img.height * imgWidth) / img.width;

      let heightLeft = imgHeight;
      let position = 8; // Margen superior 8mm

      pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    }
  } finally {
    if (clone.parentNode) {
      document.body.removeChild(clone);
    }
  }
}
