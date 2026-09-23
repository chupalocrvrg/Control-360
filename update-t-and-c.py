import re

with open('src/components/TermsAndConditionsInfo.tsx', 'r') as f:
    content = f.read()

# For DERICK_PRIVATE
old_derick = """<div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium space-y-1">
                  <p>Última actualización: <strong>22 de agosto de 2026</strong></p>"""
new_derick = """<div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium space-y-1">
                  <p>Última actualización: <strong>22 de agosto de 2026</strong></p>
                  {profile?.termsAcceptedAt && (
                    <p className="text-indigo-600 dark:text-indigo-400">
                      Términos Aceptados el: <strong>{format(parseISO(profile.termsAcceptedAt), "dd 'de' MMMM 'de' yyyy, 'a las' HH:mm:ss", { locale: es })}</strong>
                    </p>
                  )}"""

content = content.replace(old_derick, new_derick)

# For GENERAL
old_general = """<div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium space-y-1">
                  <p>Última actualización: <strong>22 de agosto de 2026</strong></p>"""
new_general = """<div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium space-y-1">
                  <p>Última actualización: <strong>22 de agosto de 2026</strong></p>
                  {profile?.termsAcceptedAt && (
                    <p className="text-indigo-600 dark:text-indigo-400">
                      Términos Aceptados el: <strong>{format(parseISO(profile.termsAcceptedAt), "dd 'de' MMMM 'de' yyyy, 'a las' HH:mm:ss", { locale: es })}</strong>
                    </p>
                  )}"""

content = content.replace(old_general, new_general)

with open('src/components/TermsAndConditionsInfo.tsx', 'w') as f:
    f.write(content)
