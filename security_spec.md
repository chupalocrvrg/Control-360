# Especificación de Seguridad e Integridad de Datos - HQ Payments

Este documento detalla la especificación de seguridad del sistema, el diseño de aislamiento multi-inquilino corporativo y la matriz de mitigación de vulnerabilidades para las reglas de acceso a la base de datos de Firestore (`firestore.rules`).

---

## 1. Modelo de Seguridad Multi-Inquilino Unificado

El sistema financiero de **HQ Payments** (que abarca Beneficiarios, Facturas, Cheques, Egresos, Ventas, Inventario, etc.) se rige por un modelo de aislamiento dinámico multi-inquilino. 

En lugar de delegar la propiedad de forma aislada a cada creador individual (`userId == request.auth.uid`), las reglas garantizan que todos los recursos financieros compartan el mismo contexto de seguridad corporativo de la empresa. Esto se realiza mediante la función unificada `isEnterpriseData(data)` en `firestore.rules`.

```javascript
function isEnterpriseData(data) {
  return isAccountActive() && (
    isAdmin() || 
    (
      'enterpriseId' in data && (
        data.enterpriseId == request.auth.uid || 
        (
          exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.enterpriseId == data.enterpriseId
        )
      )
    )
  );
}
```

### Funciones de Control de Acceso Críticas:
- **`isSignedIn()`**: Valida que la petición contenga credenciales activas del SDK de autenticación de Firebase.
- **`isVerified()`**: Asegura que el usuario no solo esté autenticado, sino que también tenga un correo verificado (`email_verified == true`).
- **`isAdmin()`**: Identifica si el usuario posee rol de `SUPERADMIN` o `ADMIN` a través de sus tokens personalizados (Custom Claims) de Firebase Auth o inspeccionando su perfil en la colección `users`.
- **`isAccountActive()`**: Comprueba dinámicamente que el estado de la cuenta en su documento de perfil sea estrictamente `ENABLED` (un usuario suspendido/deshabilitado no puede realizar escrituras).

---

## 2. Mitigación de Vulnerabilidades: Los "Doce Sucios" (Dirty Dozen)

A continuación, se mapea cada una de las 12 vulnerabilidades críticas identificadas por el auditor directamente con la regla lógica de `firestore.rules` que la previene de forma segura y matemática:

### 1. Identity Spoofing (Suplantación de Identidad)
- **Vulnerabilidad**: Intentar registrar o crear un cheque, factura o beneficiario utilizando el `userId` o `enterpriseId` de otra empresa.
- **Solución en Reglas**: La creación de recursos financieros está sujeta a funciones de validación como `isValidCheck(incoming())`, `isValidInvoice(incoming())` y `isValidBeneficiary(incoming())`, las cuales exigen que el campo `userId` coincida exactamente con el emisor (`request.auth.uid`), u obliga a que el `enterpriseId` del payload coincida con el Tenant de la empresa autenticada.

### 2. State Shortcutting (Salto de Estado en Transacciones)
- **Vulnerabilidad**: Crear un cheque directamente en estado `PAID` sin pasar por la aprobación/firma manual, o crear un cheque en estado `DELETED` para ocultar egresos.
- **Solución en Reglas**: La regla de creación de cheques (`match /checks/{id}`) restringe que un nuevo cheque deba poseer campos de auditoría temporal válidos y que el estado sea estrictamente el inicial admitido por la lógica del negocio. Además, requiere que se use `isValidId(id)` para evitar inyecciones.

### 3. Shadow Update (Actualización de Privilegios Ocultos)
- **Vulnerabilidad**: Intentar actualizar un documento de usuario (`users/{userId}`) para inyectar campos administrativos o roles no autorizados.
- **Solución en Reglas**: 
  ```javascript
  allow update: if isOwnerOrAdmin(userId) && (
    isAdmin() || (
      incoming().diff(existing()).affectedKeys().hasOnly(['name', 'ruc', 'phone', 'pin', 'lastPinEntry', 'pinInactivityLimit']) &&
      isValidUser(incoming()) &&
      incoming().role == existing().role &&
      incoming().status == existing().status
    )
  );
  ```
  Esto bloquea cualquier intento de cambiar campos de sistema como `role`, `status` o privilegios de administrador a menos que el usuario sea explícitamente un administrador certificado (`isAdmin()`).

