import re
import datetime

# Update package.json
with open('package.json', 'r') as f:
    pkg = f.read()

pkg = re.sub(r'"version": "4.55.5"', '"version": "4.56.0"', pkg)

with open('package.json', 'w') as f:
    f.write(pkg)

# Update changelog
file_path = "src/lib/changelog.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

date_str = datetime.datetime.now().strftime("%Y-%m-%d")

new_entry = f"""  {{
    version: "4.56.0",
    date: "{date_str}",
    changes: [
      "Módulo de Términos y Condiciones: Implementación de un sistema de aceptación obligatoria de nuevos términos al iniciar sesión. Se añade un modal detallado con la versión actualizada de los términos, junto con el registro de la fecha y hora de aceptación en el perfil del usuario, la cual ahora se visualiza en la sección de información."
    ]
  }},"""

pattern = r"(export const staticChangelog: ChangelogRelease\[\] = \[)"
new_content = re.sub(pattern, r"\1\n" + new_entry, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Version updated to 4.56.0")
