import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  UserPlus, 
  Printer, 
  Edit, 
  Phone, 
  MapPin, 
  CreditCard, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Client } from '../../types/client';
import { ClientModal } from '../ClientModal';
import { CreditApplicationPrintModal, CreditApplicationPrintData } from './CreditApplicationPrintModal';
import { formatCurrency } from '../../lib/utils';

interface ClientManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onSave: (clientData: Partial<Client>) => Promise<void>;
}

export const ClientManagementModal: React.FC<ClientManagementModalProps> = ({
  isOpen,
  onClose,
  clients,
  onSave
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'search' | 'new'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activePrintData, setActivePrintData] = useState<CreditApplicationPrintData | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const filteredClients = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];
    return clients.filter(c => 
      c.lastName.toLowerCase().includes(query) || 
      c.firstName.toLowerCase().includes(query) || 
      c.idCard.includes(query)
    ).slice(0, 10);
  }, [clients, searchQuery]);

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsEditModalOpen(true);
  };

  const handlePrintExpediente = (client: Client) => {
    const printData: CreditApplicationPrintData = {
      applicationNumber: `SOL-${client.idCard || client.id.slice(0, 8).toUpperCase()}`,
      date: client.createdAt ? client.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
      client: client,
      clientName: `${client.lastName} ${client.firstName}`.trim(),
      clientIdCard: client.idCard,
      clientPhone: client.phone,
      clientAddress: client.address,
      clientCity: client.city,
      clientEmail: client.email,
      workplace: client.workInfo?.workplace,
      workPosition: client.workInfo?.position,
      workPhone: client.workInfo?.workPhone,
      workAddress: client.workInfo?.workAddress,
      spouseName: client.spouseInfo?.lastName ? `${client.spouseInfo.lastName} ${client.spouseInfo.firstName || ''}`.trim() : undefined,
      spouseIdCard: client.spouseInfo?.idCard,
      spousePhone: client.spouseInfo?.phone,
      guarantorName: client.guarantorName,
      guarantorIdCard: client.guarantorIdCard,
      guarantorPhone: client.guarantorPhone,
      references: client.references || [],
      items: [],
      grossTotal: client.creditLimit || 0,
      downPayment: 0,
      netFinancedAmount: client.creditLimit || 0,
      frequency: 'MENSUAL',
      installmentsCount: 12,
      installmentAmount: Math.round((client.creditLimit || 0) / 12),
      startDate: new Date().toISOString().split('T')[0],
      sellerName: 'ASESOR DE CRÉDITO'
    };
    setActivePrintData(printData);
    setIsPrintModalOpen(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
        <div className="bg-white dark:bg-neutral-900 rounded-[2rem] w-full max-w-[80%] h-[85vh] shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="px-8 py-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-neutral-900 dark:text-white">Gestión Central de Clientes</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Búsqueda inteligente, creación y visualización de expedientes</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-2xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-8 pt-4 flex gap-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <button
              onClick={() => setActiveMainTab('search')}
              className={`px-6 py-3 text-sm font-bold border-b-4 transition-all flex items-center gap-2 ${
                activeMainTab === 'search' 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <Search className="w-4 h-4" />
              Búsqueda de Cliente
            </button>
            <button
              onClick={() => setActiveMainTab('new')}
              className={`px-6 py-3 text-sm font-bold border-b-4 transition-all flex items-center gap-2 ${
                activeMainTab === 'new' 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Nuevo Cliente
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 bg-neutral-50/30 dark:bg-neutral-950/20">
            {activeMainTab === 'search' ? (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Search Bar */}
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-400 group-focus-within:text-indigo-600 transition-colors" />
                  <input 
                    type="text"
                    placeholder="Buscar por Cédula, Apellidos o Nombres..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-14 pr-4 py-4 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-3xl text-lg font-medium outline-none focus:border-indigo-600 dark:focus:border-indigo-500 shadow-sm transition-all"
                  />
                </div>

                {/* Results */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredClients.length > 0 ? (
                    filteredClients.map(client => (
                      <div 
                        key={client.id}
                        onClick={() => setSelectedClient(client)}
                        className={`p-5 rounded-3xl border-2 transition-all cursor-pointer group flex items-start gap-4 ${
                          selectedClient?.id === client.id 
                            ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10' 
                            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-sm'
                        }`}
                      >
                        <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center text-neutral-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 transition-colors">
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                            {client.lastName} {client.firstName}
                          </h3>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">CI: {client.idCard}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              {client.clientType}
                            </span>
                            {client.creditLimit > 0 && (
                              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                Cupo: {formatCurrency(client.creditLimit)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-indigo-400 transition-colors mt-1" />
                      </div>
                    ))
                  ) : searchQuery.trim() ? (
                    <div className="col-span-full py-12 text-center bg-white dark:bg-neutral-800 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800">
                      <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                      <p className="text-neutral-500 font-medium">No se encontraron clientes con "{searchQuery}"</p>
                      <button 
                        onClick={() => {
                          setActiveMainTab('new');
                          setSearchQuery('');
                        }}
                        className="mt-4 text-indigo-600 font-bold hover:underline"
                      >
                        Registrar como nuevo cliente
                      </button>
                    </div>
                  ) : (
                    <div className="col-span-full py-12 text-center text-neutral-400 italic">
                      Ingresa datos arriba para comenzar la búsqueda...
                    </div>
                  )}
                </div>

                {/* Detail View of Selected Client */}
                {selectedClient && (
                  <div className="mt-8 bg-white dark:bg-neutral-800 rounded-3xl border-2 border-indigo-600 p-8 shadow-xl animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-2xl font-black text-neutral-900 dark:text-white uppercase tracking-tight">
                          {selectedClient.lastName} {selectedClient.firstName}
                        </h2>
                        <p className="text-neutral-500 font-bold">Expediente del Cliente</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-indigo-500/20"
                          onClick={() => handleEditClient(selectedClient)}
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </button>
                        <button 
                          className="px-4 py-2 bg-neutral-900 text-white hover:bg-black rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-black/10"
                          onClick={() => handlePrintExpediente(selectedClient)}
                        >
                          <Printer className="w-4 h-4" />
                          Imprimir Expediente
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 border-b pb-1">Contacto</h4>
                        <div className="space-y-2">
                          <p className="flex items-center gap-3 text-sm font-medium">
                            <Phone className="w-4 h-4 text-indigo-500" /> {selectedClient.phone}
                          </p>
                          <p className="flex items-center gap-3 text-sm font-medium">
                            <MapPin className="w-4 h-4 text-indigo-500" /> {selectedClient.address}, {selectedClient.city}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 border-b pb-1">Financiero</h4>
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex justify-between">
                            <span>Tipo:</span> <span className="font-bold">{selectedClient.clientType}</span>
                          </p>
                          <p className="text-sm font-medium flex justify-between">
                            <span>Cupo Total:</span> <span className="font-bold text-emerald-600">{formatCurrency(selectedClient.creditLimit)}</span>
                          </p>
                          <p className="text-sm font-medium flex justify-between">
                            <span>Utilizado:</span> <span className="font-bold text-indigo-600">{formatCurrency(selectedClient.creditUsed || 0)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 border-b pb-1">Estado / Otros</h4>
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex justify-between">
                            <span>Estado:</span> 
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                              selectedClient.status === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {selectedClient.status || 'ACTIVO'}
                            </span>
                          </p>
                          <p className="text-sm font-medium flex justify-between">
                            <span>Desde:</span> <span className="font-bold">{new Date(selectedClient.createdAt).toLocaleDateString()}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full overflow-hidden flex flex-col">
                <ClientModal 
                  isOpen={true}
                  onClose={() => setActiveMainTab('search')}
                  onSave={onSave}
                  existingClients={clients}
                  isEmbedded={true}
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Edit Client Modal */}
      {isEditModalOpen && (
        <ClientModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingClient(null);
          }}
          onSave={async (data) => {
            await onSave(data);
            setIsEditModalOpen(false);
            setEditingClient(null);
          }}
          initialData={editingClient}
          existingClients={clients}
        />
      )}

      {/* Print Expediente Modal */}
      {isPrintModalOpen && (
        <CreditApplicationPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          data={activePrintData}
        />
      )}
    </>
  );
};

