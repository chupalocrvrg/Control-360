export function generateReportHtml(userName: string, checks: any[]): string {
  const tableRows = checks.map(check => `
    <tr>
      <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; font-weight: 500;">
        \${check.checkNumber || 'N/A'}
      </td>
      <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #334155;">
        \${check.beneficiaryName || 'N/A'}
      </td>
      <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right;">
        $\${Number(check.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td style="padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #ef4444; font-weight: 600; text-align: center;">
        \${check.dueDate || 'N/A'}
      </td>
    </tr>
  `).join('');

  const totalAmount = checks.reduce((sum, check) => sum + Number(check.amount || 0), 0);

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Control de Cheques por Pagar</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: none; text-size-adjust: none;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.03), 0 4px 6px -4px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; overflow: hidden;">
                <!-- Header Card -->
                <tr>
                  <td style="padding: 40px; background-color: #4f46e5; text-align: center;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; font-size: 11px; font-weight: 800; color: #c7d2fe; text-transform: uppercase; letter-spacing: 0.15em; display: inline-block; margin-bottom: 6px;">Reporte Automatizado</span>
                    <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; font-size: 26px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: -0.02em; font-style: italic;">
                      Terminal de Pagos
                    </h1>
                  </td>
                </tr>
                
                <!-- Body Area -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; color: #0f172a; font-weight: 600;">
                      Estimado/a \${userName},
                    </p>
                    <p style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; color: #64748b; line-height: 1.6;">
                      A continuación, adjuntamos el estado de cuenta y cartera detallada de sus cheques en estado <strong>PENDIENTE</strong> por cobrar. Por favor concilie sus saldos oportunamente.
                    </p>
                    
                    <!-- Table component -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px;">
                      <thead>
                        <tr style="background-color: #f8fafc;">
                          <th style="padding: 12px 8px; text-align: left; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">Nº Cheque</th>
                          <th style="padding: 12px 8px; text-align: left; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">Beneficiario</th>
                          <th style="padding: 12px 8px; text-align: right; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">Monto (USD)</th>
                          <th style="padding: 12px 8px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e2e8f0;">Vencimiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        \${tableRows}
                        <tr style="background-color: #f8fafc;">
                          <td colspan="2" style="padding: 18px 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: bold; color: #1e293b; border-top: 2px solid #e2e8f0;">
                            TOTAL CHEQUES DE CARTERA
                          </td>
                          <td style="padding: 18px 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 16px; font-weight: 800; color: #4f46e5; text-align: right; border-top: 2px solid #e2e8f0;">
                            $\${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style="border-top: 2px solid #e2e8f0;"></td>
                        </tr>
                      </tbody>
                    </table>
                    
                    <div style="padding: 16px; background-color: #f5f3ff; border-radius: 12px; border: 1px solid #ddd6fe; margin-bottom: 12px;">
                      <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; color: #6d28d9; line-height: 1.5; font-weight: bold; text-align: center;">
                        Este correo es emitido por el sistema como medida preventiva para salvaguardar el orden de sus flujos financieros.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer area -->
                <tr>
                  <td style="padding: 24px 40px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                      Este es una notificación automática del sistema de cobro de cheques. Por favor no responda directamente a este email.
                    </p>
                    <p style="margin: 4px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                      © 2026 Aplicación Registradora y Terminal de Cheques. Todos los derechos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
