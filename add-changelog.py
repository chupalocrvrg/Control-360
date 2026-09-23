import re
import datetime

file_path = "src/lib/changelog.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Current date
date_str = datetime.datetime.now().strftime("%Y-%m-%d")

new_entry = f"""  {{
    version: "4.55.3",
    date: "{date_str}",
    changes: [
      "Actualización Legal: Renovación del Acuerdo Privado de Reconocimiento de Autoría Independiente y Condición de Cortesía con la inclusión de aceptación tácita por uso e información detallada de la Empresa."
    ]
  }},"""

# Insert right after `export const staticChangelog: ChangelogRelease[] = [`
pattern = r"(export const staticChangelog: ChangelogRelease\[\] = \[)"
new_content = re.sub(pattern, r"\1\n" + new_entry, content, count=1)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Changelog updated successfully.")
