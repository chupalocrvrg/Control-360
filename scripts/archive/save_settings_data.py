import json
import os

# Complete remaining collections and sales
settings_data = {
  "currency": "USD",
  "dockMagnification": True,
  "accentColor": "cyan",
  "iva": 15,
  "banks": ["Banco Pichincha"],
  "dockMagnificationType": "size",
  "menuPosition": "bottom",
  "liquidBackgroundType": "gradient",
  "language": "es",
  "dockProximity": True,
  "uiStyle": "liquid-glass",
  "theme": "light"
}

user_data = {
  "id": "AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2",
  "email": "creditosderick15@gmail.com",
  "name": "Almacenes Derick",
  "role": "enterprise",
  "status": "ENABLED",
  "hasCompletedOnboarding": True,
  "pin": "bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a"
}

with open('./src/data/recoveredSettings.json', 'w', encoding='utf-8') as f:
    json.dump(settings_data, f, indent=2, ensure_ascii=False)

with open('./src/data/recoveredUser.json', 'w', encoding='utf-8') as f:
    json.dump(user_data, f, indent=2, ensure_ascii=False)

print("Settings and user data written")
