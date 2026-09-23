import re
import datetime

with open('package.json', 'r') as f:
    pkg = f.read()

pkg = re.sub(r'"version": "4.56.2"', '"version": "4.57.0"', pkg)

with open('package.json', 'w') as f:
    f.write(pkg)

file_path = "src/lib/changelog.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

date_str = datetime.datetime.now().strftime("%Y-%m-%d")

new_entry = f"""  {{
    version: "4.57.0",
    date: "{date_str}",
    changes: [
      "Robustez en Modo Offline: Optimización del flujo de validación del PIN para funcionar correctamente en estados sin conexión, utilizando el caché local y evitando bloqueos al intentar actualizar datos en Firebase.",
      "Flujo de Aceptación Legal: Implementación de nueva política de aceptación de términos y contrato bilateral (específico para créditoDerick). Se bloquea el acceso total al sistema hasta la aceptación, con flujo de validación previo al PIN."
    ]
  }},"""

pattern = r"(export const staticChangelog: ChangelogRelease\[\] = \[)"
new_content = re.sub(pattern, r"\1\n" + new_entry, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Version updated to 4.57.0")
