// ─────────────────────────────────────────────────────────────
// BRAND LOGO MAP
// Maps lowercase brand name → exact SVG filename (without .svg)
// Filenames match public/logos/ directory (copied from Car Brands Logos/)
// ─────────────────────────────────────────────────────────────
export const BRAND_LOGO_MAP = {
  'toyota':          'Toyota',
  'honda':           'Honda',
  'chevrolet':       'Chevrolet',
  'chevy':           'Chevrolet',
  'ford':            'Ford',
  'nissan':          'Nissan',
  'dodge':           'Dodge',
  'jeep':            'Jeep',
  'hyundai':         'Hyundai',
  'kia':             'Kia',
  'bmw':             'BMW',
  'mercedes':        'Mercedes Benz',
  'mercedes-benz':   'Mercedes Benz',
  'mercedes benz':   'Mercedes Benz',
  'audi':            'Audi',
  'volkswagen':      'Volkswagen',
  'vw':              'Volkswagen',
  'subaru':          'Subaru',
  'mazda':           'Mazda',
  'mitsubishi':      'Mitsubishi',
  'lexus':           'Lexus',
  'infiniti':        'Infiniti',
  'acura':           'Acura',
  'gmc':             'GMC',
  'ram':             'RAM',
  'chrysler':        'Chrysler',
  'cadillac':        'Cadillac',
  'buick':           'Buick',
  'lincoln':         'Lincoln',
  'volvo':           'Volvo',
  'porsche':         'Porsche',
  'land rover':      'Land Rover',
  'landrover':       'Land Rover',
  'jaguar':          'Jaguar',
  'tesla':           'Tesla',
  'mini':            'Mini',
  'fiat':            'Fiat',
  'alfa romeo':      'Alfa Romeo',
  'alfa':            'Alfa Romeo',
  'maserati':        'Maserati',
  'ferrari':         'Ferrari',
  'lamborghini':     'Lamborghini',
  'bentley':         'Bentley',
  'rolls royce':     'Rolls Royce',
  'rolls-royce':     'Rolls Royce',
  'aston martin':    'Aston Martin',
  'mclaren':         'McLaren',
  'bugatti':         'Bugatti',
  'pagani':          'Pagani',
  'koenigsegg':      'Koenigsegg',
  'scion':           'Scion',
  'genesis':         'Genesis',
  'saturn':          'Saturn',
  'pontiac':         'Pontiac',
  'oldsmobile':      'Oldsmobile',
  'mercury':         'Mercury',
  'hummer':          'Hummer',
  'saab':            'Saab',
  'suzuki':          'Suzuki',
  'isuzu':           'Isuzu',
  'datsun':          'Datsun',
  'rivian':          'Rivian',
  'lucid':           'Lucid',
  'polestar':        'Polestar',
  'lotus':           'Lotus',
  'corvette':        'Corvette',
};

/**
 * Resolves the logo path for a given brand name.
 * Returns the /logos/ URL or null if no match.
 */
export const resolveBrandLogo = (make) => {
  if (!make) return null;
  const key = make.toLowerCase().trim();
  const mapped = BRAND_LOGO_MAP[key];
  if (mapped) return `/logos/${mapped}.svg`;
  // Fallback: try the make name directly (in case it already matches a file)
  return `/logos/${make}.svg`;
};

// ─────────────────────────────────────────────────────────────
// CANNED SERVICES / QUICK PRESETS
// Common quick-fill repair and maintenance packages
// ─────────────────────────────────────────────────────────────
export const CANNED_SERVICES = [
  {
    id: 'oil-synthetic',
    name: 'Cambio de Aceite Sintético & Filtro',
    items: [
      { qty: 1, partNo: 'OIL-5W30', descripcion: 'Aceite 5W-30 Full Sintético (Garrafa)', precioUnit: 45.00 },
      { qty: 1, partNo: 'FLT-OIL', descripcion: 'Filtro de Aceite de Alta Calidad', precioUnit: 15.00 },
      { qty: 1, partNo: 'LBR-OIL', descripcion: 'Mano de Obra — Cambio de Aceite y Filtro', precioUnit: 25.00 },
    ],
    defaultObservaciones: 'Próximo cambio recomendado en 5,000 millas o 6 meses. Niveles de fluidos y presión de llantas revisados.',
  },
  {
    id: 'brakes-front',
    name: 'Servicio de Frenos Delanteros',
    items: [
      { qty: 1, partNo: 'BRK-PADS-F', descripcion: 'Juego de Balatas Delanteras Cerámicas', precioUnit: 65.00 },
      { qty: 2, partNo: 'BRK-ROTOR-F', descripcion: 'Discos / Rotores Delanteros Nuevos', precioUnit: 75.00 },
      { qty: 1, partNo: 'LBR-BRK', descripcion: 'Mano de Obra — Instalación y Purga de Frenos', precioUnit: 90.00 },
    ],
    defaultObservaciones: 'Balatas y rotores delanteros reemplazados. Sistema purgado y probado en ruta. Garantía de 6 meses en mano de obra.',
  },
  {
    id: 'tuneup-general',
    name: 'Afinación Mayor (Tune-Up)',
    items: [
      { qty: 4, partNo: 'SPK-IRID', descripcion: 'Bujías de Iridio (Juego de 4)', precioUnit: 18.00 },
      { qty: 1, partNo: 'FLT-AIR', descripcion: 'Filtro de Aire de Motor', precioUnit: 22.00 },
      { qty: 1, partNo: 'FLT-CABIN', descripcion: 'Filtro de Cabina (A/C)', precioUnit: 20.00 },
      { qty: 1, partNo: 'CLN-THROT', descripcion: 'Limpieza de Cuerpo de Aceleración y Sensores', precioUnit: 45.00 },
      { qty: 1, partNo: 'LBR-TUNE', descripcion: 'Mano de Obra — Afinación Mayor', precioUnit: 120.00 },
    ],
    defaultObservaciones: 'Afinación completa realizada. Calibración de bujías e inspección de bobinas de encendido. Motor responde suavemente.',
  },
  {
    id: 'diag-scan',
    name: 'Diagnóstico por Escáner / Check Engine',
    items: [
      { qty: 1, partNo: 'DIAG-OBD2', descripcion: 'Escaneo Computarizado OBD-II y Lectura de Códigos', precioUnit: 60.00 },
      { qty: 1, partNo: 'LBR-INSP', descripcion: 'Inspección Física y Pruebas de Sensores', precioUnit: 50.00 },
    ],
    defaultObservaciones: 'Se detectaron códigos de falla en el sistema. Se presentó cotización detallada de reparación al cliente.',
  },
  {
    id: 'transmission-fluid',
    name: 'Servicio de Transmisión (Fluido y Filtro)',
    items: [
      { qty: 6, partNo: 'TRS-FLUID', descripcion: 'Fluido Sintético para Transmisión Automática (qt)', precioUnit: 12.00 },
      { qty: 1, partNo: 'TRS-FILTER', descripcion: 'Kit de Filtro y Empaque de Transmisión', precioUnit: 45.00 },
      { qty: 1, partNo: 'LBR-TRS', descripcion: 'Mano de Obra — Cambio de Filtro y Fluido', precioUnit: 110.00 },
    ],
    defaultObservaciones: 'Transmisión drenada, empaque y filtro nuevo instalados. Nivel verificado a temperatura de operación.',
  }
];

// ─────────────────────────────────────────────────────────────
// MOCK VEHICLE DATABASE
// Key: license plate (lowercase, no spaces)
// ─────────────────────────────────────────────────────────────
export const VEHICULOS_MOCK = {};

