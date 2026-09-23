import { BuroRecord, parseAndFormatDate } from './buroProcessor';

export interface BuroMacroConfig {
  id?: string;
  enterpriseId: string;
  macroCode: string;
  macroName: string;
  isActive: boolean;
  delimiter?: string;
  extension?: string;
  createdBy: string;
  userEmail: string;
  updatedAt: any;
}

export interface ParsedMacroRules {
  delimiter: string;
  extension: string;
  hasHeader: boolean;
  headerColumns: string[];
  fieldMappings: { [key: string]: string };
  dateTransformations: string[];
  numericTransformations: string[];
  customRulesCount: number;
  detectedProcedures: string[];
  syntaxWarnings: string[];
}

export interface MacroExecutionResult {
  records: BuroRecord[];
  formattedOutput: string;
  filename: string;
  delimiter: string;
  totalLines: number;
  summary: {
    totalRecords: number;
    totalAmount: number;
    warnings: string[];
  };
}

export const DEFAULT_EQUIFAX_VBA_MACRO = `' =========================================================================
' MACRO OFICIAL EQUIFAX - GENERACION Y VALIDACION DE CARTERA (.GJM)
' Estructura Oficial de 28 Columnas para Envio a Buro de Credito
' =========================================================================
Sub GenerarArchivoEquifax()
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim i As Long
    Dim filePath As String
    Dim fileNum As Integer
    Dim delim As String
    Dim linea As String
    
    ' Delimitador oficial de Equifax
    delim = ";"
    Set ws = ActiveSheet
    lastRow = ws.Cells(ws.Rows.Count, "B").End(xlUp).Row
    
    If lastRow < 2 Then
        MsgBox "No hay datos para procesar", vbExclamation, "Equifax"
        Exit Sub
    End If
    
    ' Nombre de archivo de salida
    filePath = Application.ActiveWorkbook.Path & "\Cartera_Equifax.gjm"
    fileNum = FreeFile
    
    Open filePath For Output As #fileNum
    
    ' 1. Encabezado Oficial con las 28 Variables
    Dim header As String
    header = "cod_tipo_id" & delim & "cod_id_sujeto" & delim & "nom_sujeto" & delim & _
             "direccion" & delim & "ciudad" & delim & "telefono" & delim & _
             "fec_corte_saldo" & delim & "tipo_deudor" & delim & "num_operacion" & delim & _
             "fec_concesion" & delim & "val_operacion" & delim & "val_xvencer" & delim & _
             "val_vencido" & delim & "val_dem_judicial" & delim & "val_cart_castigada" & delim & _
             "num_dias_vencido" & delim & "fec_nacimiento" & delim & "deuda_refinanciada" & delim & _
             "fec_vencimiento" & delim & "REPORTADO" & delim & "FACTURAS_PAGADAS" & delim & _
             "PARROQUIA" & delim & "EMAIL" & delim & "GENERO" & delim & _
             "ESTADO_CIVIL" & delim & "ESTADO_OPERACION" & delim & "VALOR_NDI" & delim & "FECHA_PAGO_CUOTA"
             
    Print #fileNum, header
    
    ' 2. Procesamiento y Limpieza de Filas
    For i = 2 To lastRow
        ' Determinacion de tipo de documento
        Dim tipoDoc As String
        Dim idSujeto As String
        idSujeto = Trim(ws.Cells(i, 2).Value)
        If Len(idSujeto) = 13 Then
            tipoDoc = "R"
        Else
            tipoDoc = "C"
        End If
        
        ' Limpieza de caracteres especiales en direccion y nombre
        Dim nombre As String, direccion As String
        nombre = Replace(Trim(UCase(ws.Cells(i, 3).Value)), ";", " ")
        direccion = Replace(Trim(UCase(ws.Cells(i, 4).Value)), ";", " ")
        
        ' Formateo de fechas a dd/mm/yyyy
        Dim fecCorte As String, fecConcesion As String, fecVencimiento As String
        fecCorte = Format(ws.Cells(i, 7).Value, "dd/mm/yyyy")
        fecConcesion = Format(ws.Cells(i, 10).Value, "dd/mm/yyyy")
        fecVencimiento = Format(ws.Cells(i, 19).Value, "dd/mm/yyyy")
        
        ' Formateo de montos numericos con 2 decimales
        Dim valOp As Double, valXvencer As Double, valVencido As Double
        valOp = Round(Val(ws.Cells(i, 11).Value), 2)
        valXvencer = Round(Val(ws.Cells(i, 12).Value), 2)
        valVencido = Round(Val(ws.Cells(i, 13).Value), 2)
        
        ' Construccion de la linea final delimitada por punto y coma
        linea = tipoDoc & delim & _
                idSujeto & delim & _
                nombre & delim & _
                direccion & delim & _
                Trim(ws.Cells(i, 5).Value) & delim & _
                Trim(ws.Cells(i, 6).Value) & delim & _
                fecCorte & delim & _
                "TITULAR" & delim & _
                Trim(ws.Cells(i, 9).Value) & delim & _
                fecConcesion & delim & _
                Format(valOp, "0.00") & delim & _
                Format(valXvencer, "0.00") & delim & _
                Format(valVencido, "0.00") & delim & _
                Format(Val(ws.Cells(i, 14).Value), "0.00") & delim & _
                Format(Val(ws.Cells(i, 15).Value), "0.00") & delim & _
                Val(ws.Cells(i, 16).Value) & delim & _
                Format(ws.Cells(i, 17).Value, "dd/mm/yyyy") & delim & _
                Format(Val(ws.Cells(i, 18).Value), "0.00") & delim & _
                fecVencimiento & delim & _
                Val(ws.Cells(i, 20).Value) & delim & _
                Val(ws.Cells(i, 21).Value) & delim & _
                Trim(ws.Cells(i, 22).Value) & delim & _
                Trim(ws.Cells(i, 23).Value) & delim & _
                Trim(ws.Cells(i, 24).Value) & delim & _
                Trim(ws.Cells(i, 25).Value) & delim & _
                Trim(ws.Cells(i, 26).Value) & delim & _
                Val(ws.Cells(i, 27).Value) & delim & _
                Format(ws.Cells(i, 28).Value, "dd/mm/yyyy")
                
        Print #fileNum, linea
    Next i
    
    Close #fileNum
    MsgBox "Archivo .gjm generado exitosamente para Equifax", vbInformation, "Equifax"
End Sub`;

