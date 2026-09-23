import json
import os

# Helper to clean proto-like fields from Firestore
def clean_proto(val):
    if val is None:
        return None
    if isinstance(val, dict):
        if 'stringValue' in val:
            return val['stringValue']
        if 'integerValue' in val:
            return int(val['integerValue'])
        if 'doubleValue' in val:
            return float(val['doubleValue'])
        if 'booleanValue' in val:
            return val['booleanValue']
        if 'timestampValue' in val:
            return val['timestampValue']
        if 'nullValue' in val:
            return None
        if 'arrayValue' in val:
            return [clean_proto(x) for x in val['arrayValue'].get('values', [])]
        if 'mapValue' in val:
            f = val['mapValue'].get('fields', {})
            if 'seconds' in f:
                s = int(clean_proto(f['seconds']))
                ns = int(clean_proto(f.get('nanoseconds', 0)))
                return s # or ISO
            res = {}
            for k, v in f.items():
                res[k] = clean_proto(v)
            return res
        res = {}
        for k, v in val.items():
            res[k] = clean_proto(v)
        return res
    if isinstance(val, list):
        return [clean_proto(x) for x in val]
    return val

print("Python extractor ready")
