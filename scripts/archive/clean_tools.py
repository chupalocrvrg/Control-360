import json
from datetime import datetime

# Helper to normalize timestamp
def clean_timestamp(val):
    if not val:
        return datetime.utcnow().isoformat()
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        if 'seconds' in val:
            sec = int(val['seconds'])
            return datetime.utcfromtimestamp(sec).isoformat() + "Z"
        if 'timestampValue' in val:
            return val['timestampValue']
    return datetime.utcnow().isoformat()
