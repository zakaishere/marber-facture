-- The source of truth is the saved document lines, never an editable stock counter.
CREATE VIEW product_stock AS
SELECT p.id AS product_id,
 COALESCE(b.purchased,0)-COALESCE(f.sold,0) AS quantity,
 COALESCE(b.purchased,0) AS purchased_surface,
 COALESCE(f.sold,0) AS sold_surface,
 COALESCE(f.sold_30_days,0) AS sold_30_days,
 GREATEST(p.min_stock,ROUND(COALESCE(f.sold_30_days,0)*7/30,6)) AS alert_threshold
FROM products p
LEFT JOIN (
 SELECT l.product_id,SUM(l.surface*l.quantity) AS purchased
 FROM bon_achat_lines l JOIN bon_achats b ON b.id=l.bon_achat_id
 WHERE b.status<>'CANCELLED' GROUP BY l.product_id
) b ON b.product_id=p.id
LEFT JOIN (
 SELECT l.product_id,SUM(l.surface*l.quantity) AS sold,
 SUM(CASE WHEN f.date>=CURRENT_DATE-INTERVAL '29' DAY AND f.date<CURRENT_DATE+INTERVAL '1' DAY THEN l.surface*l.quantity ELSE 0 END) AS sold_30_days
 FROM facture_lines l JOIN factures f ON f.id=l.facture_id GROUP BY l.product_id
) f ON f.product_id=p.id;
