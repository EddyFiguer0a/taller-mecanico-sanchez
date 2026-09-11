import { useState } from 'react';
import { X, User, Check, AlertCircle } from 'lucide-react';
import { updateCustomer, humanizeDbError } from '../lib/tallerService';

/** Reusable labelled input for the customer edit form */
function Field({ label, value, onChange, type = 'text', placeholder, required, maxLength, disabled, className = '' }) {
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
        disabled={disabled}
        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-3.5 py-3 text-white text-base
                   placeholder-slate-700 focus:outline-none transition-all disabled:opacity-50"
        style={{ fontSize: '16px', minHeight: '48px' }}
        onFocus={(e) => { e.target.style.borderColor = '#38bdf8'; }}
        onBlur={(e)  => { e.target.style.borderColor = '#2a2a2a'; }}
      />
    </div>
  );
}

/**
 * EditCustomerModal — Edit customer profile and persist changes to Supabase.
 *
 * Props:
 *   customer {object} — Existing customer object ({ id, nombre, telefono, email, direccion, ciudad, estado, zip })
 *   onSave   {fn}     — Called with updated customer data on success
 *   onClose  {fn}     — Closes the modal
 */
export default function EditCustomerModal({ customer, onSave, onClose }) {
  const [form, setForm] = useState({
    nombre:    customer?.nombre || customer?.full_name || '',
    telefono:  customer?.telefono || customer?.phone || '',
    email:     customer?.email || '',
    direccion: customer?.direccion || customer?.address || '',
    ciudad:    customer?.ciudad || customer?.city || '',
    estado:    customer?.estado || customer?.state || '',
    zip:       customer?.zip || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (val) => setForm((p) => ({ ...p, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.nombre.trim()) {
      setError('El nombre completo del cliente es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: updateErr } = await updateCustomer(customer.id, {
        full_name: form.nombre.trim(),
        phone:     form.telefono.trim(),
        email:     form.email.trim(),
        address:   form.direccion.trim(),
        city:      form.ciudad.trim(),
        state:     form.estado.trim().toUpperCase(),
        zip:       form.zip.trim(),
      });

      if (updateErr) {
        throw new Error(humanizeDbError(updateErr));
      }

      const updatedCustomer = {
        id:        customer.id,
        nombre:    form.nombre.trim(),
        telefono:  form.telefono.trim(),
        email:     form.email.trim(),
        direccion: form.direccion.trim(),
        ciudad:    form.ciudad.trim(),
        estado:    form.estado.trim().toUpperCase(),
        zip:       form.zip.trim(),
        raw:       data || customer.raw,
      };

      onSave(updatedCustomer);
      onClose();
    } catch (err) {
      console.error('[EditCustomerModal] Update error:', err);
      setError(err.message || 'No se pudieron actualizar los datos del cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div className="bg-[#111] w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto border border-[#2a2a2a] shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        {/* ── Top Cobalt Stripe ── */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #1d4ed8, #38bdf8, #1d4ed8)' }} />

        {/* ── Header ── */}
        <div className="sticky top-0 bg-[#111]/95 backdrop-blur border-b border-[#1e1e1e] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Editar Datos del Cliente</h2>
              <p className="text-xs text-slate-500 mt-0.5">Actualizar información de contacto y dirección</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field
            label="Nombre Completo *"
            value={form.nombre}
            onChange={set('nombre')}
            placeholder="John Doe"
            required
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Teléfono"
              value={form.telefono}
              onChange={set('telefono')}
              placeholder="(555) 234-5678"
              type="tel"
              disabled={isSubmitting}
            />
            <Field
              label="Correo Electrónico"
              value={form.email}
              onChange={set('email')}
              placeholder="john@email.com"
              type="email"
              disabled={isSubmitting}
            />
          </div>

          <Field
            label="Dirección de Residencia"
            value={form.direccion}
            onChange={set('direccion')}
            placeholder="4521 Oak Street"
            disabled={isSubmitting}
          />

          <div className="grid grid-cols-[1fr_70px_100px] gap-2">
            <Field
              label="Ciudad"
              value={form.ciudad}
              onChange={set('ciudad')}
              placeholder="Houston"
              disabled={isSubmitting}
            />
            <Field
              label="Estado"
              value={form.estado}
              onChange={set('estado')}
              placeholder="TX"
              maxLength={2}
              disabled={isSubmitting}
            />
            <Field
              label="ZIP"
              value={form.zip}
              onChange={set('zip')}
              placeholder="77001"
              maxLength={10}
              disabled={isSubmitting}
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-xl border border-[#2a2a2a] text-slate-400 font-semibold hover:bg-white/5
                         transition active:scale-95 text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-3.5 rounded-xl text-white font-black text-sm shadow-lg shadow-blue-950/50
                         border border-blue-400/30 transition active:scale-95 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              style={{
                background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)',
                minHeight: '48px',
              }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando en Supabase…</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
