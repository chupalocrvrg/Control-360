import re
import datetime

# Update package.json
with open('package.json', 'r') as f:
    pkg = f.read()

pkg = re.sub(r'"version": "4.55.3"', '"version": "4.55.4"', pkg)

with open('package.json', 'w') as f:
    f.write(pkg)

# Update changelog
file_path = "src/lib/changelog.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

date_str = datetime.datetime.now().strftime("%Y-%m-%d")

new_entry = f"""  {{
    version: "4.55.4",
    date: "{date_str}",
    changes: [
      "Optimización de UI: Corrección en el botón 'Imprimir Constancia' para generar y descargar un documento PDF en lugar de utilizar el menú de impresión del sistema, el cual fallaba por restricciones del navegador."
    ]
  }},"""

pattern = r"(export const staticChangelog: ChangelogRelease\[\] = \[)"
new_content = re.sub(pattern, r"\1\n" + new_entry, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Version updated to 4.55.4")
