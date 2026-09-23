import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { toPng } from 'html-to-image';

export interface PrintOptions {
  title?: string;
  pageFormat?: 'A4' | 'TICKET';
  orientation?: 'portrait' | 'landscape';
}

/**
 * Renderiza un elemento HTML a un HTMLCanvasElement de alta resolución (2x DPI)
 * garantizando fondo blanco, texto nítido y eliminación de estilos de modo oscuro.
 */
async function renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.scrollWidth || document.documentElement.offsetWidth,
      onclone: (clonedDoc, clonedElement) => {
        // 1. Remover clase dark de la raíz para renderizado limpio de impresión
        clonedDoc.documentElement.classList.remove('dark');
        clonedDoc.body.classList.remove('dark');

        // 2. Aplicar estilos explícitos de fondo blanco y texto negro
        clonedElement.classList.remove('dark');
        clonedElement.style.backgroundColor = '#ffffff';
        clonedElement.style.color = '#000000';
        clonedElement.style.transform = 'none';

        // 3. Ocultar botones y elementos marcados para no imprimir
        const hiddenEls = clonedElement.querySelectorAll('.print\\:hidden, .no-print, [data-html2canvas-ignore]');
        hiddenEls.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
      }
    });
    return canvas;
  } catch (html2canvasErr) {
    console.warn('html2canvas fallo, ejecutando motor alternativo toPng:', html2canvasErr);
    // Motor alternativo utilizando html-to-image sin traslaciones negativas
    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      cacheBust: true,
      filter: (node) => {
        if (node instanceof HTMLElement && (node.classList.contains('print:hidden') || node.classList.contains('no-print'))) {
          return false;
        }
        return true;
      }
    });

    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = reject;
    });

    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = img.width;
    fallbackCanvas.height = img.height;
    const ctx = fallbackCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
      ctx.drawImage(img, 0, 0);
    }
    return fallbackCanvas;
  }
}

/**
 * Convierte un elemento HTML en un archivo PDF descargable de alta fidelidad.
 * - TICKET: Rollo continuo térmico personalizado de 80mm x altura exacta del contenido.
 * - A4: Hoja A4 con paginación limpia sin cortes ni hojas en blanco.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string,
  options: { pageFormat?: 'A4' | 'TICKET'; orientation?: 'portrait' | 'landscape' } = {}
): Promise<void> {
  const { pageFormat = 'A4', orientation = 'portrait' } = options;
  const isTicket = pageFormat === 'TICKET';

  const canvas = await renderElementToCanvas(element);

  if (isTicket) {
    // =========================================================
    // FORMATO TICKET TÉRMICO CONTINUO (80mm)
    // =========================================================
    const ticketWidthMm = 80;
    // Altura calculada proporcional exacta a la imagen
    const ticketHeightMm = (canvas.height * ticketWidthMm) / canvas.width;
    const finalHeightMm = Math.max(30, Math.ceil(ticketHeightMm * 10) / 10);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [ticketWidthMm, finalHeightMm]
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, ticketWidthMm, ticketHeightMm, undefined, 'FAST');
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  } else {
    // =========================================================
    // FORMATO HOJA A4 (210mm x 297mm)
    // =========================================================
    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginMm = 8; // Margen de 8mm
    const printableWidthMm = pageWidth - (marginMm * 2);
    const totalContentHeightMm = (canvas.height * printableWidthMm) / canvas.width;
    const printableHeightMm = pageHeight - (marginMm * 2);

    const imgData = canvas.toDataURL('image/png', 1.0);

    if (totalContentHeightMm <= printableHeightMm) {
      // Cabe completamente en 1 página A4
      pdf.addImage(imgData, 'PNG', marginMm, marginMm, printableWidthMm, totalContentHeightMm, undefined, 'FAST');
    } else {
      // Paginación limpia: division exacta por bloques de página sin solapamientos
      const pxPerMm = canvas.width / printableWidthMm;
      const sliceHeightPx = Math.floor(printableHeightMm * pxPerMm);

      let currentY = 0;
      let pageNumber = 0;

      while (currentY < canvas.height) {
        if (pageNumber > 0) {
          pdf.addPage();
        }

        const remainingPx = canvas.height - currentY;
        const currentSlicePx = Math.min(sliceHeightPx, remainingPx);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSlicePx;
        const sliceCtx = sliceCanvas.getContext('2d');

        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0, currentY, canvas.width, currentSlicePx,
            0, 0, sliceCanvas.width, currentSlicePx
          );
        }

        const sliceImgData = sliceCanvas.toDataURL('image/png', 1.0);
        const currentSliceHeightMm = (currentSlicePx * printableWidthMm) / canvas.width;

        pdf.addImage(sliceImgData, 'PNG', marginMm, marginMm, printableWidthMm, currentSliceHeightMm, undefined, 'FAST');

        currentY += currentSlicePx;
        pageNumber++;
      }
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  }
}

/**
 * Imprime un elemento HTML en un entorno limpio sin fondos oscuros ni modales.
 * - En móviles (donde los iframes son bloqueados por iOS/Android): Genera y abre el PDF de alta fidelidad.
 * - En escritorio: Utiliza un iframe con dimensiones reales y estilos sincronizados para abrir la ventana nativa de impresión.
 */
