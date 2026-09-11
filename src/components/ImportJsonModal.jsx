import { useState } from 'react';
import { X, FileJson, CheckCircle, AlertCircle, UploadCloud, Loader2 } from 'lucide-react';
import { upsertCustomer, upsertVehicle, createInvoice, safeMoney, humanizeDbError } from '../lib/tallerService';

/**
 * ImportJsonModal — In-app migration tool to bulk import invoices into Supabase
 * using the currently authenticated session (bypasses terminal RLS authentication issues).
 */
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

export default function ImportJsonModal({ isOpen, onClose, onImportComplete }) {
  const [jsonText, setJsonText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleLoadFromFile = async () => {
    try {
      // Try to fetch local migration_invoices.json if served or available
      const res = await fetch('/migration_invoices.json');
      if (res.ok) {
        const text = await res.text();
        setJsonText(text);
        setError(null);
      } else {
        setError('No se pudo cargar automáticamente. Por favor pega el texto JSON en el cuadro de abajo.');
      }
    } catch {
      setError('Por favor pega el JSON directamente en el cuadro de abajo.');
    }
  };

  const handleStartImport = async () => {
    if (isProcessing) return;
    setError(null);
    setLogs([]);

    let data;
    try {
      data = JSON.parse(jsonText.trim());
      if (!Array.isArray(data)) {
        data = [data];
      }
    } catch (err) {
      setError('El texto ingresado no es un JSON válido: ' + err.message);
      return;
    }

    if (data.length === 0) {
      setError('El arreglo JSON está vacío.');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: data.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const invNum = normalizeInvoiceNumber(item.factura?.numero_factura || `S/N #${i + 1}`);
      const custName = (item.cliente?.nombre || 'Cliente General').trim();

      setProgress({ current: i + 1, total: data.length });

      try {
        // 1. Determine vehicle plate
        let plate = (item.vehiculo?.placa || '').toLowerCase().replace(/\s+/g, '').trim();
        if (!plate) {
          // Extract unit number if present in model/make (e.g., #9, #4, #6)
          const modelStr = `${item.vehiculo?.marca || ''} ${item.vehiculo?.modelo || ''}`;
          const matchUnit = modelStr.match(/#\s*(\w+)/);
          if (matchUnit) {
            plate = `unit-${matchUnit[1].toLowerCase()}`;
          } else {
            plate = `unit-${(item.vehiculo?.modelo || 'auto').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}-${invNum}`;
          }
        }

        // 2. Upsert Customer
        const { data: custData, error: custErr } = await upsertCustomer({
          full_name: custName,
          phone:     (item.cliente?.telefono || '').trim(),
          email:     (item.cliente?.email || '').trim().toLowerCase(),
          address:   (item.cliente?.direccion || '').trim(),
          city:      (item.cliente?.ciudad || '').trim(),
          state:     (item.cliente?.estado || '').trim().toUpperCase(),
          zip:       (item.cliente?.zip || '').trim(),
        });

        if (custErr) throw new Error(humanizeDbError(custErr));

        // 3. Upsert Vehicle
        const { data: vehData, error: vehErr } = await upsertVehicle(custData.id, {
          license_plate: plate,
          make:          (item.vehiculo?.marca || '').trim(),
          model:         (item.vehiculo?.modelo || '').trim(),
          year:          parseInt(item.vehiculo?.anio, 10) || new Date().getFullYear(),
          vin:           (item.vehiculo?.vin || '').trim().toUpperCase(),
          color:         (item.vehiculo?.color || '').trim(),
        });

        if (vehErr) throw new Error(humanizeDbError(vehErr));

        // 4. Create Invoice
        const inv = item.factura || {};
        const subtotal = safeMoney(inv.subtotal);
        const tax = safeMoney(inv.impuesto);
        const total = safeMoney(inv.total || (subtotal + tax));
        const deposit = safeMoney(inv.deposito_pagado ?? total);
        const saldo = safeMoney(inv.saldo_pendiente ?? Math.max(0, total - deposit));

        const invoicePayload = {
          invoice_number:    normalizeInvoiceNumber(inv.numero_factura),
          date:              inv.fecha || new Date().toISOString().split('T')[0],
          service_type:      inv.tipo === 'estimate' ? 'estimate' : 'final_invoice',
          payment_method:    inv.metodo_pago === 'Check' ? 'Check' : 'Cash',
          mileage_in:        parseInt(inv.millaje_entrada, 10) || 0,
          mileage_out:       parseInt(inv.millaje_salida, 10) || 0,
          subtotal,
          tax,
          total_amount:      total,
          deposit_paid:      deposit,
          remaining_balance: saldo,
          remarks:           (inv.observaciones || '').trim(),
          technician_name:   (inv.tecnico || 'Gerardo M.').trim(),
        };

        const rawLines = item.lineas_de_trabajo || item.lineas || [];
        const validLines = rawLines.map((l) => ({
          qty:         parseFloat(l.qty) || 1,
          part_number: (l.part_number || l.partNo || '').trim(),
          description: (l.descripcion || l.description || 'Servicio Mecánico').trim(),
          unit_price:  safeMoney(l.precio_unitario || l.precioUnit || 0),
          total:       safeMoney(l.total || ((parseFloat(l.qty) || 1) * safeMoney(l.precio_unitario || 0))),
        }));

        const { error: invErr } = await createInvoice(vehData.id, invoicePayload, validLines, []);
        if (invErr) throw new Error(humanizeDbError(invErr));

        setLogs((prev) => [
          ...prev,
          { success: true, text: `✓ Factura ${invNum} (${custName} - Placa: ${plate.toUpperCase()}) guardada.` },
        ]);
        successCount++;
      } catch (err) {
        console.error(`Error importando factura ${invNum}:`, err);
        setLogs((prev) => [
          ...prev,
          { success: false, text: `✗ Error en factura ${invNum}: ${err.message}` },
        ]);
        errorCount++;
      }
    }

    setIsProcessing(false);

    if (onImportComplete) {
      onImportComplete(successCount, errorCount);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !isProcessing && onClose()}
    >
      <div className="bg-[#111] w-full max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto border border-[#2a2a2a] shadow-2xl flex flex-col">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-[#1e1e1e] flex items-center justify-between sticky top-0 bg-[#111]/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileJson size={22} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Importar Facturas (JSON)</h2>
              <p className="text-xs text-slate-400 mt-0.5">Sube tus facturas escaneadas por Gemini directo a Supabase</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-5 flex-1">

          {/* Quick instructions / Help */}
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4 text-xs text-slate-400 space-y-1.5">
            <p className="font-bold text-slate-200 flex items-center gap-1.5">
              <UploadCloud size={14} className="text-sky-400" />
              Migración Segura con tu Sesión Activa
            </p>
            <p>
              Pega aquí el código JSON devuelto por Google Gemini. El sistema creará los clientes sin duplicar, registrará los vehículos, vinculará los trabajos y guardará todo permanentemente en Supabase.
            </p>
          </div>

          {/* Load Sample / Paste Controls */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Contenido JSON *
            </label>
            <button
              type="button"
              onClick={handleLoadFromFile}
              disabled={isProcessing}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold underline cursor-pointer"
            >
              Cargar archivo local (5 facturas)
            </button>
          </div>

          {/* JSON Textarea */}
          <textarea
            rows={10}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            disabled={isProcessing}
            placeholder="Pega aquí el JSON [ { ... }, { ... } ]"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-3.5 text-slate-200 font-mono text-xs
                       focus:outline-none focus:border-sky-400 transition placeholder-slate-700 disabled:opacity-50 resize-y"
          />

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-sky-400">
                <span>Subiendo a Supabase...</span>
                <span>{progress.current} de {progress.total}</span>
              </div>
              <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-300 rounded-full"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Live Logs */}
          {logs.length > 0 && (
            <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono">
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${log.success ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3.5 rounded-xl border border-[#2a2a2a] text-slate-400 font-semibold hover:bg-white/5
                         transition active:scale-95 text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleStartImport}
              disabled={isProcessing || !jsonText.trim()}
              className="flex-[2] py-3.5 rounded-xl text-white font-black text-sm shadow-lg shadow-sky-950/50
                         border border-sky-400/30 transition active:scale-95 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              style={{
                background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 55%, #075985 100%)',
                minHeight: '48px',
              }}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Procesando Facturas…</span>
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  <span>🚀 Iniciar Importación a Supabase</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
