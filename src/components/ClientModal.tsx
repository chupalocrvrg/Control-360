import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Briefcase, 
  Users, 
  Heart, 
  Plus, 
  Trash2, 
  Building, 
  CreditCard,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  FileText
} from 'lucide-react';
import { Client, ClientType, CivilStatus, Gender, EducationLevel, HousingType, PersonalReference } from '../types/client';
import { validateEcuadorId } from '../lib/ecuador-id';
import { formatCurrency, cleanFirestoreData } from '../lib/utils';
import { useNotification } from '../contexts/NotificationContext';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Partial<Client>) => Promise<void>;
  initialData?: Client | null;
  existingClients: Client[];
  isEmbedded?: boolean;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingClients,
  isEmbedded = false
}) => {
  const { showToast } = useNotification();
  
  // Wizard Step State: 'step1' | 'step2' | 'step3'
  const [activeStep, setActiveStep] = useState<'step1' | 'step2' | 'step3'>('step1');
  const [loading, setLoading] = useState(false);

  // Form State
  const [idCard, setIdCard] = useState('');
  const [clientType, setClientType] = useState<ClientType>('CREDITO');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(1000);
  const [notes, setNotes] = useState('');

  // ID Card Validation warning modal/banner
  const [idValidationWarning, setIdValidationWarning] = useState<string | null>(null);
  const [idValidationConfirmed, setIdValidationConfirmed] = useState(false);

  // Secondary Credito fields
  const [civilStatus, setCivilStatus] = useState<CivilStatus>('SOLTERO');
  const [dependentsCount, setDependentsCount] = useState<number>(0);
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>('MASCULINO');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('SECUNDARIA');
  const [housingType, setHousingType] = useState<HousingType>('PROPIA');
  const [residenceTime, setResidenceTime] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');

  // Laboral
  const [workplace, setWorkplace] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [position, setPosition] = useState('');
  const [workPhone, setWorkPhone] = useState('');

  // Conyuge
  const [spouseLastName, setSpouseLastName] = useState('');
  const [spouseFirstName, setSpouseFirstName] = useState('');
  const [spouseIdCard, setSpouseIdCard] = useState('');
  const [spousePhone, setSpousePhone] = useState('');

  // Referencias personales
  const [references, setReferences] = useState<PersonalReference[]>([]);
  const [newRefName, setNewRefName] = useState('');
  const [newRefRelation, setNewRefRelation] = useState('');
  const [newRefPhone, setNewRefPhone] = useState('');
  const [newRefCity, setNewRefCity] = useState('');

  // Garante
  const [hasGuarantor, setHasGuarantor] = useState(false);
  const [selectedGuarantorId, setSelectedGuarantorId] = useState('');

  // Init data
  useEffect(() => {
    if (initialData) {
      setIdCard(initialData.idCard || '');
      setClientType(initialData.clientType || 'CREDITO');
      setLastName(initialData.lastName || '');
      setFirstName(initialData.firstName || '');
      setPhone(initialData.phone || '');
      setAddress(initialData.address || '');
      setCity(initialData.city || '');
      setEmail(initialData.email || '');
      setCreditLimit(initialData.creditLimit ?? 1000);
      setNotes(initialData.notes || '');

      setCivilStatus(initialData.civilStatus || 'SOLTERO');
      setDependentsCount(initialData.dependentsCount || 0);
      setBirthPlace(initialData.birthPlace || '');
      setBirthDate(initialData.birthDate || '');
      setGender(initialData.gender || 'MASCULINO');
      setEducationLevel(initialData.educationLevel || 'SECUNDARIA');
      setHousingType(initialData.housingType || 'PROPIA');
      setResidenceTime(initialData.residenceTime || '');
      setLandlordName(initialData.landlordName || '');
      setLandlordPhone(initialData.landlordPhone || '');

      setWorkplace(initialData.workInfo?.workplace || '');
      setWorkAddress(initialData.workInfo?.workAddress || '');
      setPosition(initialData.workInfo?.position || '');
      setWorkPhone(initialData.workInfo?.workPhone || '');

      setSpouseLastName(initialData.spouseInfo?.lastName || '');
      setSpouseFirstName(initialData.spouseInfo?.firstName || '');
      setSpouseIdCard(initialData.spouseInfo?.idCard || '');
      setSpousePhone(initialData.spouseInfo?.phone || '');

      setReferences(initialData.references || []);

      if (initialData.guarantorClientId) {
        setHasGuarantor(true);
        setSelectedGuarantorId(initialData.guarantorClientId);
      } else {
        setHasGuarantor(false);
        setSelectedGuarantorId('');
      }

      setIdValidationConfirmed(true);
      setActiveStep('step1');
    } else {
      // Reset form
      setIdCard('');
      setClientType('CREDITO');
      setLastName('');
      setFirstName('');
      setPhone('');
      setAddress('');
      setCity('');
      setEmail('');
      setCreditLimit(1000);
      setNotes('');
      setCivilStatus('SOLTERO');
      setDependentsCount(0);
      setBirthPlace('');
      setBirthDate('');
      setGender('MASCULINO');
      setEducationLevel('SECUNDARIA');
      setHousingType('PROPIA');
      setResidenceTime('');
      setLandlordName('');
      setLandlordPhone('');
      setWorkplace('');
      setWorkAddress('');
      setPosition('');
      setWorkPhone('');
      setSpouseLastName('');
      setSpouseFirstName('');
      setSpouseIdCard('');
      setSpousePhone('');
      setReferences([]);
      setHasGuarantor(false);
      setSelectedGuarantorId('');
      setIdValidationConfirmed(false);
      setIdValidationWarning(null);
      setActiveStep('step1');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleIdCardBlur = () => {
    if (!idCard.trim()) {
      setIdValidationWarning(null);
      return;
    }
    const res = validateEcuadorId(idCard);
    if (!res.isValid) {
      setIdValidationWarning(res.errorMessage || 'El número de cédula o RUC ingresado no cumple con el formato oficial de Ecuador.');
      setIdValidationConfirmed(false);
    } else {
      setIdValidationWarning(null);
      setIdValidationConfirmed(true);
    }
  };

  const handleAddReference = () => {
    if (!newRefName.trim() || !newRefPhone.trim()) {
      showToast('Por favor ingresa nombre y teléfono de la referencia.', 'warning');
      return;
    }
    const newRef: PersonalReference = {
      id: Date.now().toString(),
      fullName: newRefName.trim(),
      relationship: newRefRelation.trim() || 'Familiar',
      phone: newRefPhone.trim(),
      city: newRefCity.trim() || city
    };
    setReferences([...references, newRef]);
    setNewRefName('');
    setNewRefRelation('');
    setNewRefPhone('');
    setNewRefCity('');
  };

  const handleRemoveReference = (id: string) => {
    setReferences(references.filter(r => r.id !== id));
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    if (!idCard.trim()) {
      showToast('La cédula o RUC es obligatoria.', 'warning');
      setActiveStep('step1');
      return false;
    }
    const checkId = validateEcuadorId(idCard);
    if (!checkId.isValid && !idValidationConfirmed) {
      setIdValidationWarning(checkId.errorMessage || 'Cédula no válida.');
      showToast(checkId.errorMessage || 'Por favor verifica la cédula ingresada.', 'warning');
      setActiveStep('step1');
      return false;
    }
    if (!lastName.trim() || !firstName.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      showToast('Por favor completa los datos principales obligatorios (Nombres, Apellidos, Teléfono, Dirección, Ciudad).', 'warning');
      setActiveStep('step1');
      return false;
    }
    return true;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    if (clientType === 'CREDITO') {
      if (!birthDate.trim()) {
        showToast('Para clientes a Crédito, la fecha de nacimiento es obligatoria.', 'warning');
        setActiveStep('step2');
        return false;
      }
      if (housingType === 'ARRENDADA' && !landlordName.trim()) {
        showToast('Para vivienda arrendada, el nombre del arrendatario es requerido.', 'warning');
        setActiveStep('step2');
        return false;
      }
      if (!workplace.trim() || !workPhone.trim()) {
        showToast('Para clientes a Crédito, la información laboral (Lugar de Trabajo y Teléfono Laboral) es requerida.', 'warning');
        setActiveStep('step2');
        return false;
      }
    }
    return true;
  };

  // Next Step Action
  const handleNextStep = () => {
    if (activeStep === 'step1') {
      if (validateStep1()) {
        if (clientType === 'CONTADO') {
          // If contado, direct advance or submit
          setActiveStep('step2');
        } else {
          setActiveStep('step2');
        }
      }
    } else if (activeStep === 'step2') {
      if (validateStep2()) {
        setActiveStep('step3');
      }
    }
  };

  // Prev Step Action
  const handlePrevStep = () => {
    if (activeStep === 'step3') setActiveStep('step2');
    else if (activeStep === 'step2') setActiveStep('step1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep1()) return;

    if (clientType === 'CREDITO') {
      if (!validateStep2()) return;
      if (references.length < 2) {
        showToast('Para clientes a Crédito, ingrese al menos 2 Referencias Personales en el Paso 3.', 'warning');
        setActiveStep('step3');
        return;
      }
    }

    // Garante seleccionado
    let guarantorData: any = {};
    if (hasGuarantor && selectedGuarantorId) {
      const gClient = existingClients.find(c => c.id === selectedGuarantorId);
      if (gClient) {
        guarantorData = {
          guarantorClientId: gClient.id,
          guarantorName: `${gClient.firstName} ${gClient.lastName}`,
          guarantorIdCard: gClient.idCard,
          guarantorPhone: gClient.phone
        };
      }
    }

    try {
      setLoading(true);

      const rawPayload: Partial<Client> = {
        idCard: idCard.trim(),
        clientType,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        email: email.trim() || '',
        creditLimit: Number(creditLimit) || 0,
        notes: notes.trim() || '',

        ...(clientType === 'CREDITO' ? {
          civilStatus,
          dependentsCount: Number(dependentsCount) || 0,
          birthPlace: birthPlace.trim() || '',
          birthDate: birthDate || '',
          gender,
          educationLevel,
          housingType,
          residenceTime: residenceTime.trim() || '',
          landlordName: housingType === 'ARRENDADA' ? landlordName.trim() : '',
          landlordPhone: housingType === 'ARRENDADA' ? landlordPhone.trim() : '',

          workInfo: {
            workplace: workplace.trim() || '',
            workAddress: workAddress.trim() || '',
            position: position.trim() || '',
            workPhone: workPhone.trim() || ''
          },

          ...((civilStatus === 'CASADO' || civilStatus === 'UNION_LIBRE') && (spouseLastName.trim() || spouseFirstName.trim() || spouseIdCard.trim() || spousePhone.trim()) ? {
            spouseInfo: {
              lastName: spouseLastName.trim() || '',
              firstName: spouseFirstName.trim() || '',
              idCard: spouseIdCard.trim() || '',
              phone: spousePhone.trim() || ''
            }
          } : {}),

          references: references || [],
          ...guarantorData
        } : {})
      };

      const sanitizedPayload = cleanFirestoreData(rawPayload);

      await onSave(sanitizedPayload);
      onClose();
    } catch (err: any) {
      console.error('Error al guardar cliente:', err);
      showToast('Error al guardar cliente: ' + (err.message || err), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Garantes disponibles (excluyendo el cliente actual)
  const availableGuarantors = existingClients.filter(c => c.id !== initialData?.id);

  const stepNumber = activeStep === 'step1' ? 1 : activeStep === 'step2' ? 2 : 3;

  const content = (
    <div className={isEmbedded ? "flex-1 flex flex-col min-h-0 overflow-hidden" : "relative w-[92vw] max-w-6xl h-[88vh] max-h-[920px] bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden my-auto"}>
      
      {/* Top Header */}
      {!isEmbedded && (
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/80 dark:bg-neutral-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
                {initialData ? 'Editar Expediente de Cliente' : 'Registro de Nuevo Cliente'}
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  clientType === 'CREDITO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {clientType}
                </span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                Padrón comercial, expediente crediticio y requisitos para reporte Buró Equifax
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ID Validation Banner */}
      {idValidationWarning && !idValidationConfirmed && (
        <div className="mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start gap-3.5 shrink-0">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <h4 className="font-semibold text-amber-900 dark:text-amber-200">
              Alerta de Verificación de Identificación (Ecuador)
            </h4>
            <p className="text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
              {idValidationWarning}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIdValidationConfirmed(true)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                Sí, deseo continuar con este número
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdValidationWarning(null);
                  setIdCard('');
                }}
                className="px-3.5 py-1.5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Corregir Cédula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED TOP TABS / WIZARD STEPS HEADER */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-6 bg-neutral-50/50 dark:bg-neutral-900/50 overflow-x-auto gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveStep('step1')}
          className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeStep === 'step1'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <div className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-black ${
            activeStep === 'step1' ? 'bg-indigo-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
          }`}>
            1
          </div>
          <User className="w-4 h-4" />
          <span>Paso 1: Datos Principales</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (initialData || clientType === 'CONTADO' || validateStep1()) {
              setActiveStep('step2');
            }
          }}
          className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeStep === 'step2'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20'
              : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <div className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-black ${
            activeStep === 'step2' ? 'bg-indigo-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
          }`}>
            2
          </div>
          <CreditCard className="w-4 h-4" />
          <span>Paso 2: Secundarios, Buró & Laboral</span>
        </button>

        {clientType === 'CREDITO' && (
          <button
            type="button"
            onClick={() => {
              if (initialData || (validateStep1() && validateStep2())) {
                setActiveStep('step3');
              }
            }}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
              activeStep === 'step3'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <div className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-black ${
              activeStep === 'step3' ? 'bg-indigo-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
            }`}>
              3
            </div>
            <Users className="w-4 h-4" />
            <span>Paso 3: Referencias & Garante</span>
          </button>
        )}
      </div>

      {/* FORM CONTENT BODY WITH SCROLL */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto space-y-6">

          {/* PASO 1: DATOS PRINCIPALES */}
          {activeStep === 'step1' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Información Principal de Identificación y Contacto
                  </h3>
                  <p className="text-[11px] text-neutral-500 mt-0.5">Ingrese la cédula o RUC e información domiciliaria primaria.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Tipo de Cliente */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Tipo de Cliente *
                  </label>
                  <select
                    value={clientType}
                    onChange={(e) => setClientType(e.target.value as ClientType)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="CREDITO">CRÉDITO (Requiere Expediente Buró)</option>
                    <option value="CONTADO">CONTADO (Venta Directa de Almacén)</option>
                  </select>
                </div>

                {/* Cédula o RUC */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center justify-between">
                    <span>Cédula de Identidad o RUC *</span>
                    <span className="text-[10px] text-neutral-400 font-normal">Validación oficial Módulo 10 Ecuador</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={13}
                      value={idCard}
                      onChange={(e) => setIdCard(e.target.value.replace(/\D/g, ''))}
                      onBlur={handleIdCardBlur}
                      placeholder="Ej: 0102030405 o 0102030405001"
                      className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                    {idCard.length >= 10 && (
                      <div className="absolute right-3 top-3">
                        {validateEcuadorId(idCard).isValid ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Apellidos o Razón Social *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ej: Pérez Guartambel o Corporación ABC"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Nombres *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ej: Juan Carlos"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Teléfono / Celular *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 0991234567"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Ciudad o Sector *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej: Cuenca, Gualaceo..."
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Dirección Domiciliaria Exacta *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej: Av. Remigio Crespo y Sangurima N° 12-34 (Frente a la Farmacia)"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* PASO 2: DATOS SECUNDARIOS, BURÓ/VIVIENDA & TRABAJO */}
          {activeStep === 'step2' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Sección 1: Datos Personales Secundarios */}
              <div className="space-y-4">
                <div className="pb-1">
                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    1. Estado Civil, Nacimiento y Vivienda (Buró Equifax)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Estado Civil
                    </label>
                    <select
                      value={civilStatus}
                      onChange={(e) => setCivilStatus(e.target.value as CivilStatus)}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="SOLTERO">Soltero(a)</option>
                      <option value="CASADO">Casado(a)</option>
                      <option value="UNION_LIBRE">Unión Libre</option>
                      <option value="DIVORCIADO">Divorciado(a)</option>
                      <option value="VIUDO">Viudo(a)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Género
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                      <option value="OTRO">Otro / Jurídico</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Fecha Nacimiento {clientType === 'CREDITO' && '*'}
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Cargas Familiares
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={dependentsCount}
                      onChange={(e) => setDependentsCount(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Tipo de Vivienda
                    </label>
                    <select
                      value={housingType}
                      onChange={(e) => setHousingType(e.target.value as HousingType)}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="PROPIA">Propia</option>
                      <option value="ARRENDADA">Arrendada</option>
                      <option value="FAMILIAR">Familiar</option>
                      <option value="HIPOTECADA">Hipotecada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Tiempo de Residencia
                    </label>
                    <input
                      type="text"
                      value={residenceTime}
                      onChange={(e) => setResidenceTime(e.target.value)}
                      placeholder="Ej: 5 años"
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Nivel de Educación
                    </label>
                    <select
                      value={educationLevel}
                      onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="PRIMARIA">Primaria</option>
                      <option value="SECUNDARIA">Secundaria</option>
                      <option value="TERCIARIA_TECNICA">Técnica / Tecnológica</option>
                      <option value="UNIVERSITARIA">Universitaria</option>
                      <option value="POSTGRADO">Postgrado</option>
                    </select>
                  </div>
                </div>

                {housingType === 'ARRENDADA' && (
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Nombre del Arrendatario / Dueño *
                      </label>
                      <input
                        type="text"
                        value={landlordName}
                        onChange={(e) => setLandlordName(e.target.value)}
                        placeholder="Ej: Sra. María Gómez"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                        Teléfono del Arrendatario
                      </label>
                      <input
                        type="tel"
                        value={landlordPhone}
                        onChange={(e) => setLandlordPhone(e.target.value)}
                        placeholder="Ej: 0991112233"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cónyuge (si aplica) */}
              {(civilStatus === 'CASADO' || civilStatus === 'UNION_LIBRE') && (
                <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-200 tracking-wider">
                      Datos del Cónyuge / Conviviente
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Apellidos Cónyuge</label>
                      <input
                        type="text"
                        value={spouseLastName}
                        onChange={(e) => setSpouseLastName(e.target.value)}
                        placeholder="Apellidos"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Nombres Cónyuge</label>
                      <input
                        type="text"
                        value={spouseFirstName}
                        onChange={(e) => setSpouseFirstName(e.target.value)}
                        placeholder="Nombres"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-medium text-neutral-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Cédula Cónyuge</label>
                      <input
                        type="text"
                        value={spouseIdCard}
                        onChange={(e) => setSpouseIdCard(e.target.value)}
                        placeholder="Cédula"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-mono text-neutral-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Teléfono Cónyuge</label>
                      <input
                        type="tel"
                        value={spousePhone}
                        onChange={(e) => setSpousePhone(e.target.value)}
                        placeholder="Teléfono"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-mono text-neutral-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sección 2: Información Laboral / Económica */}
              <div className="space-y-4 pt-2">
                <div className="pb-1">
                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    2. Información Laboral / Económica
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Lugar de Trabajo / Empresa {clientType === 'CREDITO' && '*'}
                    </label>
                    <input
                      type="text"
                      value={workplace}
                      onChange={(e) => setWorkplace(e.target.value)}
                      placeholder="Ej: Ministerio de Salud / Negocio Propio"
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-semibold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Cargo / Ocupación
                    </label>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="Ej: Contador / Comerciante"
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Teléfono Laboral {clientType === 'CREDITO' && '*'}
                    </label>
                    <input
                      type="tel"
                      value={workPhone}
                      onChange={(e) => setWorkPhone(e.target.value)}
                      placeholder="Ej: 072834567"
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Dirección del Trabajo
                    </label>
                    <input
                      type="text"
                      value={workAddress}
                      onChange={(e) => setWorkAddress(e.target.value)}
                      placeholder="Ej: Calle Larga y Benigno Malo"
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block uppercase tracking-wider">
                      Límite de Crédito Aprobado ($)
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      Monto máximo financiable para este cliente
                    </span>
                  </div>
                  <div className="relative w-40">
                    <span className="absolute left-3 top-2.5 font-black text-emerald-700">$</span>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-700 rounded-xl text-sm font-black text-emerald-700 dark:text-emerald-300 outline-none"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* PASO 3: REFERENCIAS & GARANTE SOLIDARIO */}
          {activeStep === 'step3' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Referencias Personales */}
              <div className="space-y-4">
                <div className="pb-1 flex items-center justify-between">
                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    1. Referencias Personales o Familiares (Mínimo 2 requeridas)
                  </h3>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                    Registradas: {references.length}
                  </span>
                </div>

                {/* Formulario rápido para añadir referencia */}
                <div className="p-4 bg-neutral-50/50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 rounded-2xl space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Nombres y Apellidos *</label>
                      <input
                        type="text"
                        value={newRefName}
                        onChange={(e) => setNewRefName(e.target.value)}
                        placeholder="Ej: Carlos Andrade"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white font-semibold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Parentesco / Relación</label>
                      <input
                        type="text"
                        value={newRefRelation}
                        onChange={(e) => setNewRefRelation(e.target.value)}
                        placeholder="Ej: Hermano / Amigo"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white font-semibold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Teléfono *</label>
                      <input
                        type="tel"
                        value={newRefPhone}
                        onChange={(e) => setNewRefPhone(e.target.value)}
                        placeholder="Ej: 0987654321"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white font-mono font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Ciudad</label>
                      <input
                        type="text"
                        value={newRefCity}
                        onChange={(e) => setNewRefCity(e.target.value)}
                        placeholder="Ej: Cuenca"
                        className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-white font-semibold outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddReference}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Añadir Referencia
                    </button>
                  </div>
                </div>

                {/* Lista de referencias ingresadas */}
                <div className="space-y-2">
                  {references.length > 0 ? (
                    references.map((r) => (
                      <div key={r.id} className="p-3 bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-neutral-900 dark:text-white">{r.fullName} <span className="font-normal text-neutral-500">({r.relationship})</span></p>
                          <p className="text-neutral-500 font-mono">Telf: {r.phone} • {r.city}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveReference(r.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-neutral-400 italic bg-neutral-50/50 dark:bg-neutral-800/30 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700">
                      No hay referencias registradas aún. Añada al menos 2 referencias usando los campos de arriba.
                    </div>
                  )}
                </div>
              </div>

              {/* Garante Solidario */}
              <div className="space-y-4 pt-2">
                <div className="pb-1 flex items-center justify-between">
                  <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    2. Garante Solidario (Si aplica)
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasGuarantor}
                      onChange={(e) => setHasGuarantor(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">¿Requiere Garante Solidario?</span>
                  </label>
                </div>

                {hasGuarantor && (
                  <div className="p-4 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Seleccionar Cliente Registrado como Garante
                    </label>
                    <select
                      value={selectedGuarantorId}
                      onChange={(e) => setSelectedGuarantorId(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Seleccionar Garante de la Lista de Clientes --</option>
                      {availableGuarantors.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.lastName} {g.firstName} (CI: {g.idCard})
                        </option>
                      ))}
                    </select>

                    {selectedGuarantorId && (
                      (() => {
                        const g = existingClients.find(c => c.id === selectedGuarantorId);
                        if (!g) return null;
                        return (
                          <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl text-xs space-y-1 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                            <p className="font-bold text-neutral-900 dark:text-white">
                              {g.lastName} {g.firstName}
                            </p>
                            <p>Cédula: <span className="font-mono font-bold">{g.idCard}</span> • Teléfono: <span className="font-mono font-bold">{g.phone}</span></p>
                            <p>Dirección: <span className="font-bold">{g.address}, {g.city}</span></p>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* FIXED STICKY FOOTER WITH NAVIGATION BUTTONS */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
              Paso {stepNumber} de {clientType === 'CREDITO' ? 3 : 2}
            </span>
            <div className="flex gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${stepNumber >= 1 ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
              <div className={`w-2.5 h-2.5 rounded-full ${stepNumber >= 2 ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
              {clientType === 'CREDITO' && (
                <div className={`w-2.5 h-2.5 rounded-full ${stepNumber >= 3 ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'}`} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all"
            >
              Cancelar
            </button>

            {activeStep !== 'step1' && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
            )}

            {/* Siguiente Button */}
            {((activeStep === 'step1' && clientType === 'CREDITO') || (activeStep === 'step2' && clientType === 'CREDITO')) && !initialData && (
              <button
                type="button"
                onClick={handleNextStep}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <span>Siguiente Paso</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Final Submit Button */}
            {(activeStep === 'step3' || clientType === 'CONTADO' || initialData || (activeStep === 'step2' && clientType === 'CREDITO')) && (
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Guardando...' : initialData ? 'Guardar Cambios' : 'Registrar Cliente'}</span>
              </button>
            )}
          </div>
        </div>
      </form>

    </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md overflow-hidden">
      {content}
    </div>
  );
};
