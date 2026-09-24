import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Camera, AlertCircle, Sparkles, Image, Edit3 } from 'lucide-react';
import { CANNED_SERVICES } from '../data/mockData';
import {
  createInvoice,
  updateCompleteInvoice,
  getVehicleByPlate,
  uploadInvoicePhoto,
  isUUID,
  upsertCustomer,
  upsertVehicle,
  humanizeDbError,
} from '../lib/tallerService';

const PAYMENT_METHODS = [
  { key: 'Cash', label: 'Cash', icon: '💵' },
  { key: 'Check', label: 'Check', icon: '📄' },
];

const PHOTO_CATEGORIES = [
  { key: 'invoice', label: 'Factura / Recibo', icon: '📄' },
  { key: 'odometer', label: 'Odómetro / Millas', icon: '⏱️' },
  { key: 'damage', label: 'Daño Previo / Intake', icon: '⚠️' },
  { key: 'part', label: 'Pieza / Trabajo', icon: '🔧' },
];

const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

/**
 * NewServiceModal — full service / invoice entry & edit modal.
 *
 * Props:
 *   vehicle            {object} — The current vehicle + customer object
 *   nextInvoiceNumber  {string} — Pre-generated invoice number (INV-XXXX)
 *   serviceToEdit      {object} — [Optional] Existing service to edit
 *   onSave             {fn}     — Called with the completed service object
 *   onClose            {fn}     — Closes the modal
 */
