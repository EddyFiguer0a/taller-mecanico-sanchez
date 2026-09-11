# Taller Mecánico — Reporte de Arquitectura Técnica y Capacidades Funcionales

**Proyecto:** Aplicación Web de Gestión de Taller Automotriz  
**Tipo:** Progressive Web App (PWA) / Mobile-First Web Application  
**Tecnologías:** React 19, Vite, Tailwind CSS v4, Supabase (PostgreSQL, Auth, Storage)  
**Fecha:** Septiembre 2026  

---

## 1. Visión General del Sistema y Propósito

La aplicación **Taller Mecánico** es una solución web orientada a dispositivos móviles (*Mobile-First*), concebida para la gestión operativa, técnica y financiera integral en talleres automotrices independientes y cadenas de servicio.

Su propósito fundamental es digitalizar el flujo de trabajo completo del taller: desde la recepción de vehículos e inspección física inicial, hasta el desglose de refacciones, mano de obra, cálculo de presupuestos, facturación y consulta de historial por placa.

### Usuarios Objetivo
* **Mecánicos / Técnicos de bahía:** Registro rápido de diagnósticos, odómetro, refacciones utilizadas y evidencia fotográfica en tiempo real a pie de vehículo.
* **Asesores de servicio / Administradores:** Generación de cotizaciones, control de depósitos iniciales (anticipos), saldos pendientes y emisión de comprobantes imprimibles.
* **Propietarios de taller:** Trazabilidad de ingresos, control de clientes y protección legal frente a reclamaciones por daños preexistentes.

### Valor de Negocio
* **Eficiencia Operativa:** Elimina los talonarios de papel y notas manuales propensas a extravío o borrones.
* **Trazabilidad Absoluta:** Historial unificado por placa de vehículo, evitando duplicidades de perfiles.
* **Protección Financiera:** Control automatizado de anticipos (50%), impuestos configurables y saldos por cobrar.
* **Blindaje contra Reclamaciones:** Registro fotográfico de inspección previa (golpes existentes, estado del tablero, odómetro) antes de iniciar labores mecánicas.

---

## 2. Matriz de Funcionalidades (Alcance del Sistema)

### Autenticación y Control de Acceso
* **Seguridad Centralizada:** Integrado con Supabase Auth (correo y contraseña).
* **Persistencia de Sesión:** Manejo de tokens JWT con refresco automático y almacenamiento seguro en cliente.
* **Rutas Protegidas:** Muro de autenticación que impide la consulta, modificación o borrado de datos por usuarios no identificados.

### Gestión de Clientes y Vehículos
* **Búsqueda Rápida por Placa:** Normalización en tiempo real (eliminación de espacios, caracteres especiales y conversión a minúsculas) para indexación precisa.
* **Deduplicación Inteligente de Clientes:** Lógica de coincidencia por número de teléfono normalizado (últimos 7 dígitos) o nombre completo para evitar clientes duplicados en la base de datos.
* **Logotipos de Fabricante:** Detección automática de marca vehicular y renderizado del isotipo correspondiente (`/logos/{marca}.png`) con fallback elegante.

### Creación de Órdenes de Servicio y Facturas
* **Modalidad Dual:** Creación de **Cotizaciones / Presupuestos** (no vinculantes) y **Facturas Finales**.
* **Trabajos Predefinidos (Canned Jobs):** Catálogo de tareas frecuentes (cambio de aceite y filtro, cambio de pastillas de freno, afinación mayor) que se insertan en la orden con un solo toque con precios y descripciones predeterminadas.
* **Líneas Dinámicas de Partidas:** Incorporación flexible de ítems diferenciando refacciones y mano de obra, con cantidades y costos unitarios.

### Motor Financiero Automatizado
* **Cálculo en Tiempo Real:** Subtotales, aplicación de impuestos configurables y gran total.
* **Control de Anticipos (Depósitos):** Registro de abonos iniciales (ej. 50% de anticipo para refacciones) y deducción automática para reflejar el **Saldo Pendiente**.
* **Métodos de Pago:** Registro de modalidad de liquidación (Efectivo, Tarjeta Visa/Mastercard, Transferencia, Cheque).

