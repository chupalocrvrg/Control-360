import json
import re
import os

def clean_val(val):
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
            return [clean_val(x) for x in val['arrayValue'].get('values', [])]
        if 'mapValue' in val:
            fields = val['mapValue'].get('fields', {})
            # Check if this is a firestore timestamp
            if 'seconds' in fields and ('nanoseconds' in fields or 'nanos' in fields):
                sec = int(clean_val(fields['seconds']))
                nano = int(clean_val(fields.get('nanoseconds', fields.get('nanos', 0))))
                # Return iso string or dict
                import datetime
                dt = datetime.datetime.fromtimestamp(sec, tz=datetime.timezone.utc)
                return dt.isoformat()
            res = {}
            for k, v in fields.items():
                res[k] = clean_val(v)
            return res
        res = {}
        for k, v in val.items():
            res[k] = clean_val(v)
        return res
    if isinstance(val, list):
        return [clean_val(x) for x in val]
    return val

def parse_firestore_doc(doc_entry):
    doc_id = doc_entry.get('documentId')
    cg = doc_entry.get('collectionGroup')
    raw_doc = doc_entry.get('document', {})
    raw_fields = raw_doc.get('fields', {})
    
    clean_item = {'id': doc_id}
    for k, v in raw_fields.items():
        clean_item[k] = clean_val(v)
    return cg, clean_item