### 4. Orphaned Record (Registro Huérfano)
- **Vulnerabilidad**: Crear un cheque (`checks`) que apunte a un `invoiceId` inexistente, rompiendo la integridad referencial.
- **Solución en Reglas**: 
  ```javascript
  allow create: if isAccountActive() && isValidCheck(incoming()) && isValidId(id) && 
                exists(/databases/$(database)/documents/invoices/$(incoming().invoiceId));
  ```
  La regla utiliza `exists()` para forzar que el recurso padre (la factura) deba estar presente y registrado en Firestore antes de permitir la emisión de cualquier cheque.

### 5. PII Leak (Fuga de Información Personal)
- **Vulnerabilidad**: Un usuario con rol estándar intenta leer el perfil de otro usuario para robar PINs, teléfonos o correos.
- **Solución en Reglas**: 
  ```javascript
  match /users/{userId} {
    allow get: if isOwnerOrAdmin(userId);
    allow list: if isAdmin();
  }
  ```
  La lectura directa (`get`) de perfiles está restringida estrictamente al propietario de la cuenta (`request.auth.uid == userId`) o al administrador. Los listados masivos (`list`) están bloqueados para cualquier usuario no administrador.

### 6. Query Scraping (Extracción Masiva de Datos)
- **Vulnerabilidad**: Intentar leer todos los egresos, cheques o facturas del sistema sin filtrar por cuenta de empresa, exponiendo datos de otros inquilinos.
- **Solución en Reglas**: Las reglas de lectura para `checks`, `invoices` y `beneficiaries` exigen que los documentos listados cumplan dinámicamente con la regla corporativa `isEnterpriseData(resource.data)`. Esto obliga al SDK del cliente a aplicar un filtro de consulta estrictamente limitado al `enterpriseId` de su empresa, de lo contrario Firebase rechaza la petición con "PERMISSION_DENIED".

### 7. Resource Poisoning (Envenenamiento de Recursos)
- **Vulnerabilidad**: Registrar beneficiarios o perfiles con nombres excesivamente grandes (ej. 1MB de caracteres basura) para saturar la UI o inflar costos de almacenamiento.
- **Solución en Reglas**: Cada Blueprint de validación restringe el tamaño de los strings de entrada. Por ejemplo: `data.name.size() > 0 && data.name.size() <= 200` para usuarios y beneficiarios.

### 8. Immortality Breach (Modificación de Historial)
- **Vulnerabilidad**: Modificar la fecha de creación de un registro (`createdAt`) para falsear estados de cuenta contables o evadir límites de fechas.
- **Solución en Reglas**: Las reglas de actualización exigen la inmutabilidad de los metadatos temporales comparando el payload entrante con el existente (`incoming().createdAt == existing().createdAt`).

### 9. Role Escalation (Escalada de Roles)
- **Vulnerabilidad**: Un empleado (Bodeguero) intenta auto-asignarse rol de `SUPERADMIN` o `enterprise` directamente en la base de datos para saltarse controles de seguridad.
- **Solución en Reglas**: La actualización del perfil restringe de manera estricta que `incoming().role == existing().role` a menos de que la petición provenga de una cuenta certificada como administrador global (`isAdmin()`).

### 10. ID Injection (Inyección de Identificadores Maliciosos)
- **Vulnerabilidad**: Intentar inyectar scripts, código HTML, caracteres especiales o rutas de escape (como `../`) en los identificadores de documentos autogenerados o ingresados.
- **Solución en Reglas**: La función helper `isValidId(id)` valida que el ID del documento cumpla con un patrón regex seguro y un tamaño máximo estricto: `id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`.

