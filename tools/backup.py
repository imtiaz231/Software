#!/usr/bin/env python3
"""Safe backup of the SQLite database (works while the server is running).
Usage: python3 tools/backup.py [--data-dir server/data] [--out backups] [--keep 14]
Cron (every night at 2 AM): 0 2 * * * cd /path/shop-manager && python3 tools/backup.py
"""
import argparse, sqlite3, shutil, sys
from datetime import datetime
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--data-dir", default="server/data")
p.add_argument("--out", default="backups")
p.add_argument("--keep", type=int, default=14, help="how many old backups to keep")
a = p.parse_args()

data = Path(a.data_dir)
db_file = data / "app.db"
if not db_file.exists():
    sys.exit(f"Database not found: {db_file}")

out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
dest = out / f"app-{stamp}.db"

src = sqlite3.connect(db_file)
dst = sqlite3.connect(dest)
with dst:
    src.backup(dst)  # consistent online backup
src.close(); dst.close()

for folder in ("uploads", "bills"):                      # logos / payment screenshots, and supplier bill photos
    src_dir = data / folder
    if src_dir.exists():
        shutil.make_archive(str(out / f"{folder}-{stamp}"), "zip", src_dir)

for pattern in ("app-*.db", "uploads-*.zip", "bills-*.zip"):
    for old in sorted(out.glob(pattern))[:-a.keep]:
        old.unlink()
print(f"Backup created: {dest}")
