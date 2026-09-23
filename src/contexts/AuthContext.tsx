import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, query, collection, where, getDocs, onSnapshot } from 'firebase/firestore';
import { addDays, isAfter, parseISO } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { logAudit, AuditAction } from '../lib/audit';
import { hashPin, legacyHashPin } from '../lib/utils';
import { isSuperAdminEmail } from '../lib/utils';

export interface UserProfile {
  uid?: string;
  name: string;
  businessName?: string;
  commercialName?: string;
  ruc?: string;
  phone?: string;
  email: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER' | 'BODEGUERO' | 'enterprise' | 'employee';
  status: 'ENABLED' | 'DISABLED';
  subscriptionEnd: string;
  pin: string;
  pinInactivityLimit: number;
  lastPinEntry: string;
  createdAt: string;
  enterpriseId?: string;
  photoUrl?: string;
  country?: string;
  province?: string;
  canton?: string;
  address?: string;
  hasCompletedOnboarding?: boolean;
  termsAcceptedAt?: string;
  termsVersion?: string;
  contractAcceptedAt?: string;
  totpSecret?: string;
  totpEnabled?: boolean;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  sessionVerified: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isExpired: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  setSessionVerified: (val: boolean) => void;
  // User simulation properties (untracked in visible updates history indexes)
  impersonatedUser: { uid: string; email: string; displayName?: string } | null;
  impersonatedBy: FirebaseUser | null;
  impersonateUser: (targetUser: { uid: string; email: string; displayName?: string } | null) => Promise<void>;
  originalUser: FirebaseUser | null;
  originalProfile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [actualUser, setActualUser] = useState<FirebaseUser | null>(null);
  const [actualProfile, setActualProfile] = useState<UserProfile | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<{ uid: string; email: string; displayName?: string } | null>(null);
  const [impersonatedBy, setImpersonatedBy] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionVerified, setSessionVerified] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setActualUser(firebaseUser);
      if (firebaseUser) {
        // Sync login with full-stack backend (fire and forget)
        const syncProfile = async () => {
          try {
            const idToken = await firebaseUser.getIdToken();
            await fetch('/api/users/profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || '',
                photoURL: firebaseUser.photoURL || ''
              })
            });
          } catch (e) {
            console.warn('Backend sync pending');
          }
        };
        syncProfile();

        // Real-time profile listener
        const docRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            
            // Auto-heal logic
            const isBodegueroType = data.role === 'BODEGUERO' || (data as any).employeeRole === 'BODEGUERO' || data.role === 'employee' || firebaseUser.email === 'bocansacadamian@gmail.com';
            if (isBodegueroType && (!data.enterpriseId || data.enterpriseId === firebaseUser.uid)) {
              // ... Auto-heal logic is better kept separate or integrated carefully ...
              // For now, let's keep the real-time sync simple for stability
            }

            setActualProfile(data);
            setProfile(data);
            
            // Auto-verify if within timeout window
            if (data.lastPinEntry && !sessionVerified) {
              const lastEntryVal = data.lastPinEntry as any;
              const lastEntry = lastEntryVal?.toDate ? lastEntryVal.toDate() : new Date(lastEntryVal);
              const now = new Date();
              const diffMins = (now.getTime() - lastEntry.getTime()) / 60000;
              if (diffMins >= 0 && diffMins < (data.pinInactivityLimit || 1440)) {
                setSessionVerified(true);
              }
            }
          } else {
            // Profile creation fallback logic
            const defaultProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'Usuario Nuevo',
              role: (isSuperAdminEmail(firebaseUser.email) ? 'SUPERADMIN' : 'enterprise') as any,
              enterpriseId: firebaseUser.uid,
              status: 'ENABLED' as any,
              hasCompletedOnboarding: isSuperAdminEmail(firebaseUser.email),
              subscriptionEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
              createdAt: serverTimestamp(),
              pin: "",
              pinInactivityLimit: 60,
              lastPinEntry: serverTimestamp()
            };
            try {
              await setDoc(docRef, defaultProfile);
            } catch (err) {
              console.error("Could not create fallback profile", err);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile listener error:", error);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setActualProfile(null);
        setProfile(null);
        setSessionVerified(false);
        setImpersonatedUser(null);
        setImpersonatedBy(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

useEffect(() => {
    getRedirectResult(auth).then(result => {
      if (result) {
        logAudit(AuditAction.USER_LOGIN, 'Inicio de sesión exitoso por redirección Google', undefined, result.user);
      }
    }).catch(error => {
      console.error("Error from redirect result:", error);
    });
  }, []);

  useEffect(() => {
    if (!sessionVerified || !profile?.pinInactivityLimit) return;
    
    let inactivityTimeout: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        setSessionVerified(false);
      }, profile.pinInactivityLimit * 60000);
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      clearTimeout(inactivityTimeout);
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [sessionVerified, profile?.pinInactivityLimit]);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const result = await signInWithPopup(auth, provider);
      if (!auth.currentUser) {
        if (window.self !== window.top) {
          throw new Error("Su navegador bloquea el acceso en esta vista incrustada. Por favor, abra la aplicación en una pestaña nueva para iniciar sesión.");
        }
        throw new Error("Edge/Safari está bloqueando las cookies de terceros. Para iniciar sesión, desactive la prevención de rastreo (ícono de candado/escudo en la URL) o permita cookies de terceros.");
      }
      
      // checkUserExists logic
      const firebaseUser = result.user;
      const docRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        console.log("checkUserExists: Profile not found, creating initial document during login flow...");
        const defaultProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Usuario Nuevo',
          role: (isSuperAdminEmail(firebaseUser.email) ? 'SUPERADMIN' : 'USER') as any,
          status: 'ENABLED' as any,
          hasCompletedOnboarding: isSuperAdminEmail(firebaseUser.email),
          subscriptionEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: serverTimestamp(),
          pin: "",
          pinInactivityLimit: 60,
          lastPinEntry: serverTimestamp()
        };
        try {
          await setDoc(docRef, defaultProfile);
          setActualProfile(defaultProfile as unknown as UserProfile);
          setProfile(defaultProfile as unknown as UserProfile);
        } catch (err) {
          console.error("checkUserExists: Could not create fallback profile during login", err);
          throw new Error("No se pudo crear el perfil de usuario. Intenta de nuevo.");
        }
      }
      
      logAudit(AuditAction.USER_LOGIN, 'Inicio de sesión exitoso por proveedor Google', undefined, result.user);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.info("El usuario cerró la ventana emergente de Google.");
        return;
      }
      console.error("Error signing in with Google popup", error);
      if (error.code === 'auth/unauthorized-domain') {
        throw new Error('El dominio actual no está autorizado. Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade tu dominio de Vercel.');
      }
      
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        throw new Error('La ventana de Google fue cerrada o bloqueada. Permite las ventanas emergentes e intenta nuevamente.');
      }

      if (error.message?.includes('cross-origin') || error.message?.includes('third-party') || error.code === 'auth/internal-error') {
        throw new Error("Tu navegador bloquea las cookies de Firebase. Desactiva la Prevención de Rastreo (Edge/Brave) o permite cookies de terceros e intenta de nuevo.");
      }
      
      throw new Error(error.message || 'Ocurrió un error al iniciar sesión. Intenta en otro navegador.');
    }
  };

  const logout = async () => {
    try {
      logAudit(AuditAction.USER_LOGOUT, 'Cierre de sesión manual');
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const verifyPin = async (pin: string) => {
    const targetUid = actualUser?.uid;
    const targetProfile = actualProfile;
    if (!targetUid || !targetProfile) return false;
    
    // Check against salted hash, legacy unsalted hash, or raw string (if unhashed)
    const saltedHash = await hashPin(pin, targetUid);
    const legacyHash = await legacyHashPin(pin);
    const isMatch = !targetProfile.pin || targetProfile.pin === saltedHash || targetProfile.pin === legacyHash || targetProfile.pin === pin;
    
    if (isMatch) {
      try {
        // Upgrade legacy PIN hash to salted hash automatically upon successful verification
        const updates: Record<string, any> = {
          lastPinEntry: serverTimestamp()
        };
        if (targetProfile.pin && targetProfile.pin !== saltedHash) {
          updates.pin = saltedHash;
        }

        // Fire and forget update or handle errors gracefully without blocking verification
        updateDoc(doc(db, 'users', targetUid), updates).catch(e => console.warn("Failed to update lastPinEntry:", e));
        
        const updatedTime = new Date().toISOString();
        if (actualProfile) setActualProfile({ ...actualProfile, lastPinEntry: updatedTime, pin: updates.pin || actualProfile.pin });
        if (!impersonatedUser && profile) setProfile({ ...profile, lastPinEntry: updatedTime, pin: updates.pin || profile.pin });
        setSessionVerified(true);
        return true;
      } catch (error) {
        // Even if update fails, PIN was correct, allow access
        setSessionVerified(true);
        return true;
      }
    }
    return false;
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    const activeUid = impersonatedUser ? impersonatedUser.uid : actualUser?.uid;
    if (!activeUid) return;
    
    // Hash PIN with salt if it is being updated
    const dataToSave = { ...data };
    if (dataToSave.pin) {
      dataToSave.pin = await hashPin(dataToSave.pin, activeUid);
    }
    
    const docRef = doc(db, 'users', activeUid);
    try {
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        const activeEmail = impersonatedUser ? impersonatedUser.email : (actualUser?.email || '');
        const isAdminEmail = isSuperAdminEmail(activeEmail);
        const newProfile = {
          name: dataToSave.name || activeEmail.split('@')[0] || 'Usuario Nuevo',
          ruc: dataToSave.ruc || '',
          phone: dataToSave.phone || '',
          email: activeEmail,
          role: isAdminEmail ? 'SUPERADMIN' : 'USER',
          hasCompletedOnboarding: isAdminEmail ? true : undefined,
          status: 'ENABLED',
          subscriptionEnd: addDays(new Date(), 90).toISOString(),
          pin: dataToSave.pin || '',
          pinInactivityLimit: 60,
          lastPinEntry: serverTimestamp(),
          createdAt: serverTimestamp(),
          enterpriseId: activeUid,
          ...dataToSave
        };
        console.log("newProfile", newProfile); console.log("Creating new profile:", JSON.stringify(newProfile, null, 2)); await setDoc(docRef, newProfile);
        setProfile(newProfile as unknown as UserProfile);
        if (!impersonatedUser) {
          setActualProfile(newProfile as unknown as UserProfile);
        }
      } else {
        await updateDoc(docRef, dataToSave);
        
        // Usar actualizaciones funcionales para evitar problemas de cierre (closure)
        setProfile(prev => prev ? { ...prev, ...dataToSave } : null);
        if (!impersonatedUser) {
          setActualProfile(prev => prev ? { ...prev, ...dataToSave } : null);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${activeUid}`);
    }
  };

  const impersonateUser = async (targetUser: { uid: string; email: string; displayName?: string } | null) => {
    if (!actualUser) return;
    if (!isSuperAdminEmail(actualUser.email)) {
      throw new Error('Solo el Super-Administrador absoluto puede iniciar una simulación de sesión.');
    }

    if (targetUser === null) {
      setImpersonatedUser(null);
      setImpersonatedBy(null);
      setProfile(actualProfile);
      setSessionVerified(true); // Super-Admin returns to verified status
      logAudit(AuditAction.SETTINGS_UPDATE, 'Finalizó simulación de identidad del cliente.');
    } else {
      setImpersonatedUser(targetUser);
      setImpersonatedBy(actualUser);
      
      // Load target user profile
      try {
        const docRef = doc(db, 'users', targetUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Fallback static profile structured gracefully
          setProfile({
            name: targetUser.displayName || targetUser.email.split('@')[0],
            email: targetUser.email,
            role: 'USER',
            status: 'ENABLED',
            subscriptionEnd: addDays(new Date(), 90).toISOString(),
            pin: '',
            pinInactivityLimit: 60,
            lastPinEntry: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
        }
        setSessionVerified(true); // Automatically bypass security keys & PINs during active simulation
        logAudit(AuditAction.SETTINGS_UPDATE, `Inició simulación de identidad para la cuenta: ${targetUser.email}`);
      } catch (error) {
        console.error("Error loading simulation profile from Firestore:", error);
      }
    }
  };

  const effectiveUser = impersonatedUser && actualUser ? ({
    ...actualUser,
    uid: impersonatedUser.uid,
    email: impersonatedUser.email,
    displayName: impersonatedUser.displayName || '',
  } as unknown as FirebaseUser) : actualUser;

  const isSuperAdminOriginal = isSuperAdminEmail(actualUser?.email);
  const isSuperAdmin = profile?.role === 'SUPERADMIN' || isSuperAdminOriginal || isSuperAdminEmail(effectiveUser?.email);
  const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPERADMIN' || isSuperAdminEmail(effectiveUser?.email);
  const isExpired = profile 
    ? (!isAdmin && !isSuperAdminOriginal && (isAfter(new Date(), parseISO(profile.subscriptionEnd)) || profile.status === 'DISABLED')) 
    : (!!effectiveUser);

  return (
    <AuthContext.Provider value={{ 
      user: effectiveUser,
      profile,
      loading,
      sessionVerified,
      isAdmin,
      isSuperAdmin,
      isExpired,
      login,
      logout,
      verifyPin,
      updateProfile,
      setSessionVerified,
      impersonatedUser,
      impersonatedBy,
      impersonateUser,
      originalUser: actualUser,
      originalProfile: profile,
      setProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
