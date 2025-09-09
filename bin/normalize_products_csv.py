#!/usr/bin/env python3
import csv, io, sys, re, argparse, pathlib

ENCODINGS = ['utf-8-sig','utf-8','cp874','tis-620','windows-874','cp1252','latin1']
SYN = {
    'sku': {'sku','รหัส','รหัสสินค้า','part no','partno','partnumber'},
    'name': {'name','ชื่อ','ชื่อสินค้า','รายละเอียด','descriptions','description'},
    'unit': {'unit','หน่วย','package','แพ็ก','แพค'},
    'price_ex_vat': {'price_ex_vat','price','unit price','unitprice','ราคา','ราคาต่อหน่วย','ราคา/หน่วย','price(exvat)','ราคาก่อนvat'},
    'team_id': {'team_id','team','teamid'},
    'cas_no': {'cas_no','cas','casno','cas no','เลขcas'},
}
CANON_KEYS = ['sku','name','unit','price_ex_vat','team_id','cas_no']

def normkey(s:str)->str: return re.sub(r'[\s\.\-_/]+','', (s or '').strip().lower())

def load_text(path: pathlib.Path) -> tuple[str,str]:
    raw = path.read_bytes()
    for enc in ENCODINGS:
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            continue
    return raw.decode('latin1', errors='ignore'), 'latin1-ignore'

def sniff_delim(text: str) -> str:
    import csv as _csv
    try:
        return _csv.Sniffer().sniff(text[:4096], delimiters=[',',';','\t','|']).delimiter
    except Exception:
        return ','

def build_colmap(fieldnames) -> dict:
    canon_by_norm = {}
    for canon, alts in SYN.items():
        for a in alts:
            canon_by_norm[normkey(a)] = canon
    colmap = {}
    for h in fieldnames or []:
        canon = canon_by_norm.get(normkey(h))
        if canon and canon not in colmap:
            colmap[canon] = h
    return colmap

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--team-id", dest="team", required=True)
    ap.add_argument("--default-unit", dest="defunit", default="บริการ")
    args = ap.parse_args()

    inp = pathlib.Path(args.inp); outp = pathlib.Path(args.out)

    text, used_enc = load_text(inp)
    delim = sniff_delim(text)

    rdr = csv.DictReader(io.StringIO(text), delimiter=delim)
    colmap = build_colmap(rdr.fieldnames)

    outp.parent.mkdir(parents=True, exist_ok=True)
    rows = written = 0
    with outp.open("w", newline="", encoding="utf-8") as g:
        w = csv.DictWriter(g, fieldnames=CANON_KEYS)
        w.writeheader()
        for row in rdr:
            rows += 1
            def get(k):
                h = colmap.get(k)
                return (row.get(h) if h else None)

            sku = (get('sku') or '').strip()
            if not sku:  # ข้ามแถวที่ไม่มี SKU
                continue
            name = (get('name') or sku).strip()
            unit = (get('unit') or args.defunit).strip()
            price = (get('price_ex_vat') or '').replace(',','').strip()
            try: float(price or '0')
            except: price = '0'
            team = (get('team_id') or args.team).strip()
            cas  = (get('cas_no') or '').strip()

            w.writerow({'sku':sku,'name':name,'unit':unit,'price_ex_vat':price,'team_id':team,'cas_no':cas})
            written += 1

    print(f"OK -> {outp} (encoding={used_enc}, delim='{delim}', rows_in={rows}, rows_out={written})")

if __name__ == "__main__":
    main()

