import json
import os

with open('./src/data/recoveredBudgets.json', 'r', encoding='utf-8') as f:
    budgets = json.load(f)

with open('./src/data/recoveredEmployees.json', 'r', encoding='utf-8') as f:
    employees = json.load(f)

with open('./src/data/recoveredCollections.json', 'r', encoding='utf-8') as f:
    collections = json.load(f)

with open('./src/data/recoveredSales.json', 'r', encoding='utf-8') as f:
    sales = json.load(f)

with open('./src/data/recoveredChecksPart1.json', 'r', encoding='utf-8') as f:
    checks1 = json.load(f)

with open('./src/data/recoveredChecksPart2.json', 'r', encoding='utf-8') as f:
    checks2 = json.load(f)

checks = checks1 + checks2

with open('./src/data/recoveredSettings.json', 'r', encoding='utf-8') as f:
    settings = json.load(f)

with open('./src/data/recoveredUser.json', 'r', encoding='utf-8') as f:
    user = json.load(f)

backup = {
    "version": "4.53.0",
    "timestamp": "2026-08-23T18:45:00.000Z",
    "type": "full",
    "data": {
        "budgets": budgets,
        "employees": employees,
        "collections": collections,
        "sales": sales,
        "checks": checks,
        "settings": [settings],
        "userSettings": [settings],
        "users": [user]
    }
}

with open('./public/backup_restaurado_automatico.json', 'w', encoding='utf-8') as f:
    json.dump(backup, f, indent=2, ensure_ascii=False)

print(f"Full backup assembled successfully!")
print(f"- Budgets: {len(budgets)}")
print(f"- Employees: {len(employees)}")
print(f"- Collections: {len(collections)}")
print(f"- Sales: {len(sales)}")
print(f"- Checks: {len(checks)}")