export function printElement(element: HTMLElement, options: PrintOptions = {}): Promise<void> {
  const { title = 'Documento', pageFormat = 'A4' } = options;
  const isTicket = pageFormat === 'TICKET';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // En dispositivos móviles, los iframes con window.print son bloqueados por seguridad en iOS/Android.
  // La ruta más confiable y nítida es exportar el PDF con rollo continuo o A4, abriendo el visor nativo.
  if (isMobile) {
    return downloadElementAsPdf(element, title, { pageFormat: options.pageFormat, orientation: options.orientation });
  }

  return new Promise((resolve) => {
    // Crear iframe con dimensiones válidas en el árbol de renderizado
    const iframe = document.createElement('iframe');
    iframe.id = 'isolated-print-frame-' + Date.now();
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = isTicket ? '80mm' : '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.backgroundColor = '#ffffff';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.warn('No se pudo acceder al iframe de impresión, fallback a descarga PDF');
      downloadElementAsPdf(element, title, { pageFormat: options.pageFormat, orientation: options.orientation }).then(resolve);
      if (iframe.parentNode) document.body.removeChild(iframe);
      return;
    }

    // Copiar estilos de la cabecera del documento principal (Tailwind, Google Fonts, variables CSS)
    let stylesHtml = '';
    try {
      const styleNodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
      styleNodes.forEach((node) => {
        stylesHtml += node.outerHTML;
      });
    } catch (e) {
      console.warn('Error al copiar estilos al iframe:', e);
    }

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
              margin: ${isTicket ? '0mm' : '10mm'};
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              color-scheme: light !important;
            }
            html, body {
              background-color: #ffffff !important;
              background: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              font-family: inherit;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #print-container {
              width: ${isTicket ? '80mm' : '100%'} !important;
              max-width: ${isTicket ? '80mm' : '100%'} !important;
              margin: 0 auto !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              padding: ${isTicket ? '1mm' : '0'} !important;
            }
            .no-print, .print\\:hidden, [data-html2canvas-ignore] {
              display: none !important;
            }
            .dark {
              background-color: #ffffff !important;
              color: #000000 !important;
            }
            .dark * {
              background-color: transparent !important;
              color: #000000 !important;
              border-color: #d4d4d8 !important;
            }
          </style>
        </head>
        <body class="bg-white text-black">
          <div id="print-container">
            ${element.outerHTML}
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    const cleanup = () => {
      try {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      } catch (e) {}
      resolve();
    };

    // Dar tiempo prudencial para que el iframe parsee fuentes y estilos antes de imprimir
    setTimeout(() => {
      try {
        const iframeWin = iframe.contentWindow;
        if (!iframeWin) {
          cleanup();
          return;
        }

        iframeWin.focus();
        iframeWin.onafterprint = cleanup;
        window.onafterprint = cleanup;

        iframeWin.print();

        // Limpieza de respaldo por si el usuario cancela o el evento onafterprint no dispara
        setTimeout(cleanup, 2500);
      } catch (err) {
        console.error('Error al invocar impresión en iframe:', err);
        cleanup();
      }
    }, 400);
  });
}
