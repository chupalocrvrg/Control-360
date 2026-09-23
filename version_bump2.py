import re
import datetime

with open('package.json', 'r') as f:
    pkg = f.read()

pkg = re.sub(r'"version": "4.56.1"', '"version": "4.56.2"', pkg)

with open('package.json', 'w') as f:
    f.write(pkg)

file_path = "src/lib/changelog.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

date_str = datetime.datetime.now().strftime("%Y-%m-%d")

new_entry = f"""  {{
    version: "4.56.2",
    date: "{date_str}",
    changes: [
      "Corrección de Visibilidad: Resuelto un problema crítico donde los cheques antiguos (creados antes del sistema de agrupación por facturas) o cheques huérfanos se sumaban en los totales de búsqueda pero no se mostraban en la lista de resultados."
    ]
  }},"""

pattern = r"(export const staticChangelog: ChangelogRelease\[\] = \[)"
new_content = re.sub(pattern, r"\1\n" + new_entry, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Version updated to 4.56.2")
