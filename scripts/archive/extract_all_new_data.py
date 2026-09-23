# -*- coding: utf-8 -*-
import json
import os
from datetime import datetime

def parse_ts(val):
    if not val:
        return None
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        if 'mapValue' in val:
            f = val['mapValue'].get('fields', {})
            sec = int(f.get('seconds', {}).get('integerValue', 0))
            return datetime.utcfromtimestamp(sec).isoformat() + "Z"
        if 'timestampValue' in val:
            return val['timestampValue']
        if 'seconds' in val:
            sec = int(val['seconds'])
            return datetime.utcfromtimestamp(sec).isoformat() + "Z"
    return str(val)

# We will load existing recovered files to preserve everything
existing_checks = {}
for fn in ['recoveredChecksPart1.json', 'recoveredChecksPart2.json', 'recoveredChecks.json']:
    p = os.path.join('src/data', fn)
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            for item in json.load(f):
                if 'id' in item:
                    existing_checks[item['id']] = item

existing_sales = {}
p_sales = os.path.join('src/data', 'recoveredSales.json')
if os.path.exists(p_sales):
    with open(p_sales, 'r', encoding='utf-8') as f:
        for item in json.load(f):
            if 'id' in item:
                existing_sales[item['id']] = item

existing_collections = {}
p_col = os.path.join('src/data', 'recoveredCollections.json')
if os.path.exists(p_col):
    with open(p_col, 'r', encoding='utf-8') as f:
        for item in json.load(f):
            if 'id' in item:
                existing_collections[item['id']] = item

existing_budgets = {}
p_bud = os.path.join('src/data', 'recoveredBudgets.json')
if os.path.exists(p_bud):
    with open(p_bud, 'r', encoding='utf-8') as f:
        for item in json.load(f):
            if 'id' in item:
                existing_budgets[item['id']] = item

existing_employees = {}
p_emp = os.path.join('src/data', 'recoveredEmployees.json')
if os.path.exists(p_emp):
    with open(p_emp, 'r', encoding='utf-8') as f:
        for item in json.load(f):
            if 'id' in item:
                existing_employees[item['id']] = item

print(f"Loaded existing: checks={len(existing_checks)}, sales={len(existing_sales)}, collections={len(existing_collections)}, budgets={len(existing_budgets)}, employees={len(existing_employees)}")
