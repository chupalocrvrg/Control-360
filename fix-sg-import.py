import re

with open('src/components/SecurityGuard.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { useAuth } from '../contexts/AuthContext';", "import { useAuth } from '../contexts/AuthContext';\nimport { useNotification } from '../contexts/NotificationContext';")

with open('src/components/SecurityGuard.tsx', 'w') as f:
    f.write(content)