### Estudio Fotográfico de Evidencia
* **Captura Directa:** Integración con la cámara del dispositivo móvil para captura in situ.
* **Categorización de Imágenes:**
  * *Daño Previo / Recepción:* Rayones, abolladuras preexistentes al ingresar el coche.
  * *Odómetro / Tablero:* Kilometraje de entrada y testigos encendidos.
  * *Refacciones / Piezas sustituidas:* Comprobante de piezas cambiadas.
  * *Facturas / Comprobantes:* Notas de compra de proveedores.
* **Almacenamiento en Nube Segura:** Almacenamiento en bucket privado de Supabase (`shop-invoices`).
* **URLs Firmadas:** Generación de enlaces seguros con caducidad para prevenir accesos no autorizados a través de enlaces directos.

### Módulo de Impresión y Comprobantes Físicos
* **Plantilla Especializada (`InvoiceView.jsx`):** Renderizado optimizado para salida en papel o exportación a PDF.
* **Directivas `@media print` en CSS:** Ocultamiento automático de barras de navegación, botones, pestañas interactivas y fondos pesados durante la impresión.
* **Formato Formal:** Incluye datos fiscales/contacto del taller, detalles del cliente, especificaciones del vehículo, desglose financiero y casillas de firma de conformidad.

---

## 3. Arquitectura Técnica y Tecnologías

### Frontend (Cliente Web)
* **Framework & Bundler:** React 19 sobre Vite, ofreciendo arranque instantáneo y Hot Module Replacement (HMR).
* **Estilos:** Tailwind CSS v4 con arquitectura de diseño táctil y modo oscuro integrado.
* **Iconografía:** `lucide-react` para componentes visuales vectoriales ligeros.
* **Capa de Servicios:** Módulo unificado `tallerService.js` como capa de abstracción de datos (Data Access Layer - DAL).

### Backend y Base de Datos (Supabase / PostgreSQL)
* **Esquema Relacional:**
  * `customers`: Directorio unificado de clientes.
  * `vehicles`: Registro de vehículos vinculados a clientes, con restricción de unicidad por placa.
  * `invoices_services`: Registro principal de órdenes, kilometraje, estatus, totales y notas.
  * `invoice_items`: Detalle de partidas asociadas a cada factura (descripción, precio, cantidad).
  * `invoice_attachments`: Metadatos y rutas de almacenamiento de fotografías.
* **Políticas Row Level Security (RLS):**
  * Políticas estrictas en cada tabla (`USING (auth.role() = 'authenticated')`).
  * Solo personal verificado puede consultar o mutar registros.

---

## 4. Blindaje Operativo y Usabilidad en Taller (Garage UX)

* **Prevención de Duplicados (Mutex Locks):** Implementación de bloqueos de memoria con React `useRef` (`isSavingVehiculoRef`, `isSavingServicioRef`) para bloquear pulsaciones repetidas del botón guardar en conexiones intermitentes.
* **Eliminación de Zoom Involuntario en iOS:** Inputs y campos numéricos forzados a tamaño mínimo de fuente de `16px` para evitar que Safari en iPhone haga zoom automático y desplace la vista.
* **Objetivos Táctiles Ergonómicos:** Botones y selectores con altura mínima de `44px` a `48px`, diseñados para uso con guantes de trabajo o dedos con grasa.
* **Detección de Pérdida de Conectividad:** Monitoreo del estado de red (`navigator.onLine`) que activa un aviso preventivo antes de intentar enviar formularios sin internet.
* **Manejo Amigable de Excepciones:** Función de humanización de errores (`humanizeDbError`) que traduce códigos técnicos de base de datos a mensajes claros en español.
* **Skeletons de Carga:** Placeholders animados para suprimir el salto de contenido (*Cumulative Layout Shift*) durante la carga de historiales.
