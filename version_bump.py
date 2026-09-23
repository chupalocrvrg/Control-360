import re
import datetime

# Update package.json
with open('package.json', 'r') as f:
    pkg = f.read()

pkg = re.sub(r'"version": "4.56.0"', '"version": "4.56.1"', pkg)

with open('package.json', 'w') as f:
    f.write(pkg)

# Update changelog
file_path = "src/lib/changelog.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

date_str = datetime.datetime.now().strftime("%Y-%m-%d")

new_entry = f"""  {{
    version: "4.56.1",
    date: "{date_str}",
    changes: [
      "Optimización en Consultas: Los grupos de facturas se expanden automáticamente al realizar una búsqueda (por nombre, comprobante, concepto, etc.), permitiendo visualizar de forma inmediata los cheques individuales registrados sin necesidad de clics adicionales."
    ]
  }},"""

pattern = r"(export const staticChangelog: ChangelogRelease\[\] = \[)"
new_content = re.sub(pattern, r"\1\n" + new_entry, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Version updated to 4.56.1")
