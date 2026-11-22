#!/usr/bin/env python3
"""Export one shop's purchase and sale data to CSV files (open them in Excel).
Usage: python3 tools/export_csv.py --shop-phone 03001234567 [--out exports]
"""
import argparse, csv, json, sqlite3, sys
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--data-dir", default="server/data")
p.add_argument("--shop-phone", required=True)
p.add_argument("--out", default="exports")
a = p.parse_args()

db = sqlite3.connect(Path(a.data_dir) / "app.db"); db.row_factory = sqlite3.Row
shop = db.execute("SELECT * FROM shops WHERE phone=?", (a.shop_phone,)).fetchone()
if not shop:
    sys.exit("No shop found with this phone number")
out = Path(a.out); out.mkdir(exist_ok=True)

def items(s): return "; ".join(f"{i['name']} x{i['qty']} @{i['price']}" for i in json.loads(s))

with open(out / f"sales-{shop['phone']}.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["date", "bill_number", "category", "items", "total", "profit"])
    for r in db.execute("SELECT * FROM sale_bills WHERE shop_id=? AND voided=0 ORDER BY seq", (shop["id"],)):
        w.writerow([r["bill_date"], r["bill_no"], r["category"], items(r["items"]), r["total"], r["profit"]])

with open(out / f"purchases-{shop['phone']}.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(["date", "bill_number", "dealer_type", "dealer", "company", "items", "total_bill"])
    for r in db.execute("""SELECT b.*, d.name dn, d.company dc, d.type dt FROM purchase_bills b
                           JOIN dealers d ON d.id=b.dealer_id WHERE b.shop_id=? ORDER BY b.seq""", (shop["id"],)):
        w.writerow([r["bill_date"], r["bill_no"], r["dt"], r["dn"], r["dc"], items(r["items"]), r["total"]])
print(f"Export complete: {out}/ ({shop['name']})")