### 11. Terminal Reversal (Reversión Contable)
- **Vulnerabilidad**: Intentar cambiar el estado de un cheque ya pagado (`PAID`) de vuelta a pendiente (`PENDING`) para alterar flujos de efectivo.
- **Solución en Reglas**: El bloque `allow update` de la colección `/checks/{id}` define de forma exhaustiva una máquina de estados segura. Una transición de `PAID` a `PENDING` está estrictamente prohibida para usuarios normales y solo se le permite a cuentas de administrador.

### 12. Status Bypass (Modificación de Totales Financieros)
- **Vulnerabilidad**: Intentar alterar los valores de facturas y egresos (`totalValue`, `finalTotal`) después de que ya han sido emitidos y registrados.
- **Solución en Reglas**: Las actualizaciones de facturas e inventarios están sujetas a la validación estricta de inquilino `isEnterpriseData(resource.data)`, impidiendo que agentes externos realicen modificaciones sobre transacciones de otras organizaciones.

---

## 3. Matriz de Mitigación: Vulnerabilidades Resueltas

### A. Vulnerabilidades Críticas (1 - 7)

| # | Vulnerabilidad | Vector de Ataque Original | Mitigación Implementada |
|---|---|---|---|
| 1 | **Escalación de privilegios en Firestore** | `users/{userId}` permitía `allow update: if isOwnerOrAdmin(userId)` sin filtrar campos modificados. | Regla endurecida con `isValidUser(incoming())`, lista estricta en `affectedKeys().hasOnly([...])`, `incoming().role == existing().role`, e inmutabilidad de `status`, `enterpriseId` y `subscriptionEnd`. |
| 2 | **Falla en `isVerified()`** | La función solo comprobaba `isSignedIn()`, permitiendo cuentas no verificadas. | Modificada para exigir obligatoriamente `request.auth.token.email_verified == true`. |
| 3 | **Fuga de datos en `/api/diagnostics/db`** | Endpoint GET público sin autenticación exponía empleados, presupuestos y ventas. | Protegido con `verifyAdminAuth(req)` exigiendo Bearer ID Token de administrador autenticado en Firebase Admin SDK. |
| 4 | **Sincronización insegura en `/api/admin/sync-claims`** | Aceptaba cualquier `uid` sin autenticar a quien llamaba. | Protegido con `verifyAdminAuth(req)`, solo administradores autenticados pueden sincronizar roles y claims. |
| 5 | **Suplantación de identidad en `/api/users/profile`** | Confiaba ciegamente en `uid` y `email` enviados en el body JSON. | Valida token mediante `admin.auth().verifyIdToken()`, extrayendo la identidad real e impidiendo falsificaciones de UID/email. |
| 6 | **Backdoor en cron `/api/cron/daily-report`** | Parámetros `?bypass=true` o header `x-bypass-cron` permitían saltarse la verificación de secreto. | Se eliminaron completamente todos los mecanismos de bypass; ahora exige estrictamente `CRON_SECRET` o token de administrador. |
| 7 | **Falta de scoping en colecciones de inventario** | `articles`, `warehouses` y `warehouse_inventory` tenían reglas abiertas `allow read: if true; allow write: if isVerified()`. | Se aplicó aislamiento corporativo `isEnterpriseData(data)` en lecturas y escrituras, impidiendo el acceso cruzado entre empresas. |

### B. Vulnerabilidades Moderadas y Privacidad (8 - 12)

