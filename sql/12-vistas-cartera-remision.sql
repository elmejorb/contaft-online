-- ============================================================
-- 12 · Vistas de cartera: incluir 'remision' (antes 'pos')
--
-- Al renombrar pos→remision (sql/11), las vistas de cartera quedaron
-- filtrando tipo_documento IN ('pos',...) y dejaban FUERA las remisiones
-- a crédito. Se redefinen con 'remision'.
--
-- Idempotente (DROP + CREATE).
-- ============================================================

SET NAMES utf8mb4;

DROP VIEW IF EXISTS vw_cartera_cliente;
DROP VIEW IF EXISTS vw_facturas_saldo;

CREATE VIEW vw_facturas_saldo AS
SELECT
    v.id                                              AS venta_id,
    v.empresa_id,
    v.numero,
    v.cliente_id,
    v.fecha,
    v.dias_credito,
    DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY)    AS fecha_vencimiento,
    v.total,
    COALESCE(p.total_pagado, 0)                        AS total_pagado,
    GREATEST(v.total - COALESCE(p.total_pagado, 0), 0) AS saldo,
    CASE
      WHEN CURDATE() > DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY)
        THEN DATEDIFF(CURDATE(), DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY))
      ELSE 0
    END                                              AS dias_vencido,
    CURDATE() > DATE_ADD(v.fecha, INTERVAL v.dias_credito DAY) AS vencida
FROM ventas v
LEFT JOIN (
    SELECT empresa_id, venta_id,
           SUM(valor + COALESCE(descuento, 0)) AS total_pagado
    FROM pagos
    WHERE estado = 'valida'
      AND valor >= 0
      AND COALESCE(descuento, 0) >= 0
    GROUP BY empresa_id, venta_id
) p ON p.venta_id = v.id AND p.empresa_id = v.empresa_id
WHERE v.tipo_termino = 'credito'
  AND v.estado = 'valida'
  AND v.tipo_documento IN ('remision','electronica','soporte');

CREATE VIEW vw_cartera_cliente AS
SELECT
    c.id                              AS cliente_id,
    c.empresa_id,
    c.razon_social,
    c.identificacion,
    c.cupo_credito,
    COUNT(vfs.venta_id)               AS facturas_pendientes,
    COALESCE(SUM(vfs.saldo), 0)       AS saldo_total,
    COALESCE(SUM(CASE WHEN vfs.vencida = 1 THEN vfs.saldo ELSE 0 END), 0) AS saldo_vencido,
    MAX(vfs.dias_vencido)             AS max_dias_vencido
FROM clientes c
LEFT JOIN vw_facturas_saldo vfs
       ON vfs.cliente_id = c.id
      AND vfs.empresa_id = c.empresa_id
      AND vfs.saldo > 0
WHERE c.activo = 1
GROUP BY c.id, c.empresa_id;

SELECT '✓ vistas de cartera actualizadas (remision)' AS resultado;