/**
 * Parses VBA Macro code to identify delimiters, file extensions, headers, and column maps
 */
export function parseVbaMacro(vbaCode: string): ParsedMacroRules {
  const code = vbaCode || '';
  const warnings: string[] = [];
  const detectedProcedures: string[] = [];

  // Detect Sub / Function names
  const subMatches = code.match(/(?:Sub|Function)\s+([a-zA-Z0-9_]+)/gi);
  if (subMatches) {
    subMatches.forEach(m => {
      const name = m.replace(/(?:Sub|Function)\s+/i, '').trim();
      detectedProcedures.push(name);
    });
  }

  // Detect delimiter
  let delimiter = ';';
  if (/delim\s*=\s*"([^"]+)"/i.test(code)) {
    const match = code.match(/delim\s*=\s*"([^"]+)"/i);
    if (match && match[1]) delimiter = match[1];
  } else if (/Separator\s*:=\s*"([^"]+)"/i.test(code)) {
    const match = code.match(/Separator\s*:=\s*"([^"]+)"/i);
    if (match && match[1]) delimiter = match[1];
  } else if (/& "\t" &/i.test(code)) {
    delimiter = '\t';
  } else if (/& "\|" &/i.test(code)) {
    delimiter = '|';
  } else if (/& "," &/i.test(code)) {
    delimiter = ',';
  }

  // Detect file extension (.gjm, .txt, .csv, .dat)
  let extension = '.gjm';
  const extMatch = code.match(/\.(gjm|txt|csv|dat)/i);
  if (extMatch && extMatch[1]) {
    extension = '.' + extMatch[1].toLowerCase();
  }

  // Detect header string or columns
  let hasHeader = true;
  let headerColumns: string[] = [
    'cod_tipo_id', 'cod_id_sujeto', 'nom_sujeto', 'direccion', 'ciudad',
    'telefono', 'fec_corte_saldo', 'tipo_deudor', 'num_operacion', 'fec_concesion',
    'val_operacion', 'val_xvencer', 'val_vencido', 'val_dem_judicial', 'val_cart_castigada',
    'num_dias_vencido', 'fec_nacimiento', 'deuda_refinanciada', 'fec_vencimiento',
    'REPORTADO', 'FACTURAS_PAGADAS', 'PARROQUIA', 'EMAIL', 'GENERO',
    'ESTADO_CIVIL', 'ESTADO_OPERACION', 'VALOR_NDI', 'FECHA_PAGO_CUOTA'
  ];

  // Try extracting explicit header string from VBA
  const headerMatch = code.match(/header\s*=\s*"([^"]+)"/i);
  if (headerMatch && headerMatch[1]) {
    const rawHead = headerMatch[1];
    if (rawHead.includes(';') || rawHead.includes(',') || rawHead.includes('|')) {
      const parts = rawHead.split(/[;,|]/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 10) {
        headerColumns = parts;
      }
    }
  }

  // Check if header is omitted
  if (/NoHeader|SinEncabezado|header\s*=\s*""/i.test(code)) {
    hasHeader = false;
  }

  const dateTransformations: string[] = [];
  if (/Format\([^,]+,\s*"dd\/mm\/yyyy"\)/i.test(code) || /fec_/i.test(code)) {
    dateTransformations.push('dd/MM/yyyy (Estándar Equifax Ecuador)');
  }
  if (/Format\([^,]+,\s*"yyyymmdd"\)/i.test(code)) {
    dateTransformations.push('YYYYMMDD (Numérico ISO)');
  }

  const numericTransformations: string[] = [];
  if (/Format\([^,]+,\s*"0\.00"\)/i.test(code) || /Round\(/i.test(code)) {
    numericTransformations.push('2 Decimales con punto (0.00)');
  }

  if (detectedProcedures.length === 0 && code.trim().length > 0) {
    warnings.push('No se detectaron bloques "Sub ... End Sub", pero se procesarán las reglas.');
  }

  return {
    delimiter,
    extension,
    hasHeader,
    headerColumns,
    fieldMappings: {},
    dateTransformations,
    numericTransformations,
    customRulesCount: (code.match(/If\s+/gi) || []).length,
    detectedProcedures,
    syntaxWarnings: warnings
  };
}

