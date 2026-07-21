/* ================================================================
 * Impresión de Remisión / venta — port de la tirilla 80mm del desktop
 * (ImpresionFactura.tsx). Versión web: abre una ventana con vista previa
 * y botón Imprimir (sin Electron). La FE (CUFE/QR/resolución) es de la
 * Subfase 4; aquí se imprime la Remisión / Cotización.
 * ============================================================== */

const fmtMonDec = (v: number) =>
  '$ ' + (v || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface DatosVenta {
  numero: number | string;
  titulo: string;                 // "REMISIÓN DE VENTA" | "COTIZACIÓN"
  fecha: string;
  tipo: string;                   // "Contado" | "Crédito"
  dias: number;
  esCotizacion?: boolean;
  cliente: { nombre: string; nit: string; telefono: string; direccion: string };
  empresa: { nombre: string; nit: string; telefono: string; direccion: string };
  items: { codigo: string; nombre: string; cantidad: number; precio: number; iva: number; descuento: number; subtotal: number }[];
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  efectivo: number;
  transferencia: number;
  cambio: number;
  abono: number;
  saldo: number;
  medioPago: string;
  vendedor: string;
}

// ============================================================
// TIRILLA POS 80mm
// ============================================================
function tirilla(d: DatosVenta): string {
  const linea = '<div style="border-bottom:1px dashed #000;margin:4px 0;"></div>';
  let html = `<div style="width:62mm;font-family:Arial,Helvetica,sans-serif;font-size:11px;padding:3mm 4mm;line-height:1.4;word-wrap:break-word;overflow-wrap:break-word;">`;

  // Empresa
  html += `<div style="text-align:center;margin-bottom:6px;">`;
  html += `<div style="font-size:12px;font-weight:bold;word-wrap:break-word;">${d.empresa.nombre}</div>`;
  html += `<div>Nit. ${d.empresa.nit}</div>`;
  if (d.empresa.direccion) html += `<div>${d.empresa.direccion}</div>`;
  if (d.empresa.telefono) html += `<div>Tel. ${d.empresa.telefono}</div>`;
  html += `</div>`;

  // Datos del documento
  html += `<div style="margin-bottom:4px;">`;
  html += `<div>${d.titulo} No. <b>${d.numero}</b></div>`;
  html += `<div>CLIENTE: ${d.cliente.nombre}</div>`;
  html += `<div>NIT: ${d.cliente.nit}</div>`;
  if (d.cliente.direccion && d.cliente.direccion !== '-') html += `<div>DIRECCIÓN: ${d.cliente.direccion}</div>`;
  html += `<div>FECHA: ${d.fecha}</div>`;
  html += `</div>`;

  // Header productos
  html += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:10px;margin-bottom:1px;">`;
  html += `<span>Cod</span><span>Descripción</span><span>Cant</span><span>Valor</span><span>Total</span></div>`;
  html += linea;

  // Items
  for (const item of d.items) {
    const ivaLetra = item.iva > 0 ? 'A' : 'E';
    html += `<div style="margin-bottom:5px;">`;
    html += `<div style="word-wrap:break-word;"><b>${item.codigo}</b> ${item.nombre}</div>`;
    html += `<div style="display:flex;justify-content:space-between;">`;
    html += `<span>&nbsp;&nbsp;${item.cantidad} x ${fmtMonDec(item.precio)}</span>`;
    html += `<span>${fmtMonDec(item.subtotal)} ${ivaLetra}</span>`;
    html += `</div></div>`;
  }

  // Totales
  html += linea;
  html += `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>SUBTOTAL</span><span>${fmtMonDec(d.subtotal)}</span></div>`;
  html += linea;
  if (d.descuento > 0) html += `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>DESCUENTO</span><span>${fmtMonDec(d.descuento)}</span></div>`;
  html += `<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin:3px 0;"><span>TOTAL A PAGAR</span><span>${fmtMonDec(d.total)}</span></div>`;

  if (!d.esCotizacion) {
    if (d.efectivo > 0) html += `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>EFECTIVO</span><span>${fmtMonDec(d.efectivo)}</span></div>`;
    if (d.transferencia > 0) html += `<div style="display:flex;justify-content:space-between;font-size:10px;"><span>${(d.medioPago || 'TRANSFERENCIA').toUpperCase()}</span><span>${fmtMonDec(d.transferencia)}</span></div>`;
    if (d.tipo === 'Crédito') {
      if (d.abono > 0) html += `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>ABONO</span><span>${fmtMonDec(d.abono)}</span></div>`;
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:bold;"><span>SALDO</span><span>${fmtMonDec(d.saldo)}</span></div>`;
    } else {
      html += `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>CAMBIO</span><span>${fmtMonDec(d.cambio)}</span></div>`;
    }
  }

  // Detalle de impuestos — solo si hay ítems gravados (empresa responsable de IVA).
  const itemsGravados = d.items.filter((i) => i.iva > 0);
  if (itemsGravados.length > 0) {
    const totalGravado = itemsGravados.reduce((s, i) => s + i.subtotal, 0);
    const baseGravado = itemsGravados.reduce((s, i) => s + i.subtotal / (1 + i.iva / 100), 0);
    const ivaGravado = totalGravado - baseGravado;
    const itemsExentos = d.items.filter((i) => !i.iva);
    const totalExento = itemsExentos.reduce((s, i) => s + i.subtotal, 0);

    html += linea;
    html += `<div style="text-align:center;font-weight:bold;font-size:9px;">** DETALLE DE LOS IMPUESTOS **</div>`;
    html += `<div style="display:flex;justify-content:space-between;font-size:9px;font-weight:bold;"><span>Tipo</span><span>Venta</span><span>Base</span><span>Imp</span></div>`;
    html += linea;
    if (totalGravado > 0) html += `<div style="display:flex;justify-content:space-between;font-size:9px;"><span>Gravado</span><span>${fmtMonDec(totalGravado)}</span><span>${fmtMonDec(baseGravado)}</span><span>${fmtMonDec(ivaGravado)}</span></div>`;
    if (totalExento > 0) html += `<div style="display:flex;justify-content:space-between;font-size:9px;"><span>Exento</span><span>${fmtMonDec(totalExento)}</span><span></span><span></span></div>`;
  }

  html += linea;
  html += `<div>FORMA DE PAGO: ${d.tipo}${d.tipo === 'Crédito' ? `, ${d.dias} días` : ''}</div>`;
  if (d.vendedor) html += `<div>CAJERO: ${d.vendedor}</div>`;
  html += `<br>`;
  html += `<div style="text-align:center;">${linea}</div>`;
  html += `<div style="text-align:center;">Aceptación del Cliente</div>`;
  html += `<br><br>`;
  html += `<div style="text-align:center;font-weight:bold;letter-spacing:2px;">"GRACIAS POR SU COMPRA"</div>`;
  html += `</div>`;
  return html;
}

/**
 * Abre una ventana con la tirilla y una barra superior con "Imprimir".
 * (Vista previa web; no imprime en silencio.)
 */
export function imprimirVenta(d: DatosVenta) {
  const contenido = tirilla(d);
  const win = window.open('', '_blank', 'width=380,height=720');
  if (!win) return;

  const toolbar = `<div id="tb" style="position:fixed;top:0;left:0;right:0;background:#7c3aed;padding:6px 16px;display:flex;align-items:center;gap:10px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.2);">
    <button onclick="document.getElementById('tb').style.display='none';window.print();setTimeout(function(){document.getElementById('tb').style.display='flex';},500);" style="height:30px;padding:0 16px;background:#fff;color:#7c3aed;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">🖨️ Imprimir</button>
    <button onclick="window.close();" style="height:30px;padding:0 12px;background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">✕ Cerrar</button>
    <span style="color:rgba(255,255,255,0.75);font-size:12px;margin-left:auto;font-family:Arial;">${d.titulo} #${d.numero}</span>
  </div>`;

  win.document.write(`<!DOCTYPE html><html><head>
    <title>${d.titulo} #${d.numero}</title>
    <style>
      @media print {
        @page { size: 72mm auto; margin: 0; }
        body { margin: 0; padding: 0 !important; }
        #tb { display: none !important; }
      }
      body { margin: 0; padding-top: 44px; }
    </style>
  </head><body>${toolbar}${contenido}</body></html>`);
  win.document.close();
  win.focus();
}
