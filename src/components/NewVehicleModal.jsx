import { useState } from 'react';
import { X, User, Car } from 'lucide-react';
import {
  upsertCustomer,
  upsertVehicle,
  humanizeDbError,
} from '../lib/tallerService';

/** Small reusable labelled input */
function Field({ label, value, onChange, type = 'text', placeholder, required, maxLength, min, max, disabled, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        disabled={disabled}
        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 py-3 text-white text-base
                   placeholder-slate-700 focus:outline-none transition-all disabled:opacity-50"
        style={{ fontSize: '16px', minHeight: '48px' }}
        onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; }}
        onBlur={(e)  => { e.target.style.borderColor = '#2a2a2a'; }}
      />
    </div>
  );
}

/**
 * NewVehicleModal — Register a new customer + vehicle.
 *
 * Props:
 *   placaInicial {string}   — Pre-filled from the search bar
 *   onSave       {fn}       — Called with the new vehicle object (with Supabase IDs)
 *   onClose      {fn}       — Closes the modal
 */
export default function NewVehicleModal({ placaInicial = '', onSave, onClose }) {
  const [form, setForm] = useState({
    // Customer
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    ciudad: '',
    estado: '',
    zip: '',
    // Vehicle
    placa: placaInicial,
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    color: '',
    vin: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const set = (field) => (value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Guard: prevent double-submit
    if (isSubmitting) return;

    // Validate plate is not empty
    const normalizedPlate = form.placa.trim().toLowerCase().replace(/\s+/g, '');
    if (!normalizedPlate) {
      setSubmitError('La placa del vehículo es obligatoria.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Persist customer to Supabase (with dedup)
      const { data: custData, error: custErr } = await upsertCustomer({
        full_name: form.nombre.trim(),
        phone:     form.telefono.trim(),
        email:     form.email.trim(),
        address:   form.direccion.trim(),
        city:      form.ciudad.trim(),
        state:     form.estado.trim().toUpperCase(),
        zip:       form.zip.trim(),
      });

      if (custErr) {
        throw new Error(humanizeDbError(custErr));
      }

      // 2. Persist vehicle linked to customer
      const { data: vehData, error: vehErr } = await upsertVehicle(custData.id, {
        license_plate: normalizedPlate,
        make:          form.marca.trim(),
        model:         form.modelo.trim(),
        year:          parseInt(form.anio) || new Date().getFullYear(),
        vin:           form.vin.trim().toUpperCase(),
        color:         form.color.trim(),
      });

      if (vehErr) {
        throw new Error(humanizeDbError(vehErr));
      }

      // 3. Build the vehicle object for local state
      const nuevoVehiculo = {
        id: vehData.id,
        customer_id: custData.id,
        placa: normalizedPlate,
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        anio: parseInt(form.anio) || new Date().getFullYear(),
        color: form.color.trim(),
        vin: form.vin.trim().toUpperCase(),
        cliente: {
          id:        custData.id,
          nombre:    form.nombre.trim(),
          telefono:  form.telefono.trim(),
          email:     form.email.trim(),
          direccion: form.direccion.trim(),
          ciudad:    form.ciudad.trim(),
          estado:    form.estado.trim().toUpperCase(),
          zip:       form.zip.trim(),
        },
        historial: [],
      };

      onSave(nuevoVehiculo);
    } catch (err) {
      console.error('[NewVehicleModal] Registration failed:', err);
      setSubmitError(err.message || 'Error de conexión con Supabase. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div className="bg-[#111] w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[95vh] overflow-y-auto border border-[#2a2a2a] shadow-2xl">

        {/* ── Sticky Header ── */}
        <div className="sticky top-0 bg-[#111]/95 backdrop-blur border-b border-[#1e1e1e] px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-lg font-black text-white">Register New Vehicle</h2>
            <p className="text-xs text-slate-500 mt-0.5">Create customer profile &amp; vehicle record</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition disabled:opacity-40"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">

          {/* ── CUSTOMER SECTION ── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <User size={16} className="text-sky-400" />
              </div>
              <h3 className="font-bold text-white text-sm tracking-wide uppercase">Customer Information</h3>
            </div>

            <div className="space-y-3">
              <Field label="Full Name *" value={form.nombre} onChange={set('nombre')} placeholder="John Doe" required disabled={isSubmitting} />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" value={form.telefono} onChange={set('telefono')} placeholder="(555) 234-5678" type="tel" disabled={isSubmitting} />
                <Field label="Email" value={form.email} onChange={set('email')} placeholder="john@email.com" type="email" disabled={isSubmitting} />
              </div>

              <Field label="Street Address" value={form.direccion} onChange={set('direccion')} placeholder="4521 Oak Street" disabled={isSubmitting} />

              <div className="grid grid-cols-[1fr_56px_88px] gap-2">
                <Field label="City" value={form.ciudad} onChange={set('ciudad')} placeholder="Houston" disabled={isSubmitting} />
                <Field label="State" value={form.estado} onChange={set('estado')} placeholder="TX" maxLength={2} disabled={isSubmitting} />
                <Field label="ZIP" value={form.zip} onChange={set('zip')} placeholder="77001" maxLength={10} disabled={isSubmitting} />
              </div>
            </div>
          </section>

          {/* ── DIVIDER ── */}
          <div className="border-t border-[#2a2a2a]" />

          {/* ── VEHICLE SECTION ── */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                <Car size={16} className="text-sky-400" />
              </div>
              <h3 className="font-bold text-white text-sm tracking-wide uppercase">Vehicle Information</h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Make *" value={form.marca} onChange={set('marca')} placeholder="Toyota" required disabled={isSubmitting} />
                <Field label="Model *" value={form.modelo} onChange={set('modelo')} placeholder="Camry" required disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-[80px_1fr_1fr] gap-3">
                <Field label="Year" value={form.anio} onChange={set('anio')} type="number" min="1900" max="2030" disabled={isSubmitting} />
                <Field label="Color" value={form.color} onChange={set('color')} placeholder="Silver" disabled={isSubmitting} />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    License Plate *
                  </label>
                  <input
                    value={form.placa}
                    onChange={(e) => set('placa')(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="abc123"
                    required
                    disabled={isSubmitting}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3 py-3 text-white
                               text-base font-mono tracking-widest placeholder-slate-700 focus:outline-none
                               uppercase transition-all disabled:opacity-50"
                    style={{ fontSize: '16px', minHeight: '48px' }}
                    onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; }}
                    onBlur={(e)  => { e.target.style.borderColor = '#2a2a2a'; }}
                  />
                </div>
              </div>

              <Field label="VIN" value={form.vin} onChange={set('vin')} placeholder="4T1BF1FK5KU123456" maxLength={17} disabled={isSubmitting} />
            </div>
          </section>

          {/* ── Error Banner ── */}
          {submitError && (
            <div className="p-4 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-3">
              <span className="text-red-400 flex-shrink-0 mt-0.5 text-lg">⚠️</span>
              <div className="flex-1 text-xs">
                <p className="font-bold text-red-300">Error al registrar:</p>
                <p className="text-red-400 mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          {/* ── ACTIONS ── */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-4 rounded-xl border border-[#2a2a2a] text-slate-400 font-semibold
                         hover:bg-white/5 transition active:scale-95 text-sm
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-4 rounded-xl text-white font-black text-base shadow-lg shadow-blue-950/40
                         border border-blue-400/25 transition active:scale-95 cursor-pointer
                         flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
              style={{ background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)' }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registrando…</span>
                </>
              ) : (
                <span>✓ Register Vehicle</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
