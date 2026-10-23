"""Windows'taki kısa dosya kilitleri için atomik JSON yazımı."""
import json
import time
import uuid


def atomic_json(path,value):
    temporary=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
    for attempt in range(8):
        try:
            temporary.replace(path)
            return
        except PermissionError:
            if attempt==7:raise
            time.sleep(.05*(attempt+1))
