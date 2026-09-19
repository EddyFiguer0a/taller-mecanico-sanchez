import { useState } from 'react';
import { X, Car, Check, AlertCircle } from 'lucide-react';
import { updateVehicleById, humanizeDbError } from '../lib/tallerService';

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

export default function EditVehicleModal({ vehicle, onSave, onClose }) {
  const [form, setForm] = useState({
    placa:  vehicle?.placa || '',
    marca:  vehicle?.marca || '',
    modelo: vehicle?.modelo || '',
    anio:   vehicle?.anio || new Date().getFullYear().toString(),
    vin:    vehicle?.vin || '',
    color:  vehicle?.color || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!form.placa.trim() || !form.marca.trim() || !form.modelo.trim() || !form.anio) {
      setError('Placa, marca, modelo y año son obligatorios.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { data, error: updateErr } = await updateVehicleById(vehicle.id, {
        license_plate: form.placa.trim(),
        make: form.marca.trim(),
        model: form.modelo.trim(),
        year: form.anio,
        vin: form.vin.trim(),
        color: form.color.trim()
      });

      if (updateErr) throw updateErr;

      if (data) {
        onSave(data);
      } else {
        throw new Error('No se pudo actualizar el vehículo.');
      }
    } catch (err) {
      console.error('[EditVehicleModal] Error:', err);
      setError(humanizeDbError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={() => !isSubmitting && onClose()} 
      />

      <div className="relative w-full max-w-lg bg-[#111] rounded-2xl shadow-2xl shadow-black border border-[#1e1e1e] flex flex-col max-h-[90vh] animate-slideUp">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1e1e1e] flex items-center justify-between sticky top-0 bg-[#111] z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0 text-sky-400">
              <Car size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Editar Vehículo</h2>
              <p className="text-xs text-slate-500 font-medium">Actualiza los detalles del carro</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 leading-relaxed">{error}</p>
            </div>
          )}

          <form id="edit-vehicle-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Placa *"
                value={form.placa}
                onChange={(val) => setForm({ ...form, placa: val.toUpperCase() })}
                placeholder="ABC-123"
                required
                disabled={isSubmitting}
              />
              <Field
                label="Año *"
                type="number"
                value={form.anio}
                onChange={(val) => setForm({ ...form, anio: val })}
                placeholder="2020"
                min="1900"
                max={new Date().getFullYear() + 1}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Marca *"
                value={form.marca}
                onChange={(val) => setForm({ ...form, marca: val })}
                placeholder="Toyota"
                required
                disabled={isSubmitting}
              />
              <Field
                label="Modelo *"
                value={form.modelo}
                onChange={(val) => setForm({ ...form, modelo: val })}
                placeholder="Corolla"
                required
                disabled={isSubmitting}
              />
            </div>
            <Field
              label="VIN / Chasis"
              value={form.vin}
              onChange={(val) => setForm({ ...form, vin: val.toUpperCase() })}
              placeholder="1HGCM82633A..."
              disabled={isSubmitting}
            />
            <Field
              label="Color"
              value={form.color}
              onChange={(val) => setForm({ ...form, color: val })}
              placeholder="Rojo"
              disabled={isSubmitting}
            />
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#1e1e1e] bg-[#141414] rounded-b-2xl flex items-center justify-end gap-3 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:text-white bg-[#222] hover:bg-[#2a2a2a] transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="edit-vehicle-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-lg transition active:scale-95 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)' }}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={16} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
