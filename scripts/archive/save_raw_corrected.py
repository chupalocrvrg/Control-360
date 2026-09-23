# Save the user payload
import json

raw_json_str = """{
  "timestamp": "2026-08-23T18:27:00.717Z",
  "localStorageDump": {
    "firestore_targets_firestore/[DEFAULT]/gen-lang-client-0052201582.ai-studio-46e1eae7-597b-4f00-8b8c-9cfae95df50e/_4": "{\\"state\\":\\"current\\",\\"updateTimeMs\\":1787429302634}",
    "firestore_clients_firestore/[DEFAULT]/gen-lang-client-0052201582.ai-studio-46e1eae7-597b-4f00-8b8c-9cfae95df50e/_nMHlkZAhaohWpvJkypwp": "{\\"activeTargetIds\\":[4,6],\\"updateTimeMs\\":1787428402990}",
    "firestore_online_state_firestore/[DEFAULT]/gen-lang-client-0052201582.ai-studio-46e1eae7-597b-4f00-8b8c-9cfae95df50e/": "{\\"clientId\\":\\"nMHlkZAhaohWpvJkypwp\\",\\"onlineState\\":\\"Offline\\"}",
    "firestore_targets_firestore/[DEFAULT]/gen-lang-client-0052201582.ai-studio-46e1eae7-597b-4f00-8b8c-9cfae95df50e/_6": "{\\"state\\":\\"current\\",\\"updateTimeMs\\":1787429302635}",
    "firestore_mutations_firestore/[DEFAULT]/gen-lang-client-0052201582.ai-studio-46e1eae7-597b-4f00-8b8c-9cfae95df50e/_65_AvFXCYRHUnMZ7eCIQ5NvpPjM2Uk2": "{\\"state\\":\\"pending\\",\\"updateTimeMs\\":1787508019465}",
    "lastSeenVersion": "V4.43.0",
    "firestore_sequence_number_firestore/[DEFAULT]/gen-lang-client-0052201582.ai-studio-46e1eae7-597b-4f00-8b8c-9cfae95df50e/": "5475"
  }
}"""
