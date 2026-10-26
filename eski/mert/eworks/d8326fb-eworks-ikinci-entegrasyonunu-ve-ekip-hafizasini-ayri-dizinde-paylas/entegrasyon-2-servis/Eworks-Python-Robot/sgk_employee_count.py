"""SGK hizmet PDF'sindeki tablo satırlarından belgeye ait tekil kişi sayısı."""
import io
import re
from pypdf import PdfReader

def service_employee_count(raw):
    reader=PdfReader(io.BytesIO(raw),strict=False)
    identities=set();rows=0
    for page in reader.pages:
        text=page.extract_text() or ''
        # GİB PDF yazı tipindeki Türkçe glifler bozulabiliyor; ASCII tablo başlıkları korunur.
        header=re.search(r'\bSno\s+S\.G[^\n]*\bNo\b[^\n]*Meslek\s+Kod',text)
        if not header:return None
        table=text[header.end():]
        for line in table.splitlines():
            match=re.match(r'^\s*(\d{1,6})\s+(\d{11})\s+(.+)$',line)
            if not match:continue
            if int(match[1])<1 or len(re.findall(r'\b[\d.]+,\d{2}\b',match[3]))<2:return None
            identities.add(match[2]);rows+=1
    return len(identities) if rows else None
