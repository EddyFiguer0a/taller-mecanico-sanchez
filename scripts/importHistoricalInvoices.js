import fs from 'fs';
import path from 'path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

// ── Read environment variables from .env.local ──
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('No se encontró el archivo .env.local en la raíz del proyecto.');
  }

  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...vals] = trimmed.split('=');
    env[key.trim()] = vals.join('=').trim();
  });

  return {
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
  };
}

const safeMoney = (v) => parseFloat(parseFloat(v || 0).toFixed(2)) || 0;

function normalizeInvoiceNumber(raw) {
  const str = String(raw || '').trim();
  if (!str) return `INV-${Date.now()}`;
  if (/^\d+$/.test(str)) {
    return `INV-${str.padStart(4, '0')}`;
  }
  const match = str.match(/^([A-Za-z]+)-?(\d+)$/);
  if (match) {
    return `${match[1].toUpperCase()}-${match[2].padStart(4, '0')}`;
  }
  return str;
}

async function runMigration() {
  const [,, jsonFilePath, email, password] = process.argv;

  const targetFile = jsonFilePath || 'migration_invoices.json';
  const resolvedPath = path.resolve(process.cwd(), targetFile);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`\n❌ Error: No se encontró el archivo JSON en: ${resolvedPath}`);
    console.log(`\nUso: node scripts/importHistoricalInvoices.js [archivo.json] [email_del_taller] [password]\n`);
    process.exit(1);
  }

  const { supabaseUrl, supabaseAnonKey } = loadEnv();
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Authenticate if email/password provided (needed for RLS)
  if (email && password) {
    console.log(`\n🔑 Autenticando con Supabase como: ${email}...`);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
      console.error('❌ Error de autenticación:', authErr.message);
      process.exit(1);
    }
    console.log('✅ Sesión iniciada con éxito.');
  } else {
    console.log('\n⚠️ Nota: Si RLS requiere usuario autenticado, pasa tus credenciales:');
    console.log('   node scripts/importHistoricalInvoices.js migration_invoices.json tu@email.com tuPassword\n');
  }

  const rawData = fs.readFileSync(resolvedPath, 'utf-8');
  let invoicesData;
  try {
    invoicesData = JSON.parse(rawData);
  } catch (err) {
    console.error('❌ El archivo JSON no tiene un formato válido:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(invoicesData)) {
    invoicesData = [invoicesData];
  }

  console.log(`\n📦 Procesando ${invoicesData.length} factura(s)...\n`);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < invoicesData.length; i++) {
    const item = invoicesData[i];
    const indexStr = `[${i + 1}/${invoicesData.length}]`;

    try {
      const custInfo = item.cliente || {};
      const vehInfo  = item.vehiculo || {};
      const invInfo  = item.factura || {};
      const lines    = item.lineas_de_trabajo || item.lineas || [];

      const fullName = (custInfo.nombre || 'Cliente General').trim();
      const plate = (vehInfo.placa || '').toLowerCase().replace(/\s+/g, '').trim();

      if (!plate) {
        throw new Error('La placa del vehículo es obligatoria.');
      }

      console.log(`${indexStr} Procesando: ${fullName} - Placa: ${plate.toUpperCase()} - Factura: ${invInfo.numero_factura || 'S/N'}`);

      // 1. Upsert Customer (Look up existing customer by phone or name)
      let customerId = null;
      const phoneDigits = (custInfo.telefono || '').replace(/\D/g, '');
      if (phoneDigits.length >= 7) {
        const { data: byPhone } = await supabase
          .from('customers')
          .select('id, phone')
          .ilike('phone', `%${phoneDigits.slice(-7)}%`)
          .limit(5);

        if (byPhone?.length) {
          const exact = byPhone.find((c) => (c.phone || '').replace(/\D/g, '') === phoneDigits);
          if (exact) customerId = exact.id;
        }
      }

      if (!customerId && fullName.toLowerCase() !== 'cliente general') {
        const { data: byName } = await supabase
          .from('customers')
          .select('id')
          .ilike('full_name', fullName)
          .maybeSingle();

        if (byName) customerId = byName.id;
      }

      if (!customerId) {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            full_name: fullName,
            phone:     (custInfo.telefono || '').trim(),
            email:     (custInfo.email || '').trim().toLowerCase(),
            address:   (custInfo.direccion || '').trim(),
            city:      (custInfo.ciudad || '').trim(),
            state:     (custInfo.estado || '').trim().toUpperCase(),
            zip:       (custInfo.zip || '').trim(),
          })
          .select()
          .single();

        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      // 2. Upsert Vehicle
      let vehicleId = null;
      const { data: existingVeh } = await supabase
        .from('vehicles')
        .select('id')
        .eq('license_plate', plate)
        .maybeSingle();

      if (existingVeh?.id) {
        vehicleId = existingVeh.id;
      } else {
        const { data: newVeh, error: vehErr } = await supabase
          .from('vehicles')
          .insert({
            customer_id:   customerId,
            license_plate: plate,
            make:          (vehInfo.marca || '').trim(),
            model:         (vehInfo.modelo || '').trim(),
            year:          parseInt(vehInfo.anio, 10) || new Date().getFullYear(),
            vin:           (vehInfo.vin || '').trim().toUpperCase(),
            color:         (vehInfo.color || '').trim(),
          })
          .select()
          .single();

        if (vehErr) throw vehErr;
        vehicleId = newVeh.id;
      }

      // 3. Insert Invoice
      const subtotal = safeMoney(invInfo.subtotal);
      const tax = safeMoney(invInfo.impuesto);
      const total = safeMoney(invInfo.total || (subtotal + tax));
      const deposit = safeMoney(invInfo.deposito_pagado ?? total);
      const saldo = safeMoney(invInfo.saldo_pendiente ?? Math.max(0, total - deposit));

      const { data: newInv, error: invErr } = await supabase
        .from('invoices_services')
        .insert({
          vehicle_id:        vehicleId,
          invoice_number:    normalizeInvoiceNumber(invInfo.numero_factura),
          date:              invInfo.fecha || new Date().toISOString().split('T')[0],
          service_type:      invInfo.tipo === 'estimate' ? 'estimate' : 'final_invoice',
          payment_method:    invInfo.metodo_pago === 'Check' ? 'Check' : 'Cash',
          mileage_in:        parseInt(invInfo.millaje_entrada, 10) || 0,
          mileage_out:       parseInt(invInfo.millaje_salida, 10) || 0,
          subtotal,
          tax,
          total_amount:      total,
          deposit_paid:      deposit,
          remaining_balance: saldo,
          remarks:           (invInfo.observaciones || '').trim(),
          technician_name:   (invInfo.tecnico || 'Gerardo M.').trim(),
        })
        .select()
        .single();

      if (invErr) throw invErr;

      // 4. Insert Line Items
      if (lines.length > 0) {
        const lineRows = lines.map((l) => ({
          invoice_id:  newInv.id,
          qty:         parseFloat(l.qty) || 1,
          part_number: (l.part_number || l.partNo || '').trim(),
          description: (l.descripcion || l.description || 'Servicio').trim(),
          unit_price:  safeMoney(l.precio_unitario || l.precioUnit || 0),
          total:       safeMoney(l.total || ((parseFloat(l.qty) || 1) * safeMoney(l.precio_unitario || 0))),
        }));

        const { error: lineErr } = await supabase.from('invoice_items').insert(lineRows);
        if (lineErr) throw lineErr;
      }

      console.log(`   ✅ Guardada con éxito (ID: ${newInv.id})\n`);
      successCount++;
    } catch (itemErr) {
      console.error(`   ❌ Error guardando factura ${indexStr}:`, itemErr.message || itemErr);
      errorCount++;
    }
  }

  console.log(`\n════════════════════════════════════════════════`);
  console.log(`🎉 Migración finalizada:`);
  console.log(`   - Exitosas: ${successCount}`);
  console.log(`   - Errores:   ${errorCount}`);
  console.log(`════════════════════════════════════════════════\n`);
}

runMigration();