export default function NewServiceModal({ vehicle, nextInvoiceNumber, serviceToEdit, onSave, onClose }) {
  const isEditMode = Boolean(serviceToEdit);
  const activeInvoiceNumber = isEditMode ? serviceToEdit.invoiceNumber : nextInvoiceNumber;

  const [tipo, setTipo] = useState(() => (serviceToEdit?.tipo === 'Estimate' ? 'Estimate' : 'Final Invoice'));

  const [form, setForm] = useState(() => ({
    fecha: serviceToEdit?.fecha || new Date().toISOString().split('T')[0],
    kilometrajeEntrada: serviceToEdit?.kilometrajeEntrada != null && serviceToEdit.kilometrajeEntrada !== 0 ? serviceToEdit.kilometrajeEntrada : '',
    kilometrajeSalida: serviceToEdit?.kilometrajeSalida != null && serviceToEdit.kilometrajeSalida !== 0 ? serviceToEdit.kilometrajeSalida : '',
    metodoPago: serviceToEdit?.metodoPago || 'Cash',
    impuesto: serviceToEdit?.impuesto != null && serviceToEdit.impuesto !== 0 ? serviceToEdit.impuesto : '',
    deposito: serviceToEdit?.deposito != null && serviceToEdit.deposito !== 0 ? serviceToEdit.deposito : '',
    observaciones: serviceToEdit?.observaciones || '',
    tecnico: serviceToEdit?.tecnico || 'Gerardo M.',
  }));

  const [lineas, setLineas] = useState(() => {
    if (serviceToEdit?.lineas && serviceToEdit.lineas.length > 0) {
      return serviceToEdit.lineas.map((l, idx) => ({
        id: l.id || Date.now() + idx,
        qty: l.qty !== '' ? l.qty : 1,
        partNo: l.partNo || l.part_number || '',
        descripcion: l.descripcion || l.description || '',
        precioUnit: l.precioUnit ?? l.unit_price ?? '',
      }));
    }
    return [{ id: 1, qty: '', partNo: '', descripcion: '', precioUnit: '' }];
  });

  // Multi-photo state: array of { id, url, file, categoria, categoriaLabel, caption }
  const [fotos, setFotos] = useState(() => {
    if (serviceToEdit?.fotos && serviceToEdit.fotos.length > 0) {
      return serviceToEdit.fotos;
    }
    if (serviceToEdit?.facturaImg) {
      return [{ id: 'primary', url: serviceToEdit.facturaImg, categoria: 'invoice', categoriaLabel: 'Factura / Recibo', caption: '' }];
    }
    return [];
  });
  const [selectedPhotoCategory, setSelectedPhotoCategory] = useState('invoice');

  // Supabase loading & error states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const set = (field) => (value) => setForm((p) => ({ ...p, [field]: value }));

  // ── Canned job quick insertion ──────────────────────────────
  const handleApplyPreset = (presetId) => {
    if (!presetId) return;
    const preset = CANNED_SERVICES.find((p) => p.id === presetId);
    if (!preset) return;

    const newRows = preset.items.map((item, idx) => ({
      id: Date.now() + idx,
      qty: item.qty,
      partNo: item.partNo,
      descripcion: item.descripcion,
      precioUnit: item.precioUnit,
    }));

    setLineas((prev) => {
      const isOnlyOneEmpty = prev.length === 1 && !prev[0].descripcion && !prev[0].precioUnit;
      if (isOnlyOneEmpty) return newRows;

      // Dedup: skip rows whose description already exists (case-insensitive)
      const dedupedRows = newRows.filter(
        (nr) =>
          !prev.some(
            (ex) => ex.descripcion.trim().toLowerCase() === nr.descripcion.trim().toLowerCase()
          )
      );
      return dedupedRows.length > 0 ? [...prev, ...dedupedRows] : prev;
    });

    if (preset.defaultObservaciones) {
      setForm((prev) => ({
        ...prev,
        observaciones: prev.observaciones
          ? `${prev.observaciones}\n${preset.defaultObservaciones}`
          : preset.defaultObservaciones,
      }));
    }
  };

  // ── Line item helpers ──────────────────────────────────────
  const addLinea = () =>
    setLineas((p) => [...p, { id: Date.now(), qty: '', partNo: '', descripcion: '', precioUnit: '' }]);

  const removeLinea = (id) =>
    setLineas((p) => p.filter((l) => l.id !== id));

  const updateLinea = (id, field, value) => {
    let sanitized = value;
    if (field === 'qty' || field === 'precioUnit') {
      if (value !== '' && parseFloat(value) < 0) {
        sanitized = '0';
      }
    }
    setLineas((p) => p.map((l) => (l.id === id ? { ...l, [field]: sanitized } : l)));
  };

  // ── Financial engine ───────────────────────────────────────
  const subtotal = useMemo(
    () => lineas.reduce((sum, l) => sum + Math.max(0, parseFloat(l.qty) || 0) * Math.max(0, parseFloat(l.precioUnit) || 0), 0),
    [lineas]
  );
  const impuesto = Math.max(0, parseFloat(form.impuesto) || 0);
  const total = subtotal + impuesto;
  const deposito = Math.max(0, parseFloat(form.deposito) || 0);
  const saldo = Math.max(0, total - deposito);

  // ── Camera / Multi-Photo Studio ────────────────────────────
  const handleFotosUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const catObj = PHOTO_CATEGORIES.find((c) => c.key === selectedPhotoCategory) || PHOTO_CATEGORIES[0];

    const newPhotos = files.map((file, idx) => ({
      id: `photo-${Date.now()}-${idx}`,
      url: URL.createObjectURL(file),
      file,
      categoria: catObj.key,
      categoriaLabel: catObj.label,
      caption: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    setFotos((prev) => [...prev, ...newPhotos]);
    e.target.value = ''; // reset file input
  };

  const removeFoto = (id) => {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFotoCaption = (id, text) => {
    setFotos((prev) => prev.map((f) => (f.id === id ? { ...f, caption: text } : f)));
  };

  // ── Async Submit to Supabase ──────────────────────────────
  const handleGuardarMantenimiento = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const validLineas = lineas
      .filter((l) => l.descripcion && l.descripcion.trim())
      .map((l) => ({
        qty: parseFloat(l.qty) || 1,
        partNo: l.partNo.trim(),
        descripcion: l.descripcion.trim(),
        precioUnit: parseFloat(l.precioUnit) || 0,
        total: (parseFloat(l.qty) || 1) * (parseFloat(l.precioUnit) || 0),
      }));

    if (validLineas.length === 0) {
      setSaveError('Por favor agrega al menos un trabajo o pieza con descripción.');
      setIsSaving(false);
      return;
    }

    try {
      // 1. Ensure target vehicle exists in Supabase with a valid UUID
      let targetVehicleId = vehicle?.id;

      if (!isUUID(targetVehicleId)) {
        // Attempt lookup by plate first
        const lookup = await getVehicleByPlate(vehicle.placa);
        if (lookup.data?.id) {
          targetVehicleId = lookup.data.id;
        } else {
          // Provision customer in Supabase
          const { data: custData, error: custErr } = await upsertCustomer({
            full_name: vehicle.cliente?.nombre || 'Cliente General',
            phone: vehicle.cliente?.telefono || '',
            email: vehicle.cliente?.email || '',
            address: vehicle.cliente?.direccion || '',
            city: vehicle.cliente?.ciudad || '',
            state: vehicle.cliente?.estado || '',
            zip: vehicle.cliente?.zip || '',
          });

          if (custErr) throw new Error(humanizeDbError(custErr));

          // Provision vehicle in Supabase
          const { data: vehData, error: vehErr } = await upsertVehicle(custData.id, {
            license_plate: vehicle.placa,
            make: vehicle.marca,
            model: vehicle.modelo,
            year: vehicle.anio,
            vin: vehicle.vin,
            color: vehicle.color,
          });

          if (vehErr) throw new Error(humanizeDbError(vehErr));
          targetVehicleId = vehData.id;
        }
      }

      // 2. Upload camera photo attachments to Supabase Storage ('shop-invoices' bucket)
      const uploadedAttachments = [];
      const failedUploadCount = { count: 0 };
      if (fotos.length > 0) {
        for (const foto of fotos) {
          if (foto.file) {
            try {
              const uploadRes = await uploadInvoicePhoto(
                foto.file,
                targetVehicleId,
                foto.categoria || 'invoice'
              );

              if (uploadRes?.url) {
                uploadedAttachments.push({
                  url: uploadRes.url,
                  file_type: foto.categoria || 'invoice',
                });
              } else if (uploadRes?.error) {
                failedUploadCount.count++;
                console.warn('[NewServiceModal] Photo upload failed (continuing):', uploadRes.error);
              }
            } catch (uploadCatchErr) {
              failedUploadCount.count++;
              console.warn('[NewServiceModal] Photo upload exception (continuing):', uploadCatchErr);
            }
          } else if (foto.url && !foto.url.startsWith('blob:')) {
            uploadedAttachments.push({
              url: foto.url,
              file_type: foto.categoria || 'invoice',
            });
          }
        }
      }

      // 3. Prepare payload for createInvoice or updateCompleteInvoice
      const invoicePayload = {
        invoice_number: activeInvoiceNumber,
        date: form.fecha,
        service_type: tipo === 'Estimate' ? 'estimate' : 'final_invoice',
        payment_method: form.metodoPago,
        mileage_in: parseInt(form.kilometrajeEntrada, 10) || 0,
        mileage_out: parseInt(form.kilometrajeSalida, 10) || 0,
        subtotal,
        tax: impuesto,
        total_amount: total,
        deposit_paid: deposito,
        remaining_balance: saldo,
        remarks: form.observaciones.trim(),
        technician_name: form.tecnico.trim(),
      };

      // 4. Insert or update invoice header + line items + attachments via service layer
      let invoiceRes;
      if (isEditMode) {
        invoiceRes = await updateCompleteInvoice(
          serviceToEdit.id,
          invoicePayload,
          validLineas,
          uploadedAttachments
        );
      } else {
        invoiceRes = await createInvoice(
          targetVehicleId,
          invoicePayload,
          validLineas,
          uploadedAttachments
        );
      }

      const { invoice, error: invoiceErr } = invoiceRes;

      if (invoiceErr) {
        throw new Error(humanizeDbError(invoiceErr));
      }

      // 5. Re-fetch the updated vehicle record from Supabase to refresh chronological history
      const { data: refreshedVehicle, error: fetchErr } = await getVehicleByPlate(vehicle.placa);
      if (fetchErr) {
        console.warn('[NewServiceModal] Warning re-fetching vehicle:', fetchErr);
      }

      // 6. Notify parent component with refreshed data & close modal
      if (onSave) {
        onSave(refreshedVehicle || invoice);
      }

      // Show warning if some photos failed to upload
      if (failedUploadCount.count > 0) {
        // Brief delay so the modal closes, then alert
        setTimeout(() => {
          alert(`⚠️ La factura se guardó correctamente, pero ${failedUploadCount.count} foto(s) no se pudieron subir. Verifica tu conexión y re-intenta adjuntarlas.`);
        }, 300);
      }

      onClose();
    } catch (err) {
      console.error('[NewServiceModal] Failed to save service/invoice:', err);
      setSaveError(err.message || 'Error de conexión con Supabase. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && !isSaving && onClose()}
    >
      <div className="bg-[#111] w-full max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[95dvh] overflow-y-auto border border-[#2a2a2a] shadow-2xl">

        {/* ── Sticky Header ── */}
        <div className="sticky top-0 bg-[#111]/95 backdrop-blur border-b border-[#2a2a2a] px-5 py-4 flex justify-between items-center z-10">
          <div>
            <div className="flex items-center gap-2">
              {isEditMode && <Edit3 size={18} className="text-sky-400" />}
              <h2 className="text-lg font-black text-white">
                {isEditMode
                  ? `Editar ${tipo === 'Estimate' ? 'Cotización' : 'Factura'}`
                  : 'New Service / Invoice'}
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {activeInvoiceNumber} &bull; {vehicle.marca} {vehicle.modelo}&nbsp;
              <span className="font-mono uppercase text-slate-600">{vehicle.placa}</span>
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleGuardarMantenimiento} className="p-5 space-y-6">

          {/* ── 1. Service Type Toggle ── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Service Type</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'Estimate', label: ' Estimate / Cotización' },
                { key: 'Final Invoice', label: ' Final Invoice' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTipo(key)}
                  className={`py-3.5 rounded-xl font-bold text-sm transition active:scale-95 border-2 ${tipo === key
                      ? 'border-sky-400 text-white shadow-lg shadow-sky-950/40'
                      : 'border-[#2a2a2a] bg-[#0a0a0a] text-slate-400 hover:border-sky-500/30 hover:text-white'
                    }`}
                  style={tipo === key ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' } : {}}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── 2. Date + Mileage ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
              <input type="date" value={form.fecha} onChange={(e) => set('fecha')(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 min-h-[48px] text-white text-base
                           focus:outline-none focus:border-sky-400 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Mileage In</label>
              <input type="number" placeholder="e.g. 52400" value={form.kilometrajeEntrada}
                onChange={(e) => set('kilometrajeEntrada')(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 min-h-[48px] text-white text-base
                           placeholder-slate-700 focus:outline-none focus:border-sky-400 transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Mileage Out</label>
              <input type="number" placeholder="e.g. 52410" value={form.kilometrajeSalida}
                onChange={(e) => set('kilometrajeSalida')(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 min-h-[48px] text-white text-base
                           placeholder-slate-700 focus:outline-none focus:border-sky-400 transition" />
            </div>
          </div>

          {/* ── Payment Method — Image 2 radio cards ── */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Payment Method</p>
            <div className="space-y-2">
              {PAYMENT_METHODS.map(({ key, label, icon }) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${form.metodoPago === key
                      ? 'border-sky-500/50 bg-sky-500/10'
                      : 'border-[#1e1e1e] bg-[#0a0a0a] hover:border-[#2a2a2a]'
                    }`}
                >
                  <input type="radio" name="metodoPago" value={key}
                    checked={form.metodoPago === key}
                    onChange={() => set('metodoPago')(key)}
                    className="sr-only" />
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <span className={`font-semibold text-sm flex-1 ${form.metodoPago === key ? 'text-sky-400' : 'text-slate-400'
                    }`}>
                    {label}
                  </span>
                  {/* Radio indicator */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.metodoPago === key ? 'border-sky-400' : 'border-slate-600'
                    }`}>
                    {form.metodoPago === key && (
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── 3. Dynamic Line Items + Quick Presets ── */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Work Items</p>

              {/* Quick Canned Jobs selector */}
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-sky-400" />
                <select
                  onChange={(e) => {
                    handleApplyPreset(e.target.value);
                    e.target.value = '';
                  }}
                  defaultValue=""
                  className="bg-[#0a0a0a] border border-[#2a2a2a] text-sky-400 font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-400 transition cursor-pointer"
                  style={{ fontSize: '16px' }}
                >
                  <option value="" disabled>⚡ Quick Presets / Trabajos Rápidos</option>
                  {CANNED_SERVICES.map((preset) => (
                    <option key={preset.id} value={preset.id} className="bg-[#111] text-white">
                      + {preset.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-[#2a2a2a] overflow-hidden">
              {/* Desktop table header — hidden on mobile */}
              <div className="bg-[#0a0a0a] px-3 py-2 hidden sm:grid sm:grid-cols-[48px_88px_1fr_90px_72px_32px] gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <span>Qty</span>
                <span>Part No.</span>
                <span>Description</span>
                <span className="text-right">Unit $</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {lineas.map((linea, idx) => {
                const lineTotal = (parseFloat(linea.qty) || 0) * (parseFloat(linea.precioUnit) || 0);
                return (
                  <div
                    key={linea.id}
                    className="border-t border-[#1e1e1e]"
                  >
                    {/* ── MOBILE stacked layout (< sm) ── */}
                    <div className="sm:hidden px-3 pt-3 pb-2 space-y-2">
                      {/* Row 1: Qty + Part No */}
                      <div className="flex gap-2">
                        <div className="w-20 flex-shrink-0">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Qty</label>
                          <input
                            type="number" min="0.01" step="any" placeholder="1" value={linea.qty}
                            onChange={(e) => updateLinea(linea.id, 'qty', e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 text-white text-center focus:outline-none focus:border-sky-400 transition"
                            style={{ fontSize: '16px', minHeight: '44px' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Part No.</label>
                          <input
                            type="text" placeholder="Part #" value={linea.partNo}
                            onChange={(e) => updateLinea(linea.id, 'partNo', e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 text-white font-mono focus:outline-none focus:border-sky-400 transition"
                            style={{ fontSize: '16px', minHeight: '44px' }}
                          />
                        </div>
                      </div>
                      {/* Row 2: Description (full width) */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Description *</label>
                        <input
                          type="text" placeholder="Description of work or part…" value={linea.descripcion}
                          onChange={(e) => updateLinea(linea.id, 'descripcion', e.target.value)}
                          required={idx === 0}
                          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 text-white focus:outline-none focus:border-sky-400 transition"
                          style={{ fontSize: '16px', minHeight: '48px' }}
                        />
                      </div>
                      {/* Row 3: Unit Price + Total + Delete */}
                      <div className="flex items-center gap-2 pb-1">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Unit Price</label>
                          <input
                            type="number" min="0" step="0.01" placeholder="0.00" value={linea.precioUnit}
                            onChange={(e) => updateLinea(linea.id, 'precioUnit', e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 text-white text-right focus:outline-none focus:border-sky-400 transition"
                            style={{ fontSize: '16px', minHeight: '44px' }}
                          />
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Total</label>
                          <span className="block text-base font-black tabular-nums text-sky-400 leading-none pt-2.5">
                            {fmt(lineTotal)}
                          </span>
                        </div>
                        <div className="flex-shrink-0 self-end pb-1">
                          <button
                            type="button"
                            onClick={() => lineas.length > 1 && removeLinea(linea.id)}
                            disabled={lineas.length === 1}
                            className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition border border-transparent hover:border-red-500/20"
                            aria-label="Eliminar fila"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── DESKTOP flat table row (sm+) ── */}
                    <div className="hidden sm:grid sm:grid-cols-[48px_88px_1fr_90px_72px_32px] gap-2 px-3 py-2.5 items-center">
                      <input type="number" min="0.01" step="any" placeholder="1" value={linea.qty}
                        onChange={(e) => updateLinea(linea.id, 'qty', e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-sky-400 transition"
                        style={{ fontSize: '16px' }}
                      />
                      <input type="text" placeholder="Part #" value={linea.partNo}
                        onChange={(e) => updateLinea(linea.id, 'partNo', e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-white text-sm font-mono focus:outline-none focus:border-sky-400 transition"
                        style={{ fontSize: '16px' }}
                      />
                      <input type="text" placeholder="Description..." value={linea.descripcion}
                        onChange={(e) => updateLinea(linea.id, 'descripcion', e.target.value)}
                        required={idx === 0}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-sky-400 transition"
                        style={{ fontSize: '16px' }}
                      />
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={linea.precioUnit}
                        onChange={(e) => updateLinea(linea.id, 'precioUnit', e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-white text-sm text-right focus:outline-none focus:border-sky-400 transition"
                        style={{ fontSize: '16px' }}
                      />
                      <span className="text-right text-sm font-bold tabular-nums text-sky-400">
                        {fmt(lineTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => lineas.length > 1 && removeLinea(linea.id)}
                        disabled={lineas.length === 1}
                        className="flex items-center justify-center text-slate-600 hover:text-red-400 disabled:opacity-30 transition p-1 rounded-lg hover:bg-slate-800"
                        aria-label="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addLinea}
              className="mt-2 w-full py-3 rounded-xl border border-dashed border-[#2a2a2a] text-slate-400
                         hover:text-sky-400 hover:border-sky-500/30 text-sm flex
                         items-center justify-center gap-2 transition active:scale-95"
            >
              <Plus size={16} /> Add Line Item
            </button>
          </div>

          {/* ── 4. Financial Summary ── */}
          <div className="bg-[#0a0a0a] rounded-xl border border-[#2a2a2a] p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-white font-semibold tabular-nums">{fmt(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Tax</span>
              <input
                type="number" min="0" step="0.01" placeholder="0.00" value={form.impuesto}
                onChange={(e) => set('impuesto')(e.target.value)}
                className="w-28 bg-[#111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-white text-right
                           focus:outline-none focus:border-sky-400 tabular-nums transition"
                style={{ fontSize: '16px', minHeight: '40px' }}
              />
            </div>

            <div className="flex justify-between items-center border-t border-[#1e1e1e] pt-3">
              <span className="text-white font-black text-base">TOTAL</span>
              <span className="font-black text-2xl tabular-nums text-sky-400">{fmt(total)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Deposit Paid (50%)</span>
              <input
                type="number" min="0" step="0.01" placeholder="0.00" value={form.deposito}
                onChange={(e) => set('deposito')(e.target.value)}
                className="w-28 bg-[#111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-white text-right
                           focus:outline-none focus:border-sky-400 tabular-nums transition"
                style={{ fontSize: '16px', minHeight: '40px' }}
              />
            </div>

            <div className="flex justify-between items-center border-t border-[#1e1e1e] pt-3">
              <span className={`font-bold text-sm ${saldo > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                REMAINING BALANCE
              </span>
              <span className={`font-black text-xl tabular-nums ${saldo > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {fmt(saldo)}
              </span>
            </div>
          </div>

          {/* ── 5. Remarks Box ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                <AlertCircle size={14} />
                Recommendations, Warranty &amp; Diagnostic Notes
              </label>
            </div>

            <textarea
              rows={4}
              placeholder="e.g. 1 Year Warranty on Transmission. Recommend coolant flush at next service..."
              value={form.observaciones}
              onChange={(e) => set('observaciones')(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-sky-500/25 rounded-xl px-4 py-3 text-white
                         placeholder-slate-700 resize-none transition focus:border-sky-400 focus:outline-none"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* ── 6. Technician ── */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Technician Name</label>
            <input
              type="text" placeholder="e.g. Gerardo M." value={form.tecnico}
              onChange={(e) => set('tecnico')(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 min-h-[48px] text-white text-base focus:outline-none focus:border-sky-400 transition"
            />
          </div>

          {/* ── 7. Multi-Photo Attachment Studio ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Image size={14} className="text-sky-400" /> Photo Attachments Studio ({fotos.length})
                </p>
                <p className="text-[11px] text-slate-600">Fotos de factura, odómetro, daños previos e instalación</p>
              </div>
            </div>

            {/* Category selection pills before snapping photo */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[11px] text-slate-500 flex-shrink-0">Categoría:</span>
              {PHOTO_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedPhotoCategory(cat.key)}
                  className={`text-xs px-3 min-h-[48px] rounded-xl font-semibold transition flex-shrink-0 flex items-center gap-1.5 ${selectedPhotoCategory === cat.key
                      ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-950/40'
                      : 'bg-[#1a1a1a] text-slate-400 hover:text-white border border-[#2a2a2a]'
                    }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Upload / Camera Trigger Area */}
            <label className="cursor-pointer block group">
              <div className="bg-[#0a0a0a] border-2 border-dashed border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center justify-center gap-3 group-hover:border-sky-500/50 transition">
                <Camera size={22} className="text-sky-400 group-hover:scale-110 transition flex-shrink-0" />
                <div className="text-center sm:text-left">
                  <p className="text-sm text-slate-200 font-bold group-hover:text-sky-400 transition">
                    + Tomar Foto o Subir Archivo
                  </p>
                  <p className="text-xs text-slate-500">
                    Se guardará como: <span className="text-sky-300 font-semibold">{PHOTO_CATEGORIES.find(c => c.key === selectedPhotoCategory)?.label}</span>
                  </p>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleFotosUpload}
                className="hidden"
              />
            </label>

            {/* Photos Preview Grid */}
            {fotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {fotos.map((f) => (
                  <div
                    key={f.id}
                    className="relative bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden shadow-md flex flex-col group"
                  >
                    <div className="relative h-28 w-full bg-black/40">
                      <img
                        src={f.url}
                        alt="Service attachment"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur text-[10px] text-white px-2 py-0.5 rounded-md font-semibold border border-white/10">
                        {f.categoriaLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFoto(f.id)}
                        className="absolute top-1.5 right-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-full p-1 shadow transition"
                        title="Eliminar foto"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="p-2">
                      <input
                        type="text"
                        placeholder="Nota o descripción..."
                        value={f.caption}
                        onChange={(e) => updateFotoCaption(f.id, e.target.value)}
                        className="w-full bg-[#161616] border border-[#262626] rounded px-2 py-1 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-400"
                        style={{ fontSize: '16px', minHeight: '36px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Error Banner ── */}
          {saveError && (
            <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-red-300">No se pudo guardar la factura:</p>
                <p className="text-red-400 mt-0.5">{saveError}</p>
              </div>
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 min-h-[48px] rounded-xl border border-[#2a2a2a] text-slate-400 font-semibold hover:bg-white/5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-[2] min-h-[52px] rounded-xl text-white font-black text-base transition active:scale-95 shadow-lg shadow-blue-950/40 border border-blue-400/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer"
              style={{ background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)' }}
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isEditMode ? 'Actualizando en Supabase…' : 'Guardando en Supabase…'}</span>
                </>
              ) : (
                <span>{isEditMode ? 'Guardar Cambios' : 'Save Invoice'}</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
