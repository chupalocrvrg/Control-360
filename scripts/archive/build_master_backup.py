# -*- coding: utf-8 -*-
import json

employees = []
checks = []
sales = []
collections = []
budgets = []
settings = {}
user = {}

with open('src/data/recoveredEmployees.json') as f:
    employees = json.load(f)

with open('src/data/recoveredChecks.json') as f:
    checks = json.load(f)

with open('src/data/recoveredSales.json') as f:
    sales = json.load(f)

with open('src/data/recoveredCollections.json') as f:
    collections = json.load(f)

with open('src/data/recoveredBudgets.json') as f:
    budgets = json.load(f)

with open('src/data/recoveredSettings.json') as f:
    settings = json.load(f)

with open('src/data/recoveredUser.json') as f:
    user = json.load(f)

master_backup = {
    "version": "1.0",
    "recoveredAt": "2026-08-23T19:20:00.000Z",
    "totalRecords": len(employees) + len(checks) + len(sales) + len(collections) + len(budgets),
    "employees": employees,
    "checks": checks,
    "sales": sales,
    "collections": collections,
    "budgets": budgets,
    "settings": settings,
    "user": user
}

with open('src/data/recovered_backup_master.json', 'w', encoding='utf-8') as f:
    json.dump(master_backup, f, indent=2)

print(f"Master Backup generated successfully!")
print(f"- Employees: {len(employees)}")
print(f"- Checks: {len(checks)}")
print(f"- Sales: {len(sales)}")
print(f"- Collections: {len(collections)}")
print(f"- Budgets: {len(budgets)}")
print(f"- Total documents: {master_backup['totalRecords']}")
