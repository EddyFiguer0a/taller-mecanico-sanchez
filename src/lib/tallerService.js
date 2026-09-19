/**
 * ─────────────────────────────────────────────────────────────
 * tallerService.js — Supabase Data Access Layer
 *
 * All database operations for taller-app go through this module.
 * Import named functions wherever you need data (App.jsx, etc.)
 *
 * Pattern:
 *   const { data, error } = await someFunction(args);
 *   if (error) console.error(error);
 * ─────────────────────────────────────────────────────────────
 */

import { supabase } from './supabaseClient';

// ══════════════════════════════════════════════════════════════
// HELPERS & MAPPERS
// ══════════════════════════════════════════════════════════════

export function isUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Maps raw Supabase vehicle + relational query output into the uniform
 * state shape expected across React components (App.jsx, InvoiceView, etc.)
 */
export function formatVehicleFromDB(v) {
  if (!v) return null;
  const cust = v.customers || {};

  const invoices = (v.invoices_services || []).map((inv) => {
    const isEstimate = (inv.service_type || '').toLowerCase().includes('estimate');

    const lineas = (inv.invoice_items || []).map((item) => ({
      id: item.id,
      qty: Number(item.qty) || 1,
      partNo: item.part_number || '',
      descripcion: item.description || '',
      precioUnit: Number(item.unit_price) || 0,
      total: Number(item.total) || 0,
    }));

    const attachments = (inv.invoice_attachments || []).map((att) => ({
      id: att.id,
      url: att.file_url,
      categoria: att.file_type || 'invoice',
      categoriaLabel:
        att.file_type === 'odometer'
          ? 'Odómetro / Millas'
          : att.file_type === 'part'
          ? 'Pieza / Trabajo'
          : att.file_type === 'damage'
          ? 'Daño Previo / Intake'
          : 'Factura / Recibo',
      caption: '',
    }));

    const primaryImg =
      attachments.find((a) => a.categoria === 'invoice')?.url ||
      attachments[0]?.url ||
      null;

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      fecha: inv.date,
      tipo: isEstimate ? 'Estimate' : 'Final Invoice',
      metodoPago: inv.payment_method || 'Cash',
      kilometrajeEntrada: inv.mileage_in || 0,
      kilometrajeSalida: inv.mileage_out || 0,
      subtotal: Number(inv.subtotal) || 0,
      impuesto: Number(inv.tax) || 0,
      total: Number(inv.total_amount) || 0,
      deposito: Number(inv.deposit_paid) || 0,
      saldo: Number(inv.remaining_balance) || 0,
      observaciones: inv.remarks || '',
      tecnico: inv.technician_name || '',
      lineas,
      fotos: attachments,
      facturaImg: primaryImg,
      raw: inv,
    };
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return {
    id: v.id,
    customer_id: v.customer_id,
    placa: v.license_plate,
    marca: v.make,
    modelo: v.model,
    anio: v.year,
    color: v.color || '',
    vin: v.vin || '',
    cliente: {
      id: cust.id,
      nombre: cust.full_name || '',
      telefono: cust.phone || '',
      email: cust.email || '',
      direccion: cust.address || '',
      ciudad: cust.city || '',
      estado: cust.state || '',
      zip: cust.zip || '',
    },
    historial: invoices,
    raw: v,
  };
}

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

/** Sign in with email + password (shop staff only). */
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** Sign out the current user. */
export async function signOut() {
  return supabase.auth.signOut();
}

/** Returns the currently active session (or null). */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ══════════════════════════════════════════════════════════════
// VEHICLES — look up by plate, fetch with customer + history
// ══════════════════════════════════════════════════════════════

/**
 * Search a vehicle by license plate (case-insensitive).
 * Joins customer and all service records with their line items and attachments.
 *
 * @param {string} plate  Raw plate string entered by the user.
 * @returns {{ data: object|null, error: object|null }}
 */
export async function getVehicleByPlate(plate) {
  try {
    const normalized = plate.trim().toLowerCase().replace(/\s+/g, '');

    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        customers (*),
        invoices_services (
          *,
          invoice_items (*),
          invoice_attachments (*)
        )
      `)
      .eq('license_plate', normalized)
      .maybeSingle();

    if (error) {
      console.error('[tallerService] getVehicleByPlate error:', error);
      return { data: null, error };
    }

    return { data: formatVehicleFromDB(data), raw: data, error: null };
  } catch (err) {
    console.error('[tallerService] Unexpected getVehicleByPlate error:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch a vehicle by its UUID (used after creation).
 *
 * @param {string} vehicleId  UUID of the vehicle row.
 */
export async function getVehicleById(vehicleId) {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        customers (*),
        invoices_services (
          *,
          invoice_items (*),
          invoice_attachments (*)
        )
      `)
      .eq('id', vehicleId)
      .maybeSingle();

    if (error) {
      console.error('[tallerService] getVehicleById error:', error);
      return { data: null, error };
    }

    return { data: formatVehicleFromDB(data), raw: data, error: null };
  } catch (err) {
    console.error('[tallerService] Unexpected getVehicleById error:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch all vehicles with their customers and service history from Supabase.
 */
export async function getAllVehicles() {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        *,
        customers (*),
        invoices_services (
          *,
          invoice_items (*),
          invoice_attachments (*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[tallerService] getAllVehicles error:', error);
      return { data: null, error };
    }

    const formatted = (data || []).map(formatVehicleFromDB);
    return { data: formatted, raw: data, error: null };
  } catch (err) {
    console.error('[tallerService] Unexpected getAllVehicles error:', err);
    return { data: null, error: err };
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS — PostgreSQL Error Handling
// ══════════════════════════════════════════════════════════════

/**
 * Translate PostgreSQL / Supabase error codes into user-friendly messages.
 * @param {object} error  Supabase error object
 * @returns {string} Human-readable error message
 */
export function humanizeDbError(error) {
  if (!error) return '';
  const code = error.code || '';
  const msg = error.message || '';
  if (code === '23505') return 'Este registro ya existe en la base de datos (duplicado).';
  if (code === '23503') return 'Referencia inválida: el registro relacionado no existe.';
  if (code === '23502') return 'Faltan campos obligatorios para guardar este registro.';
  if (code === '42501') return 'No tienes permisos para realizar esta operación.';
  if (msg.toLowerCase().includes('network')) return 'Sin conexión a internet. Verifica tu red Wi-Fi.';
  if (msg.toLowerCase().includes('jwt expired') || msg.toLowerCase().includes('token')) return 'Tu sesión ha expirado. Por favor inicia sesión de nuevo.';
  return msg || 'Error desconocido de base de datos.';
}

/** Sanitize numeric currency amounts to 2 decimal places */
export const safeMoney = (v) => parseFloat(parseFloat(v || 0).toFixed(2)) || 0;

// ══════════════════════════════════════════════════════════════
// CUSTOMERS — deduplicated insert
// ══════════════════════════════════════════════════════════════

/**
 * Normalize a phone number for comparison (digits only).
 * @param {string} raw
 * @returns {string}
 */
function normalizePhone(raw) {
  return (raw || '').replace(/\D/g, '').trim();
}

/**
 * Find an existing customer by normalized phone or exact full_name.
 * Returns the first match or null.
 *
 * @param {string} fullName
 * @param {string} phone
 * @returns {Promise<object|null>}
 */
async function findExistingCustomer(fullName, phone) {
  const normalizedPhone = normalizePhone(phone);
  const trimmedName = (fullName || '').trim();

  // 1. Try phone match first (most reliable identifier)
  if (normalizedPhone.length >= 7) {
    const { data: byPhone } = await supabase
      .from('customers')
      .select('*')
      .ilike('phone', `%${normalizedPhone.slice(-7)}%`)
      .limit(5);

    if (byPhone && byPhone.length > 0) {
      // Exact digit match
      const exact = byPhone.find((c) => normalizePhone(c.phone) === normalizedPhone);
      if (exact) return exact;
    }
  }

  // 2. Fallback: exact name match (case-insensitive)
  if (trimmedName && trimmedName.toLowerCase() !== 'cliente' && trimmedName.toLowerCase() !== 'cliente general') {
    const { data: byName } = await supabase
      .from('customers')
      .select('*')
      .ilike('full_name', trimmedName)
      .limit(1)
      .maybeSingle();

    if (byName) return byName;
  }

  return null;
}

/**
 * Upsert a customer record with deduplication.
 * Searches for existing customer by phone or full_name before inserting.
 * If found, updates the existing record. Otherwise creates a new one.
 *
 * @param {{ full_name, phone, email, address, city, state, zip }} customerData
 * @returns {{ data: object, error: object|null }}
 */
export async function upsertCustomer(customerData) {
  try {
    const fullName = customerData.full_name || customerData.nombre || 'Cliente';
    const phone    = customerData.phone || customerData.telefono || '';
    const payload  = {
      full_name: fullName,
      phone:     phone,
      email:     customerData.email || '',
      address:   customerData.address || customerData.direccion || '',
      city:      customerData.city || customerData.ciudad || '',
      state:     customerData.state || customerData.estado || '',
      zip:       customerData.zip || '',
    };

    // Dedup: check if this customer already exists
    const existing = await findExistingCustomer(fullName, phone);

    let data, error;
    if (existing?.id) {
      // Update existing customer with latest info
      const res = await supabase
        .from('customers')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      data = res.data;
      error = res.error;
      if (!error) console.log('[tallerService] Reused existing customer:', existing.id);
    } else {
      // Insert new customer
      const res = await supabase
        .from('customers')
        .insert(payload)
        .select()
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('[tallerService] upsertCustomer error:', error);
    }
    return { data, error };
  } catch (err) {
    console.error('[tallerService] Unexpected upsertCustomer error:', err);
    return { data: null, error: err };
  }
}

// ══════════════════════════════════════════════════════════════
// VEHICLES — create / upsert
// ══════════════════════════════════════════════════════════════

/**
 * Create or update a vehicle record.
 * License plate is normalized to lowercase+trimmed before insert.
 *
 * @param {string}  customerId  UUID of the owner customer.
 * @param {{ license_plate, make, model, year, vin, color }} vehicleData
 * @returns {{ data: object, error: object|null }}
 */
export async function upsertVehicle(customerId, vehicleData) {
  try {
    const payload = {
      customer_id:   customerId,
      license_plate: (vehicleData.license_plate || vehicleData.placa || '').trim().toLowerCase().replace(/\s+/g, ''),
      make:          vehicleData.make || vehicleData.marca || '',
      model:         vehicleData.model || vehicleData.modelo || '',
      year:          parseInt(vehicleData.year || vehicleData.anio, 10) || new Date().getFullYear(),
      vin:           vehicleData.vin ? vehicleData.vin.trim().toUpperCase() : '',
      color:         vehicleData.color || '',
    };

    // Workaround for missing unique constraint on license_plate:
    // 1. Check if vehicle exists
    const { data: existing, error: searchErr } = await supabase
      .from('vehicles')
      .select('id')
      .eq('license_plate', payload.license_plate)
      .maybeSingle();

    if (searchErr) throw searchErr;

    let data, error;
    if (existing?.id) {
      // 2a. Update
      const res = await supabase
        .from('vehicles')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      data = res.data;
      error = res.error;
    } else {
      // 2b. Insert
      const res = await supabase
        .from('vehicles')
        .insert(payload)
        .select()
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('[tallerService] upsertVehicle error:', error);
    }
    return { data, error };
  } catch (err) {
    console.error('[tallerService] Unexpected upsertVehicle error:', err);
    return { data: null, error: err };
  }
}

// ══════════════════════════════════════════════════════════════
// INVOICES — create a full invoice with items + attachments
// ══════════════════════════════════════════════════════════════

/**
 * Insert a complete service record:
 *   1. Insert the invoice header → invoices_services
 *   2. Bulk-insert all line items → invoice_items
 *   3. (Optional) bulk-insert photo attachment rows → invoice_attachments
 *
 * @param {string}   vehicleId    UUID of the vehicle.
 * @param {object}   invoiceData  Header fields.
 * @param {object[]} lineItems    Array of line items.
 * @param {string[]|object[]} [attachmentUrls] Storage URLs or attachment metadata.
 * @returns {{ invoice: object|null, error: object|null }}
 */
export async function createInvoice(vehicleId, invoiceData, lineItems = [], attachmentUrls = []) {
  try {
    const serviceType = (invoiceData.service_type || invoiceData.tipo || '')
      .toLowerCase()
      .includes('estimate')
      ? 'estimate'
      : 'final_invoice';

    // 1. Insert invoice header (financial fields sanitized with toFixed(2))
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices_services')
      .insert({
        vehicle_id:        vehicleId,
        invoice_number:    invoiceData.invoice_number || invoiceData.invoiceNumber,
        date:              invoiceData.date || invoiceData.fecha || new Date().toISOString().split('T')[0],
        service_type:      serviceType,
        payment_method:    invoiceData.payment_method || invoiceData.metodoPago || 'Cash',
        mileage_in:        parseInt(invoiceData.mileage_in ?? invoiceData.kilometrajeEntrada, 10) || 0,
        mileage_out:       parseInt(invoiceData.mileage_out ?? invoiceData.kilometrajeSalida, 10) || 0,
        subtotal:          safeMoney(invoiceData.subtotal),
        tax:               safeMoney(invoiceData.tax ?? invoiceData.impuesto),
        total_amount:      safeMoney(invoiceData.total_amount ?? invoiceData.total),
        deposit_paid:      safeMoney(invoiceData.deposit_paid ?? invoiceData.deposito),
        remaining_balance: safeMoney(invoiceData.remaining_balance ?? invoiceData.saldo),
        remarks:           invoiceData.remarks || invoiceData.observaciones || '',
        technician_name:   invoiceData.technician_name || invoiceData.tecnico || '',
      })
      .select()
      .single();

    if (invoiceErr) {
      console.error('[tallerService] createInvoice header error:', invoiceErr);
      return { invoice: null, error: invoiceErr };
    }

    // 2. Bulk-insert line items
    if (lineItems.length > 0) {
      const rows = lineItems.map((item) => ({
        invoice_id:  invoice.id,
        qty:         parseFloat(item.qty) || 1,
        part_number: item.part_number || item.partNo || '',
        description: item.description || item.descripcion || '',
        unit_price:  parseFloat(item.unit_price ?? item.precioUnit) || 0,
        total:       parseFloat(item.total) || ((parseFloat(item.qty) || 1) * (parseFloat(item.unit_price ?? item.precioUnit) || 0)),
      }));

      const { error: itemsErr } = await supabase.from('invoice_items').insert(rows);
      if (itemsErr) {
        console.error('[tallerService] invoice_items insert error:', itemsErr);
        return { invoice, error: itemsErr };
      }
    }

    // 3. Bulk-insert attachment rows
    if (attachmentUrls.length > 0) {
      const attachRows = attachmentUrls.map((att) => {
        const url = typeof att === 'string' ? att : att.url;
        const fileType = (typeof att === 'object' && (att.file_type || att.categoria || att.mimeType)) || 'invoice';
        return {
          invoice_id: invoice.id,
          file_url:   url,
          file_type:  fileType,
        };
      });

      const { error: attachErr } = await supabase.from('invoice_attachments').insert(attachRows);
      if (attachErr) {
        console.warn('[tallerService] invoice_attachments insert error (non-fatal):', attachErr);
      }
    }

    return { invoice, error: null };
  } catch (err) {
    console.error('[tallerService] Unexpected createInvoice error:', err);
    return { invoice: null, error: err };
  }
}

/**
 * Update an existing invoice header.
 *
 * @param {string} invoiceId  UUID of the invoice row.
 * @param {object} updates    Partial fields to update.
 */
export async function updateInvoice(invoiceId, updates) {
  const { data, error } = await supabase
    .from('invoices_services')
    .update(updates)
    .eq('id', invoiceId)
    .select()
    .single();

  return { data, error };
}

/**
 * Soft-delete an invoice and cascade-delete all its items and attachments.
 *
 * @param {string} invoiceId  UUID of the invoice to delete.
 */
export async function deleteInvoice(invoiceId) {
  const { error } = await supabase
    .from('invoices_services')
    .delete()
    .eq('id', invoiceId);

  return { error };
}

// ══════════════════════════════════════════════════════════════
// STORAGE — invoice photo upload / URL generation
// ══════════════════════════════════════════════════════════════

const BUCKET = 'shop-invoices';

/**
 * Upload a photo File/Blob to the private shop-invoices bucket.
 * Returns the signed URL valid for 1 year (31,536,000 seconds).
 *
 * @param {File}   file       The image file from the camera/file input.
 * @param {string} invoiceId  Used to namespace the path inside the bucket.
 * @param {string} [category] Photo category label, e.g. 'invoice', 'part'.
 * @returns {{ url: string|null, mimeType: string, error: object|null }}
 */
export async function uploadInvoicePhoto(file, invoiceId, category = 'misc') {
  try {
    const ext      = file.name ? file.name.split('.').pop() : 'jpg';
    const uniqueId = Math.random().toString(36).substring(2, 8);
    const path     = `${invoiceId || 'invoices'}/${category}-${Date.now()}-${uniqueId}.${ext}`;
    const mimeType = file.type || 'image/jpeg';

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: mimeType, upsert: false });

    if (uploadErr) {
      console.error('[tallerService] Storage upload error:', uploadErr);
      return { url: null, mimeType, error: uploadErr };
    }

    // Generate a signed URL (private bucket — 1 year TTL)
    const { data: signedData, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (signErr) {
      console.error('[tallerService] Storage createSignedUrl error:', signErr);
      return { url: null, mimeType, error: signErr };
    }

    return { url: signedData.signedUrl, mimeType, path, error: null };
  } catch (err) {
    console.error('[tallerService] Unexpected uploadInvoicePhoto error:', err);
    return { url: null, mimeType: file?.type || 'image/jpeg', error: err };
  }
}

/**
 * Delete a stored photo by its storage path.
 *
 * @param {string} path  The path inside the bucket (e.g. "invoiceId/part-123.jpg").
 */
export async function deleteInvoicePhoto(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return { error };
}

/**
 * Attach a photo directly to an existing invoice:
 * Uploads to Supabase Storage ('shop-invoices') and registers in 'invoice_attachments'.
 *
 * @param {string} invoiceId  UUID of the invoice
 * @param {File}   file       Image file
 * @param {string} [category] Photo category (default: 'invoice')
 * @returns {{ data: object|null, attachment: object|null, error: object|null }}
 */
export async function attachPhotoToInvoice(invoiceId, file, category = 'invoice') {
  try {
    if (!invoiceId) throw new Error('Se requiere el ID de la factura.');
    if (!file) throw new Error('Se requiere el archivo de imagen.');

    // 1. Upload to Storage
    const uploadRes = await uploadInvoicePhoto(file, invoiceId, category);
    if (uploadRes.error || !uploadRes.url) {
      throw uploadRes.error || new Error('No se pudo subir la imagen al almacenamiento.');
    }

    // 2. Insert into invoice_attachments table
    const { data: attData, error: attErr } = await supabase
      .from('invoice_attachments')
      .insert({
        invoice_id: invoiceId,
        file_url:   uploadRes.url,
        file_type:  category,
      })
      .select()
      .single();

    if (attErr) {
      console.error('[tallerService] attachPhotoToInvoice DB error:', attErr);
      return { data: null, attachment: null, error: attErr };
    }

    const formattedAttachment = {
      id: attData.id,
      url: uploadRes.url,
      categoria: category,
      categoriaLabel:
        category === 'odometer'
          ? 'Odómetro / Millas'
          : category === 'part'
          ? 'Pieza / Trabajo'
          : category === 'damage'
          ? 'Daño Previo / Intake'
          : 'Factura / Recibo',
      caption: '',
    };

    return { data: attData, attachment: formattedAttachment, error: null };
  } catch (err) {
    console.error('[tallerService] Unexpected attachPhotoToInvoice error:', err);
    return { data: null, attachment: null, error: err };
  }
}

// ══════════════════════════════════════════════════════════════
// INVOICE NUMBER SEQUENCE
// ══════════════════════════════════════════════════════════════

/**
 * Get the next invoice number by querying the highest existing one.
 * Format: INV-XXXX (zero-padded to 4 digits minimum).
 *
 * @returns {string}  e.g. 'INV-0043'
 */
export async function getNextInvoiceNumber() {
  try {
    const { data, error } = await supabase
      .from('invoices_services')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return 'INV-0001';

    const match = data.invoice_number.match(/(\d+)$/);
    if (!match) return 'INV-0001';

    const next = parseInt(match[1], 10) + 1;
    return `INV-${String(next).padStart(4, '0')}`;
  } catch {
    return 'INV-0001';
  }
}

// ══════════════════════════════════════════════════════════════
// INVOICE PAYMENT PERSISTENCE
// ══════════════════════════════════════════════════════════════

/**
 * Record a payment on an existing invoice in Supabase:
 * Updates deposit_paid, remaining_balance, and optionally payment_method.
 *
 * @param {string} invoiceId  UUID of the invoice in invoices_services
 * @param {{ newDeposit: number, newBalance: number, paymentMethod?: string }} paymentData
 * @returns {{ data: object|null, error: object|null }}
 */
export async function recordInvoicePayment(invoiceId, { newDeposit, newBalance, paymentMethod }) {
  try {
    if (!invoiceId) throw new Error('Se requiere el ID de la factura.');

    // If it's a mock ID (not UUID), return mock success
    if (!isUUID(invoiceId)) {
      return {
        data: {
          id: invoiceId,
          deposit_paid: safeMoney(newDeposit),
          remaining_balance: safeMoney(newBalance),
          payment_method: paymentMethod || 'Cash',
        },
        error: null,
      };
    }

    const payload = {
      deposit_paid: safeMoney(newDeposit),
      remaining_balance: safeMoney(newBalance),
    };
    if (paymentMethod) {
      payload.payment_method = paymentMethod;
    }

    const { data, error } = await supabase
      .from('invoices_services')
      .update(payload)
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) {
      console.error('[tallerService] recordInvoicePayment error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('[tallerService] Unexpected recordInvoicePayment error:', err);
    return { data: null, error: err };
  }
}

// ══════════════════════════════════════════════════════════════
// CUSTOMER PROFILE UPDATE
// ══════════════════════════════════════════════════════════════

/**
 * Update an existing customer's profile and contact details in Supabase.
 *
 * @param {string} customerId  UUID of the customer in customers table
 * @param {{ full_name, phone, email, address, city, state, zip }} customerData
 * @returns {{ data: object|null, error: object|null }}
 */
export async function updateCustomer(customerId, customerData) {
  try {
    if (!customerId) throw new Error('Se requiere el ID del cliente.');

    const payload = {
      full_name: (customerData.full_name || customerData.nombre || '').trim(),
      phone:     (customerData.phone || customerData.telefono || '').trim(),
      email:     (customerData.email || '').trim().toLowerCase(),
      address:   (customerData.address || customerData.direccion || '').trim(),
      city:      (customerData.city || customerData.ciudad || '').trim(),
      state:     (customerData.state || customerData.estado || '').trim().toUpperCase(),
      zip:       (customerData.zip || '').trim(),
    };

    if (!payload.full_name) {
      throw new Error('El nombre completo del cliente es obligatorio.');
    }

    // If mock ID, return mock success
    if (!isUUID(customerId)) {
      return {
        data: { id: customerId, ...payload },
        error: null,
      };
    }

    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      console.error('[tallerService] updateCustomer error:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('[tallerService] Unexpected updateCustomer error:', err);
    return { data: null, error: err };
  }
}

/**
 * Update an existing vehicle by its internal ID.
 */
export async function updateVehicleById(vehicleId, vehicleData) {
  try {
    const payload = {
      license_plate: (vehicleData.license_plate || '').trim().toLowerCase().replace(/\s+/g, ''),
      make:          vehicleData.make || '',
      model:         vehicleData.model || '',
      year:          parseInt(vehicleData.year, 10) || new Date().getFullYear(),
      vin:           vehicleData.vin ? vehicleData.vin.trim().toUpperCase() : '',
      color:         vehicleData.color || '',
    };

    const res = await supabase
      .from('vehicles')
      .update(payload)
      .eq('id', vehicleId)
      .select()
      .single();

    if (res.error) throw res.error;

    return await getVehicleById(vehicleId);
  } catch (err) {
    console.error('[tallerService] updateVehicleById error:', err);
    return { data: null, error: err };
  }
}