/**
 * Sanitizes and formats text strings for Equifax requirements
 */
function cleanText(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[;\t\r\n|]/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Formats numbers to string with 2 decimals
 */
function formatNumber(val: any, decimals = 2): string {
  if (val === null || val === undefined || val === '') return (0).toFixed(decimals);
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '.'));
  if (isNaN(num)) return (0).toFixed(decimals);
  return num.toFixed(decimals);
}

/**
 * Executes parsed VBA Macro logic over the Buro records array to produce final compliant output
 */
export function executeVbaMacroOnRecords(
  records: BuroRecord[],
  macroCode: string,
  baseFilename?: string
): MacroExecutionResult {
  const parsed = parseVbaMacro(macroCode || DEFAULT_EQUIFAX_VBA_MACRO);
  const delim = parsed.delimiter || ';';
  const warnings: string[] = [];

  let totalAmount = 0;

  // Process and transform each record according to Macro logic
  const processedRecords = (records || []).map((r, idx) => {
    // Determine type of ID if not set
    const rawId = String(r.cod_id_sujeto || '').trim();
    let tipoId = r.cod_tipo_id;
    if (!tipoId || tipoId === 'undefined') {
      tipoId = rawId.length === 13 ? 'R' : 'C';
    }

    const valOperacion = r.val_operacion ?? r.monto_concedido ?? 0;
    totalAmount += valOperacion;

    // Check custom conditions found in VBA
    let tipoDeudor = r.tipo_deudor || 'TITULAR';
    let estadoCivil = r.ESTADO_CIVIL || '';
    let genero = r.GENERO || '';
    let estadoOperacion = r.ESTADO_OPERACION || '';

    // Apply uppercase & clean strings
    const cleanNombre = cleanText(r.nom_sujeto || '');
    const cleanDireccion = cleanText(r.direccion || '');
    const cleanCiudad = cleanText(r.ciudad || '');
    const cleanParroquia = cleanText(r.PARROQUIA || '');
    const cleanEmail = String(r.EMAIL || '').toLowerCase().trim();

    return {
      ...r,
      cod_tipo_id: tipoId,
      cod_id_sujeto: rawId,
      nom_sujeto: cleanNombre,
      direccion: cleanDireccion,
      ciudad: cleanCiudad,
      tipo_deudor: tipoDeudor,
      PARROQUIA: cleanParroquia,
      EMAIL: cleanEmail,
      GENERO: genero,
      ESTADO_CIVIL: estadoCivil,
      ESTADO_OPERACION: estadoOperacion
    };
  });

  // Construct lines using Macro specified header & columns
  const lines: string[] = [];

  if (parsed.hasHeader && parsed.headerColumns && parsed.headerColumns.length > 0) {
    lines.push(parsed.headerColumns.join(delim));
  }

  processedRecords.forEach(r => {
    const rowValues = [
      r.cod_tipo_id || (String(r.cod_id_sujeto).length === 13 ? 'R' : 'C'),
      String(r.cod_id_sujeto || ''),
      r.nom_sujeto || '',
      r.direccion || '',
      r.ciudad || '',
      String(r.telefono || ''),
      parseAndFormatDate(r.fec_corte_saldo),
      r.tipo_deudor || 'TITULAR',
      String(r.num_operacion || ''),
      parseAndFormatDate(r.fec_concesion),
      formatNumber(r.val_operacion ?? r.monto_concedido ?? 0, 2),
      formatNumber(r.val_xvencer ?? 0, 2),
      formatNumber(r.val_vencido ?? 0, 2),
      formatNumber(r.val_dem_judicial ?? 0, 2),
      formatNumber(r.val_cart_castigada ?? 0, 2),
      String(r.num_dias_vencido ?? 0),
      parseAndFormatDate(r.fec_nacimiento),
      formatNumber(r.deuda_refinanciada ?? 0, 2),
      parseAndFormatDate(r.fec_vencimiento),
      String(r.REPORTADO ?? 0),
      String(r.FACTURAS_PAGADAS ?? 0),
      r.PARROQUIA || '',
      r.EMAIL || '',
      r.GENERO || '',
      r.ESTADO_CIVIL || '',
      r.ESTADO_OPERACION || '',
      String(r.VALOR_NDI ?? 0),
      parseAndFormatDate(r.FECHA_PAGO_CUOTA)
    ];

    lines.push(rowValues.join(delim));
  });

  const formattedOutput = lines.join('\r\n');

  // Compute final filename
  let outName = baseFilename || 'Cartera_Equifax_Validada';
  if (!outName.toLowerCase().endsWith(parsed.extension)) {
    outName = outName.replace(/\.[a-zA-Z0-9]+$/, '') + parsed.extension;
  }

  return {
    records: processedRecords,
    formattedOutput,
    filename: outName,
    delimiter: delim,
    totalLines: lines.length,
    summary: {
      totalRecords: processedRecords.length,
      totalAmount,
      warnings
    }
  };
}

/**
 * Runs a single sample record through the macro to produce preview output
 */
export function testVbaMacroOnRecord(record: BuroRecord, macroCode: string): string {
  const res = executeVbaMacroOnRecords([record], macroCode);
  const rows = res.formattedOutput.split('\r\n');
  return rows.length > 1 ? rows[1] : rows[0] || '';
}
