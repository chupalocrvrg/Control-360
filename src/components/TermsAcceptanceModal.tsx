import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, UserCheck, Check } from 'lucide-react';
import { generalClauses, privateDerickClauses } from '../data/termsData';

interface TermsAcceptanceModalProps {
  onAccept: () => void;
}

export default function TermsAcceptanceModal({ onAccept }: TermsAcceptanceModalProps) {
  const { profile } = useAuth();
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedContract, setAcceptedContract] = useState(false);

  const isDerick = profile?.email === 'creditosderick15@gmail.com';
  
  // Para Derick, mostramos ambos: Términos Generales y el Acuerdo Privado
  const [activeTab, setActiveTab] = useState<'general' | 'private'>(isDerick ? 'private' : 'general');

  const toggleClause = (id: string) => {
    if (expandedClause === id) {
      setExpandedClause(null);
    } else {
      setExpandedClause(id);
    }
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    await onAccept();
    setIsAccepting(false);
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="bg-white dark:bg-neutral-900 w-full max-w-4xl rounded-[2rem] shadow-2xl flex flex-col max-h-full overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1">
              <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-full mb-3">
                Actualización de Seguridad
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                {isDerick ? 'Documentación Legal y Privada' : 'Nuevos Términos y Condiciones'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 font-medium">
                {isDerick 
                  ? 'Es obligatorio revisar y aceptar tanto los Términos Generales como el Acuerdo Bilateral para continuar.'
                  : 'Hemos actualizado nuestros términos legales y condiciones de servicio. Para continuar utilizando la plataforma, es necesario que revises y aceptes las nuevas disposiciones.'}
              </p>
            </div>
          </div>

          {/* Tabs for Derick */}
          {isDerick && (
            <div className="flex p-1 bg-neutral-200 dark:bg-neutral-800 rounded-xl mt-6 gap-1">
              <button
                onClick={() => setActiveTab('private')}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeTab === 'private' 
                    ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                1. Acuerdo Bilateral
              </button>
              <button
                onClick={() => setActiveTab('general')}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeTab === 'general' 
                    ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                2. Términos Generales
              </button>
            </div>
          )}
        </div>

        {/* Body (Scrollable Clauses) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white dark:bg-neutral-900">
          <div className="space-y-4">
            {(activeTab === 'private' ? privateDerickClauses : generalClauses).map((clause) => (
              <div 
                key={clause.id}
                className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden transition-all bg-white dark:bg-neutral-900/50"
              >
                <button
                  onClick={() => toggleClause(clause.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3 sm:gap-4 pr-4">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold text-xs shrink-0">
                      {clause.number}
                    </span>
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm sm:text-base">
                      {clause.title}
                    </h3>
                  </div>
                  {expandedClause === clause.id ? (
                    <ChevronUp className="w-5 h-5 text-neutral-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-400 shrink-0" />
                  )}
                </button>
                
                {expandedClause === clause.id && (
                  <div className="p-5 pt-0 border-t border-neutral-100 dark:border-neutral-800/50 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    <div className="mt-4">
                      {clause.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 sm:p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 shrink-0 space-y-6">
          {/* Checkboxes de Aceptación */}
          <div className="space-y-4">
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="relative flex items-center mt-1">
                <input 
                  type="checkbox"
                  id="checkbox-terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-neutral-300 dark:border-neutral-700 checked:bg-indigo-600 checked:border-indigo-600 transition-all shadow-sm"
                />
                <Check className="absolute h-4 w-4 text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity" strokeWidth={4} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Acepto los Términos y Condiciones Generales
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-500 font-medium">
                  He revisado y comprendido la política de uso y privacidad.
                </p>
              </div>
            </label>

            {isDerick && (
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="relative flex items-center mt-1">
                  <input 
                    type="checkbox"
                    id="checkbox-contract"
                    checked={acceptedContract}
                    onChange={(e) => setAcceptedContract(e.target.checked)}
                    className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-neutral-300 dark:border-neutral-700 checked:bg-indigo-600 checked:border-indigo-600 transition-all shadow-sm"
                  />
                  <Check className="absolute h-4 w-4 text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity" strokeWidth={4} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Acepto el Acuerdo Bilateral Privado
                  </p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-500 font-medium">
                    Reconozco los acuerdos de propiedad y servicios de administrador.
                  </p>
                </div>
              </label>
            )}
          </div>

          <div className="flex items-start gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-200/50 dark:bg-neutral-800/50 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <UserCheck className="w-5 h-5 text-indigo-500 shrink-0" />
            <p className="leading-relaxed">
              {isDerick 
                ? 'Para el usuario administrador, es obligatorio marcar ambas casillas de aceptación por separado antes de continuar.'
                : 'Para continuar, es obligatorio que marques la casilla de aceptación confirmando que has leído este documento legal.'}
            </p>
          </div>
          
          <button
            onClick={onAccept}
            disabled={isAccepting || !acceptedTerms || (isDerick && !acceptedContract)}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-500/25 transition-all active:scale-95 disabled:opacity-40 disabled:grayscale disabled:active:scale-100"
          >
            {isAccepting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            {isAccepting ? 'Guardando Aceptación...' : (isDerick ? 'Confirmar Todo y Continuar' : 'Aceptar y Continuar')}
          </button>
        </div>

      </div>
    </div>
  );
}
