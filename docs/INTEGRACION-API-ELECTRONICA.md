# Integración Conta FT Online ↔ api-electronica

Notas para alinear el microservicio de FE (`api-electronica`) con lo que enviará
Conta FT Online. Basado en la lectura de `InvoiceControllerV2.php` y
`resources/views/xml/_accounting.blade.php` (2026-07).

> Nota: `api-electronica` **ya funciona/está certificado** con el desktop. Nada de
> lo de abajo es un "bug que rompe" — son ajustes de exactitud/robustez. Decide tú.

---

## 1. Contrato del `customer` (lo que Conta FT enviará)

El template `_accounting.blade.php` **consume estos campos del `customer`** (no solo los
5 que valida `InvoiceRequest`). La factura los renderiza SIEMPRE (la dirección del
adquirente va en `PartyTaxScheme/RegistrationAddress`, fuera del `@isset($supplier)`),
así que un `customer` mínimo genera XML con nodos nulos. Conta FT enviará el objeto
completo:

```jsonc
"customer": {
  "identification_number": "900123456",
  "dv": "7",
  "name": "ACME S.A.S",
  "phone": "3001234567",
  "address": "Cra 1 # 2-3",
  "email": "facturacion@acme.com",
  "merchant_registration": "0000000-00",        // o "No aplica"
  "type_document_identification": { "code": "31" },   // 31=NIT, 13=CC…
  "type_organization":            { "code": 1 },      // 1=jurídica, 2=natural
  "type_liability":               { "code": "O-13" }, // responsabilidad RUT (lo usa attached_document)
  "tax":                          { "code": "01", "name": "IVA" },
  "language":                     { "code": "es" },
  "country":                      { "code": "CO", "name": "Colombia" },
  "municipality": {
    "code": "23001",                              // DANE 5 díg
    "name": "Montería",
    "department": { "name": "Córdoba", "code": "23" }  // DANE 2 díg
  }
}
```

**Sugerencia (robustez):** en vez de confiar en el objeto anidado del cliente, sería
más seguro que `api-electronica` acepte **ids** (`municipality_id`,
`type_document_identification_id`, `type_organization_id`, `type_liability_id`,
`tax_id`) y cargue las relaciones desde sus propios catálogos. Así el emisor no puede
mandar un municipio/depto inconsistente. Hoy `InvoiceControllerV2` hace
`deepToObject($request->customer)` (línea ~296), o sea confía en lo que llega.

Conta FT ya tiene los catálogos DANE (33 deptos + 1122 municipios) y de unidades con
**los mismos ids** que `api-electronica`, así que ambos lados coinciden.

---

## 2. Ajustes sugeridos en api-electronica

### 2.1 `TaxLevelCode` está hardcodeado — `_accounting.blade.php:47`
```blade
<cbc:TaxLevelCode listName="29">R-99-PN</cbc:TaxLevelCode>
```
- Sale **fijo `R-99-PN`** para emisor Y adquirente en la factura. Si quieres reflejar
  las responsabilidades reales (O-13 Gran contribuyente, O-15 Autorretenedor,
  O-47 Régimen simple, etc.), hazlo dinámico: `$entity->type_liability->code`
  (con fallback `R-99-PN`).
- Verifica el `listName`: aquí usa `"29"` pero `attached_document.blade.php` usa
  `"48"` para lo mismo. Unificar al que exija tu versión del anexo (2.1 suele ser 48).

### 2.2 `sender_tax_level` usa el régimen, no la responsabilidad — `InvoiceControllerV2.php:522`
```php
'sender_tax_level' => $company->type_regime->code ?? 'O-13',
```
`type_regime->code` es 48/49 (Responsable/No responsable de IVA), no una responsabilidad
RUT (O-xx). Si DIAN espera la responsabilidad aquí, usar `$company->type_liability->code`.
(El `receiver_tax_level` de la línea 525 sí usa `customer['type_liability']['code']`.)

### 2.3 Validación laxa vs. lo que usa el template — `InvoiceRequest.php:31-38`
`customer.*` solo exige identification/name/phone/address/email, pero el XML usa
municipio, depto, país, tax, type_organization, type_document_identification. Recomendado:
validar la forma completa (o los ids del punto 1) para fallar temprano con mensaje claro
en vez de generar XML inválido.

---

## 3. Lo que NO se necesita (confirmado en el código de la API)

- **Código postal / `PostalZone`**: no existe en ningún template XML ni en la validación
  (ni factura ni documento soporte). El anexo lo define opcional → no lo pidas.
- **Matrícula mercantil**: solo va en `PartyLegalEntity` como `merchant_registration`
  (opcional); no es campo obligatorio del adquirente.
- **Tipo adquirente (Estándar/AIU/Mandatos)**: no se envía; AIU/Mandatos son modalidades
  por-factura y hoy la API no las implementa.

---

## 3.1 Documento Soporte — validar tipo de documento del vendedor (tabla 16.2.1)

Desde el **10-nov-2024** la DIAN **rechaza** el DS si el tipo de documento del vendedor
(no obligado a facturar) no está en un valor válido de la **tabla 16.2.1** del anexo
técnico del DS (regla **DSAJ25b**; ver también DSAJ25a que valida el código `31`).

- **Tarea api-electronica**: extraer la tabla 16.2.1 del anexo técnico del Documento
  Soporte (`Anexo-Tecnico-Documento-Soporte-No-Obligados.pdf`, Resolución 000167/2021)
  y **validar** `customer.type_document_identification.code` contra esa lista en
  `DocumentoSoporteController` (hoy NO valida el tipo de documento del proveedor →
  `app/Http/Controllers/DocumentoSoporteController.php`). Devolver un error claro antes
  de transmitir, en vez de esperar el rechazo DIAN.
- **Lado Conta FT (ya hecho)**: al marcar un proveedor como Documento Soporte se
  sugiere Cédula de ciudadanía (13) + persona natural y se muestra un aviso. No se
  bloquea NIT por casos borde (entidades no obligadas, proveedor del exterior código 50).
- Pendiente conjunto: confirmar la lista exacta de la tabla 16.2.1 (no se pudo extraer
  el PDF por ahora) y alinear el catálogo `dian_tipos_documento` de Conta FT con ella.

## 4. Pendiente de revisar (cuando lleguemos a FE — Subfase 4)
- Documento Soporte (`documento_soporte_ubl21.blade.php`) y notas crédito/débito: mismo
  ejercicio de contrato.
- Confirmar `tax` codes (01=IVA, etc.) y `type_organization`/`type_document` que enviará
  Conta FT contra los catálogos de la API.
