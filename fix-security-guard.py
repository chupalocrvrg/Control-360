import re

with open('src/components/SecurityGuard.tsx', 'r') as f:
    content = f.read()

# Add import
if 'TermsAcceptanceModal' not in content:
    content = content.replace("import { Shield, Fingerprint, Lock, CheckCircle2, XCircle, Power, Clock, ShieldAlert } from 'lucide-react';", 
    "import { Shield, Fingerprint, Lock, CheckCircle2, XCircle, Power, Clock, ShieldAlert } from 'lucide-react';\nimport TermsAcceptanceModal from './TermsAcceptanceModal';\nimport { CURRENT_TERMS_VERSION } from '../data/termsData';")
    
# Inside component
    insert_idx = content.find("if (isExpired)")
    
    terms_check = """
  // Terms Acceptance check
  const [showTerms, setShowTerms] = useState(false);
  const { showToast } = useNotification();
  
  useEffect(() => {
    if (sessionVerified && profile && profile.termsVersion !== CURRENT_TERMS_VERSION) {
      setShowTerms(true);
    }
  }, [sessionVerified, profile]);

  const handleAcceptTerms = async () => {
    try {
      await updateProfile({
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: new Date().toISOString()
      });
      setShowTerms(false);
      showToast('Términos y condiciones aceptados correctamente', 'success');
    } catch (error) {
      console.error('Error accepting terms:', error);
      showToast('Error al guardar la aceptación de los términos', 'error');
    }
  };

"""
    content = content[:insert_idx] + terms_check + content[insert_idx:]
    
    # Render logic
    # Right before the last `return <>{children}</>;`
    return_idx = content.rfind("return <>{children}</>;")
    new_return = """
  if (showTerms) {
    return <TermsAcceptanceModal onAccept={handleAcceptTerms} />;
  }

  return <>{children}</>;
"""
    content = content[:return_idx] + new_return
    
    # Ensure updateProfile is destructured
    if "updateProfile" not in content[:insert_idx]:
       print("updateProfile not found in destructured useAuth!")

with open('src/components/SecurityGuard.tsx', 'w') as f:
    f.write(content)