| # | Vulnerabilidad | Causa Original | Mitigación Implementada |
|---|---|---|---|
| 8 | **Fallback vulnerable en `isEnterpriseData`** | La regla contenía `!exists(users/uid)` que retornaba `true`, permitiendo acceso total durante la creación de cuenta antes del perfil. | Se eliminó el comodín de fallback no condicional. Ahora solo se permite acceso a registros propios (`userId == uid`, `enterpriseId == uid`) o mediante vinculación formal activa a la empresa. |
| 9 | **Abuso en `/api/emails/test-direct`** | Endpoint público que permitía envío arbitrario de correos electrónicos vía Resend. | Protegido con `verifyAdminAuth(req)`, restringiendo el envío de pruebas exclusivamente a superadministradores y administradores autorizados. |
| 10 | **Configuración de Firebase Web API Key** | `firebase-applet-config.json` contiene la clave API del SDK cliente. | Documentadas las recomendaciones de Google Cloud Console: restricción por HTTP Referrers de los dominios autorizados de la aplicación y limitación estricta de scopes a Firebase Auth y Firestore API. |
| 11 | **Exposición de UID de cliente en script de depuración** | `query_user.js` y otros scripts residuales contenían UIDs reales en el código fuente. | Se eliminaron completamente todos los scripts de prueba obsoletos y de depuración (`query_user.js`, `fix_rules.js`, etc.) del repositorio. |
| 12 | **Política de Retención y Privacidad de IP (`lastIp`)** | Almacenamiento de dirección IP del cliente en cada login sin especificación explícita. | Actualizados los Términos y Condiciones (Capítulo V, Art. 13.1) en Onboarding para detallar la finalidad exclusiva de auditoría de seguridad, prevención de fraudes y trazabilidad contra intrusiones bajo rotación periódica. |

### C. Higiene del Repositorio y Sanitización de Logs (13 - 14)

| # | Observación | Causa Original | Mitigación Implementada |
|---|---|---|---|
| 13 | **Scripts residuales en la raíz del repositorio** | Múltiples scripts `patch_*.cjs` y `fix_*.cjs` dispersos en la raíz exponían el historial de modificaciones ad-hoc. | Se reubicaron y organizaron todos los scripts de mantenimiento en un directorio dedicado `scripts/maintenance/`, manteniendo la raíz del repositorio limpia y libre de artefactos. |
| 14 | **Registro de PII en logs de consola del servidor** | `console.log` en endpoints registraba correos electrónicos en texto plano y respuestas completas de servicios. | Se anonimizaron los logs del servidor (`server.ts`) sustituyendo los emails y UIDs completos por identificadores truncados y estados de entrega sin información personal identificable. |

---

## 4. Procedimiento de Verificación en el Simulador de Firebase

### Paso 1: Acceso al Simulador
1. Diríjase a su consola de [Firebase Console](https://console.firebase.google.com/).
2. Seleccione su proyecto e ingrese al panel de **Firestore Database**.
3. En la pestaña superior, vaya a **Reglas (Rules)**.
4. En el panel lateral derecho, verá el botón **Simulador de reglas (Rules Playground)**.

### Paso 2: Simulación de Ataques (Ejemplos de Prueba)

#### Prueba A: Denegación de Identity Spoofing
- **Tipo de operación**: `create`
- **Ruta del documento**: `invoices/test_invoice_01`
- **Autenticado**: `True`
- **UID**: `alice_id` (Usuario A)
- **Payload (JSON)**:
  ```json
  {
    "userId": "bob_id",
    "beneficiaryName": "Proveedor Falso",
    "concept": "Intento de Fraude",
    "totalValue": 500,
    "finalTotal": 500,
    "months": 1,
    "createdAt": "now"
  }
  ```
- **Resultado esperado**: **Rechazado (FAILED)**. El campo `userId` debe coincidir con `request.auth.uid` ("alice_id") según la regla `isValidInvoice`.

#### Prueba B: Acceso Multi-Inquilino Exitoso (Bodeguero o Propietario)
- **Tipo de operación**: `get`
- **Ruta del documento**: `checks/check_id_100`
- **Autenticado**: `True`
- **UID**: `bodeguero_id` (Cuyo perfil tiene `enterpriseId: "empresa_123"`)
- **Datos existentes del documento**:
  ```json
  {
    "enterpriseId": "empresa_123",
    "amount": 250,
    "status": "PENDING"
  }
  ```
- **Resultado esperado**: **Permitido (ALLOWED)**. Ya que el usuario pertenece al mismo inquilino corporativo, la función `isEnterpriseData` valida la lectura satisfactoriamente.
