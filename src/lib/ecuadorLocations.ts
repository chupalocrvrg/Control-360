// Lista estandarizada de Provincias y Cantones del Ecuador
export interface ProvinceData {
  name: string;
  cantons: string[];
}

export const ECUADOR_PROVINCES: ProvinceData[] = [
  {
    name: 'Azuay',
    cantons: ['Cuenca', 'Camilo Ponce Enríquez', 'Chordeleg', 'El Pan', 'Girón', 'Guachapala', 'Gualaceo', 'Nabón', 'Oña', 'Paute', 'Pucará', 'San Fernando', 'Santa Isabel', 'Sevilla de Oro', 'Sigsig']
  },
  {
    name: 'Bolívar',
    cantons: ['Guaranda', 'Caluma', 'Chillanes', 'Chimbo', 'Echeandía', 'Las Naves', 'San Miguel']
  },
  {
    name: 'Cañar',
    cantons: ['La Troncal', 'Azogues', 'Cañar', 'Biblián', 'Déleg', 'El Tambo', 'Suscal']
  },
  {
    name: 'Carchi',
    cantons: ['Tulcán', 'Bolívar', 'Espejo', 'Mira', 'Montúfar', 'San Pedro de Huaca']
  },
  {
    name: 'Chimborazo',
    cantons: ['Riobamba', 'Alausi', 'Chambo', 'Chunchi', 'Colta', 'Cumandá', 'Guamote', 'Guano', 'Pallatanga', 'Penipe']
  },
  {
    name: 'Cotopaxi',
    cantons: ['Latacunga', 'La Maná', 'Pangua', 'Pujilí', 'Salcedo', 'Saquisilí', 'Sigchos']
  },
  {
    name: 'El Oro',
    cantons: ['Machala', 'Arenillas', 'Atahualpa', 'Balsas', 'Chilla', 'El Guabo', 'Huaquillas', 'Las Lajas', 'Marcabelí', 'Pasaje', 'Piñas', 'Portovelo', 'Santa Rosa', 'Zaruma']
  },
  {
    name: 'Esmeraldas',
    cantons: ['Esmeraldas', 'Atacames', 'Eloy Alfaro', 'Muisne', 'Quinindé', 'Rioverde', 'San Lorenzo']
  },
  {
    name: 'Galápagos',
    cantons: ['San Cristóbal', 'Isabela', 'Santa Cruz']
  },
  {
    name: 'Guayas',
    cantons: ['Guayaquil', 'Alfredo Baquerizo Moreno (Juján)', 'Balao', 'Balzar', 'Colimes', 'Daule', 'Durán', 'El Empalme', 'El Triunfo', 'General Antonio Elizalde (Bucay)', 'Isidro Ayora', 'Lomas de Sargentillo', 'Marcelino Maridueña', 'Milagro', 'Naranjal', 'Naranjito', 'Nobol', 'Palestina', 'Pedro Carbo', 'Playas (General Villamil)', 'Salitre', 'Samborondón', 'San Jacinto de Yaguachi', 'Santa Lucía', 'Simón Bolívar']
  },
  {
    name: 'Imbabura',
    cantons: ['Ibarra', 'Antonio Ante', 'Cotacachi', 'Otavalo', 'Pimampiro', 'San Miguel de Urcuquí']
  },
  {
    name: 'Loja',
    cantons: ['Loja', 'Calvas', 'Catamayo', 'Celica', 'Chaguarpamba', 'Espíndola', 'Gonzanamá', 'Macará', 'Olmedo', 'Paltas', 'Pindal', 'Puyango', 'Quilanga', 'Saraguro', 'Sozoranga', 'Zapotillo']
  },
  {
    name: 'Los Ríos',
    cantons: ['Babahoyo', 'Baba', 'Buena Fe', 'Mocache', 'Montalvo', 'Palenque', 'Puebloviejo', 'Quevedo', 'Quinsaloma', 'Urdaneta', 'Valencia', 'Ventanas', 'Vinces']
  },
  {
    name: 'Manabí',
    cantons: ['Portoviejo', 'Bolívar (Calceta)', 'Chone', 'El Carmen', 'Flavio Alfaro', 'Jama', 'Jaramijó', 'Jipijapa', 'Junín', 'Manta', 'Montecristi', 'Olmedo', 'Paján', 'Pedernales', 'Pichincha', 'Puerto López', 'Rocafuerte', 'San Vicente', 'Santa Ana', 'Sucre (Bahía de Caráquez)', 'Tosagua', 'Veinticuatro de Mayo']
  },
  {
    name: 'Morona Santiago',
    cantons: ['Morona (Macas)', 'Gualaquiza', 'Huamboya', 'Limón Indanza', 'Logroño', 'Pablo Sexto', 'Palora', 'San Juan Bosco', 'Santiago de Méndez', 'Sucúa', 'Taisha', 'Tiwintza']
  },
  {
    name: 'Napo',
    cantons: ['Tena', 'Archidona', 'Carlos Julio Arosemena Tola', 'El Chaco', 'Quijos (Baeza)']
  },
  {
    name: 'Orellana',
    cantons: ['Francisco de Orellana (El Coca)', 'Aguarico', 'La Joya de los Sachas', 'Loreto']
  },
  {
    name: 'Pastaza',
    cantons: ['Pastaza (Puyo)', 'Arajuno', 'Mera', 'Santa Clara']
  },
  {
    name: 'Pichincha',
    cantons: ['Quito', 'Cayambe', 'Mejía (Machachi)', 'Pedro Moncayo (Tabacundo)', 'Pedro Vicente Maldonado', 'Puerto Quito', 'Rumiñahui (Sangolquí)', 'San Miguel de los Bancos']
  },
  {
    name: 'Santa Elena',
    cantons: ['Santa Elena', 'La Libertad', 'Salinas']
  },
  {
    name: 'Santo Domingo de los Tsáchilas',
    cantons: ['Santo Domingo', 'La Concordia']
  },
  {
    name: 'Sucumbíos',
    cantons: ['Lago Agrio (Nueva Loja)', 'Cascales', 'Cuyabeno', 'Gonzalo Pizarro', 'Putumayo', 'Shushufindi', 'Sucumbíos']
  },
  {
    name: 'Tungurahua',
    cantons: ['Ambato', 'Baños de Agua Santa', 'Cevallos', 'Mocha', 'Patate', 'Pelileo', 'Píllaro', 'Quero', 'Tisaleo']
  },
  {
    name: 'Zamora Chinchipe',
    cantons: ['Zamora', 'Centinela del Cóndor', 'Chinchipe', 'El Pangui', 'Nangaritza', 'Palanda', 'Paquisha', 'Yacuambi', 'Yantzaza']
  }
];

export function getCantonsByProvince(provinceName?: string): string[] {
  if (!provinceName) return [];
  const prov = ECUADOR_PROVINCES.find(
    p => p.name.toLowerCase() === provinceName.trim().toLowerCase()
  );
  return prov ? prov.cantons : [];
}
