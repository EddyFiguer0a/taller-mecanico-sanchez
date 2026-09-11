# 🚗 Taller Automecánica — Sistema de Gestión Integral

Sistema web profesional de alta velocidad (PWA) con enfoque **"Mobile-First"**, diseñado específicamente para optimizar la operación técnica y administrativa en talleres automotrices. 

Permite registrar clientes, vehículos, historiales de servicio, presupuestos y facturas en tiempo real desde cualquier teléfono móvil, tablet o computadora directamente en el área de trabajo del mecánico.

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 19, Vite (para recarga rápida HMR), Tailwind CSS v4, Lucide React.
* **Backend & Base de Datos:** Supabase (PostgreSQL relacional, Row Level Security - RLS).
* **Almacenamiento de Medios:** Supabase Storage (bucket privado para fotografías, comprobantes y URLs firmadas temporales).
* **Despliegue Recomendado:** Vercel / Netlify / Cloudflare Pages.

---

## ✨ Características Principales

* 🔍 **Búsqueda Inteligente y Normalización:** Acceso instantáneo al expediente del vehículo mediante placa. Las placas se normalizan automáticamente y los perfiles de clientes se deduplican por nombre o teléfono.
* 📋 **Órdenes de Servicio y Cotizaciones:** Registro ágil de mano de obra y refacciones con catálogo de "Trabajos Predefinidos" (*Canned Jobs*) para cargar servicios comunes con un solo toque.
* 💵 **Motor Financiero Automatizado:** Cálculo en tiempo real de subtotales, impuestos configurables, anticipos/depósitos (ej. 50% de refacciones), saldos pendientes y desglose de formas de pago.
* 📸 **Estudio Fotográfico de Evidencia:** Captura directa desde la cámara del celular con categorización (Daño Previo/Recepción, Odómetro/Tablero, Refacciones sustituidas, Facturas/Comprobantes).
* 🖨️ **Comprobantes Imprimibles Profesionales:** Vista de impresión (`@media print`) que genera órdenes de trabajo limpias con membrete del taller, datos del vehículo y líneas de firma de conformidad, ocultando menús y botones web.

---

## 🛡️ Integridad de Datos y Experiencia en Taller (Garage UX)

* **Prevención de Envíos Duplicados (Mutex Locks):** Bloqueos en memoria vía React `useRef` para impedir facturas duplicadas si se presiona varias veces el botón "Guardar" en conexiones lentas.
* **Optimización Táctil y Prevención de Zoom en iOS:** Campos de entrada calibrados a 16px para evitar el zoom automático intrusivo de Safari en iPhone, y botones con tamaño mínimo ergonómico (44px-48px).
* **Detección Fuera de Línea:** Alertas tempranas ante caídas de conexión a internet (`navigator.onLine`) antes de enviar formularios.
* **Manejo Amigable de Errores:** Traducción automática de códigos de error de PostgreSQL a mensajes claros en español.
* **Seguridad RLS:** Políticas de seguridad a nivel de fila que garantizan que solo el personal autorizado pueda consultar o modificar registros.

---

## 🗄️ Modelo de Base de Datos

* `customers`: Perfiles de clientes, deduplicación y datos de contacto.
* `vehicles`: Registro de vehículos vinculado al cliente, con placas normalizadas únicas.
* `invoices_services`: Órdenes principales (kilometraje, finanzas, fechas, observaciones).
* `invoice_items`: Partidas de refacciones y mano de obra asociadas a la orden.
* `invoice_attachments`: Metadatos y control de fotos alojadas en Supabase Storage.

---

## 📂 Documentación del Proyecto

Toda la documentación técnica y funcional detallada se encuentra en la carpeta [`documentacion/`](documentacion/):

* 📄 **[Reporte Técnico de Arquitectura y Capacidades](documentacion/reporte_tecnico_arquitectura.md):** Auditoría exhaustiva de la arquitectura, seguridad RLS, ciclo de vida del servicio y UX.
* 📑 **[Manual / Documentación del Taller (PDF)](documentacion/documentacion_taller.pdf):** Documento original de especificaciones y directrices del taller.

---

## 🚀 Instalación y Puesta en Marcha Local

### 1. Requisitos Previos
* Node.js v18 o superior.
* npm o yarn.
* Cuenta y proyecto configurado en [Supabase](https://supabase.com).

### 2. Clonar e Instalar Dependencias
```bash
cd taller-app
npm install
```

### 3. Variables de Entorno
Crea un archivo `.env.local` en la raíz de `taller-app` con las credenciales de tu proyecto de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

*(Nota: el archivo `.env.local` está protegido en `.gitignore` para no exponer tus claves)*.

### 4. Iniciar Servidor de Desarrollo
```bash
npm run dev
```

### 5. Compilar para Producción
```bash
npm run build
```
