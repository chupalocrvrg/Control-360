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
  HelpCircle
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
  const [activeTab, setActiveTab] = useState<'general' | 'credito' | 'laboral' | 'conyuge' | 'referencias' | 'garante'>('general');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validar cédula
    if (!idCard.trim()) {
      showToast('La cédula o RUC es obligatoria.', 'warning');
      setActiveTab('general');
      return;
    }

    const checkId = validateEcuadorId(idCard);
    if (!checkId.isValid && !idValidationConfirmed) {
      setIdValidationWarning(checkId.errorMessage || 'Cédula no válida.');
      showToast(checkId.errorMessage || 'Por favor verifica la cédula ingresada.', 'warning');
      setActiveTab('general');
      return;
    }

    // 2. Validar campos obligatorios generales
    if (!lastName.trim() || !firstName.trim() || !phone.trim() || !address.trim() || !city.trim()) {
      showToast('Por favor completa todos los campos principales obligatorios (Nombres, Apellidos, Teléfono, Dirección, Ciudad).', 'warning');
      setActiveTab('general');
      return;
    }

    // 3. Validar campos de crédito
    if (clientType === 'CREDITO') {
      if (!birthDate.trim()) {
        showToast('Para clientes a Crédito (Buró Equifax), la fecha de nacimiento es obligatoria.', 'warning');
        setActiveTab('credito');
        return;
      }
      if (housingType === 'ARRENDADA' && !landlordName.trim()) {
        showToast('Para vivienda arrendada, el nombre del arrendatario es requerido.', 'warning');
        setActiveTab('credito');
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

  const content = (
    <div className={isEmbedded ? "flex-1 flex flex-col min-h-0 overflow-hidden" : "relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden my-8"}>
      
      {/* Header */}
      {!isEmbedded && (
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {initialData ? 'Editar Ficha de Cliente' : 'Registrar Nuevo Cliente'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Padrón comercial y requisitos obligatorios para reporte Buró Equifax
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

        {/* Cédula Error Override Modal / Prompt */}
        {idValidationWarning && !idValidationConfirmed && (
          <div className="m-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-3.5">
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
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  Sí, deseo continuar con este número
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIdValidationWarning(null);
                    setIdCard('');
                  }}
                  className="px-3.5 py-1.5 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  Corregir Cédula
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-6 bg-neutral-50/30 dark:bg-neutral-900/50 overflow-x-auto gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'general'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            1. Datos Principales
          </button>

          {clientType === 'CREDITO' && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('credito')}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === 'credito'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                2. Buró / Vivienda
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('laboral')}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === 'laboral'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                3. Info Laboral
              </button>

              {(civilStatus === 'CASADO' || civilStatus === 'UNION_LIBRE') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('conyuge')}
                  className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    activeTab === 'conyuge'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  4. Cónyuge
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('referencias')}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === 'referencias'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                5. Referencias ({references.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('garante')}
                className={`py-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  activeTab === 'garante'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                6. Garante Solidario
              </button>
            </>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[68vh] overflow-y-auto space-y-6">

            {/* TAB 1: GENERAL */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tipo de Cliente */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Tipo de Cliente *
                    </label>
                    <select
                      value={clientType}
                      onChange={(e) => setClientType(e.target.value as ClientType)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="CREDITO">CRÉDITO (Exige Datos Buró)</option>
                      <option value="CONTADO">CONTADO (Venta Directa)</option>
                    </select>
                  </div>

                  {/* Cédula o RUC */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1 flex items-center justify-between">
                      <span>Cédula o RUC *</span>
                      <span className="text-[10px] text-neutral-400 font-normal">Algoritmo Módulo 10 EC</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={13}
                        value={idCard}
                        onChange={(e) => setIdCard(e.target.value.replace(/\D/g, ''))}
                        onBlur={handleIdCardBlur}
                        placeholder="Ej: 0102030405 o 0102030405001"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      {idCard.length >= 10 && (
                        <div className="absolute right-3 top-2.5">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Apellidos o Razón Social *
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ej: Pérez Guartambel o Corporación ABC"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Nombres *
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ej: Juan Carlos"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Teléfono / Celular *
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ej: 0991234567"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Ciudad o Sector *
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ej: Cuenca / El Sagrario"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Correo Electrónico (Opcional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cliente@ejemplo.com"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                    Dirección Domiciliaria Exacta *
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle principal, secundaria y número de casa"
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Cupo para Crédito */}
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      Cupo para Crédito Asignado ($) *
                    </label>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(creditLimit)}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5">
                    Límite máximo de financiamiento directo para este cliente. El semáforo de ventas validará las compras contra este cupo.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: DATOS SECUNDARIOS CREDITO / EQUIFAX */}
            {activeTab === 'credito' && (
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>Estos campos son obligatorios para clientes de crédito conforme a los requerimientos de evaluación y reporte de Buró Equifax.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Estado Civil */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Estado Civil *
                    </label>
                    <select
                      value={civilStatus}
                      onChange={(e) => setCivilStatus(e.target.value as CivilStatus)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="SOLTERO">Soltero/a</option>
                      <option value="CASADO">Casado/a</option>
                      <option value="UNION_LIBRE">Unión Libre</option>
                      <option value="DIVORCIADO">Divorciado/a</option>
                      <option value="VIUDO">Viudo/a</option>
                    </select>
                  </div>

                  {/* Género */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Género *
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  {/* Cargas familiares */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Cargas (Hijos menores de edad) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      value={dependentsCount}
                      onChange={(e) => setDependentsCount(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fecha de Nacimiento */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Fecha de Nacimiento * (Buró Equifax)
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      required={clientType === 'CREDITO'}
                    />
                  </div>

                  {/* Lugar de Nacimiento */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Lugar de Nacimiento
                    </label>
                    <input
                      type="text"
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      placeholder="Ej: Cuenca, Azuay"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Nivel de Educación */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Nivel de Educación *
                    </label>
                    <select
                      value={educationLevel}
                      onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="PRIMARIA">Primaria</option>
                      <option value="SECUNDARIA">Secundaria / Bachillerato</option>
                      <option value="TECNICO">Técnico / Tecnólogo</option>
                      <option value="UNIVERSITARIO">Universitario</option>
                      <option value="POSTGRADO">Postgrado / Maestría</option>
                      <option value="NINGUNO">Sin instrucción formal</option>
                    </select>
                  </div>

                  {/* Tipo de Vivienda */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Tipo de Vivienda *
                    </label>
                    <select
                      value={housingType}
                      onChange={(e) => setHousingType(e.target.value as HousingType)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="PROPIA">Propia</option>
                      <option value="ARRENDADA">Arrendada / Alquilada</option>
                      <option value="FAMILIAR">Familiar / Prestada</option>
                      <option value="HIPOTECADA">Hipotecada</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>

                  {/* Tiempo de residencia */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Tiempo de Residencia *
                    </label>
                    <input
                      type="text"
                      value={residenceTime}
                      onChange={(e) => setResidenceTime(e.target.value)}
                      placeholder="Ej: 5 años / 8 meses"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Si la vivienda es arrendada */}
                {housingType === 'ARRENDADA' && (
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 mb-1">
                        Nombre del Arrendatario (Dueño) *
                      </label>
                      <input
                        type="text"
                        value={landlordName}
                        onChange={(e) => setLandlordName(e.target.value)}
                        placeholder="Nombre completo del arrendador"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                        required={housingType === 'ARRENDADA'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 mb-1">
                        Teléfono del Arrendatario
                      </label>
                      <input
                        type="tel"
                        value={landlordPhone}
                        onChange={(e) => setLandlordPhone(e.target.value)}
                        placeholder="Teléfono de contacto"
                        className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: INFORMACION LABORAL */}
            {activeTab === 'laboral' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Lugar de Trabajo / Empresa
                    </label>
                    <input
                      type="text"
                      value={workplace}
                      onChange={(e) => setWorkplace(e.target.value)}
                      placeholder="Empresa, institución o negocio"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
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
                      placeholder="Ej: Supervisor, Comerciante, Docente"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Dirección del Trabajo
                    </label>
                    <input
                      type="text"
                      value={workAddress}
                      onChange={(e) => setWorkAddress(e.target.value)}
                      placeholder="Dirección laboral / referencias"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Teléfono del Trabajo / Ext.
                    </label>
                    <input
                      type="tel"
                      value={workPhone}
                      onChange={(e) => setWorkPhone(e.target.value)}
                      placeholder="Ej: 072834567 ext 102"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CONYUGE */}
            {activeTab === 'conyuge' && (
              <div className="space-y-4">
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800/60 rounded-xl text-xs text-neutral-600 dark:text-neutral-400">
                  Aplica para clientes en estado civil Casado(a) o Unión Libre.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Apellidos del Cónyuge
                    </label>
                    <input
                      type="text"
                      value={spouseLastName}
                      onChange={(e) => setSpouseLastName(e.target.value)}
                      placeholder="Apellidos"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Nombres del Cónyuge
                    </label>
                    <input
                      type="text"
                      value={spouseFirstName}
                      onChange={(e) => setSpouseFirstName(e.target.value)}
                      placeholder="Nombres"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Cédula del Cónyuge
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={spouseIdCard}
                      onChange={(e) => setSpouseIdCard(e.target.value.replace(/\D/g, ''))}
                      placeholder="10 dígitos"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1">
                      Teléfono del Cónyuge
                    </label>
                    <input
                      type="tel"
                      value={spousePhone}
                      onChange={(e) => setSpousePhone(e.target.value)}
                      placeholder="Celular de contacto"
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: REFERENCIAS PERSONALES */}
            {activeTab === 'referencias' && (
              <div className="space-y-4">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                    Añadir Referencia Personal / Familiar
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <input
                        type="text"
                        value={newRefName}
                        onChange={(e) => setNewRefName(e.target.value)}
                        placeholder="Apellido y Nombre *"
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newRefRelation}
                        onChange={(e) => setNewRefRelation(e.target.value)}
                        placeholder="Parentesco (Ej: Hermano, Amigo)"
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        value={newRefPhone}
                        onChange={(e) => setNewRefPhone(e.target.value)}
                        placeholder="Teléfono *"
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newRefCity}
                        onChange={(e) => setNewRefCity(e.target.value)}
                        placeholder="Ciudad"
                        className="w-full px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddReference}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar Referencia
                    </button>
                  </div>
                </div>

                {/* List of references */}
                {references.length === 0 ? (
                  <div className="text-center py-6 text-neutral-400 text-xs italic">
                    No has agregado referencias aún. Se recomienda al menos 2 referencias para Buró Equifax.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                    {references.map((ref, idx) => (
                      <div key={ref.id || idx} className="p-3 bg-white dark:bg-neutral-800/70 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-neutral-900 dark:text-white">
                            {ref.fullName} <span className="text-neutral-500 font-normal">({ref.relationship})</span>
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {ref.phone}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {ref.city}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveReference(ref.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: GARANTE SOLIDARIO */}
            {activeTab === 'garante' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 rounded-xl">
                  <input
                    type="checkbox"
                    id="chkGuarantor"
                    checked={hasGuarantor}
                    onChange={(e) => setHasGuarantor(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-neutral-300 focus:ring-indigo-500"
                  />
                  <label htmlFor="chkGuarantor" className="text-xs font-bold text-neutral-900 dark:text-white cursor-pointer select-none">
                    Vincular un Garante Solidario para este Cliente
                  </label>
                </div>

                {hasGuarantor && (
                  <div className="space-y-3 p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl">
                    <label className="block text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200 mb-1">
                      Seleccionar Garante de la Lista de Clientes Registrados *
                    </label>
                    <select
                      value={selectedGuarantorId}
                      onChange={(e) => setSelectedGuarantorId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-sm font-semibold text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Selecciona un Cliente Garante --</option>
                      {availableGuarantors.map((cl) => (
                        <option key={cl.id} value={cl.id}>
                          {cl.lastName} {cl.firstName} (CI: {cl.idCard}) - Cupo: {formatCurrency(cl.creditLimit)}
                        </option>
                      ))}
                    </select>

                    {selectedGuarantorId && (
                      (() => {
                        const g = availableGuarantors.find(c => c.id === selectedGuarantorId);
                        if (!g) return null;
                        return (
                          <div className="mt-3 p-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs space-y-1">
                            <p className="font-bold text-neutral-900 dark:text-white">
                              Datos del Garante Vinculado:
                            </p>
                            <p className="text-neutral-600 dark:text-neutral-300">
                              Nombre: <span className="font-medium">{g.lastName} {g.firstName}</span>
                            </p>
                            <p className="text-neutral-600 dark:text-neutral-300">
                              Cédula: <span className="font-medium">{g.idCard}</span> | Teléfono: <span className="font-medium">{g.phone}</span>
                            </p>
                            <p className="text-neutral-600 dark:text-neutral-300">
                              Dirección: <span className="font-medium">{g.address}, {g.city}</span>
                            </p>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
            <div className="text-xs text-neutral-500">
              * Campos indispensables para operaciones de crédito y Buró
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
              >
                {loading ? 'Guardando...' : initialData ? 'Guardar Cambios' : 'Registrar Cliente'}
              </button>
            </div>
          </div>
        </form>

    </div>
  );

  if (isEmbedded) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      {content}
    </div>
  );
};
