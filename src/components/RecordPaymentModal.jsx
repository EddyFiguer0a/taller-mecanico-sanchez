import { useState } from 'react';
import { X, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { recordInvoicePayment, humanizeDbError, safeMoney } from '../lib/tallerService';

const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

const PAYMENT_METHODS = [
  { key: 'Cash',  label: 'Cash (Efectivo)',  icon: '💵' },
  { key: 'Check', label: 'Check (Cheque)',   icon: '📄' },
];

/**
 * RecordPaymentModal — Register a full or partial balance payment on an existing invoice.
 *
 * Props:
 *   service  {object} — The invoice / service object being paid
 *   vehicle  {object} — Associated vehicle object
 *   onSave   {fn}     — Called with updated service object upon Supabase success
 *   onClose  {fn}     — Closes the modal
 */
export default function RecordPaymentModal({ service, vehicle, onSave, onClose }) {
  const currentSaldo   = Math.max(0, Number(service?.saldo) || 0);
  const currentDeposit = Math.max(0, Number(service?.deposito) || 0);
  const totalAmount    = Math.max(0, Number(service?.total) || 0);

  const [amount, setAmount] = useState(currentSaldo.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState(service?.metodoPago === 'Check' ? 'Check' : 'Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const parsedAmount = parseFloat(amount) || 0;
  const newDeposit   = safeMoney(currentDeposit + parsedAmount);
  const newSaldo     = Math.max(0, safeMoney(totalAmount - newDeposit));

  const handlePayFull = () => {
    setAmount(currentSaldo.toFixed(2));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (parsedAmount <= 0) {
      setError('Por favor ingresa un monto válido mayor a $0.00.');
      return;
    }

    if (parsedAmount > currentSaldo + 0.009) {
      setError(`El monto a pagar no puede superar el saldo pendiente (${fmt(currentSaldo)}).`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: payErr } = await recordInvoicePayment(service.id, {
        newDeposit,
        newBalance: newSaldo,
        paymentMethod,
      });

      if (payErr) {
        throw new Error(humanizeDbError(payErr));
      }

      const updatedService = {
        ...service,
        deposito: newDeposit,
        saldo: newSaldo,
        metodoPago: paymentMethod,
        raw: data || service.raw,
      };

      onSave(updatedService);
      onClose();
    } catch (err) {
      console.error('[RecordPaymentModal] Payment error:', err);
      setError(err.message || 'No se pudo registrar el pago. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div className="bg-[#111] w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-[#2a2a2a] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* ── Top Cobalt Accent ── */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #1d4ed8, #38bdf8, #1d4ed8)' }} />

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-[#1e1e1e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">Registrar Cobro</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {service.invoiceNumber} &bull; {vehicle?.marca} {vehicle?.modelo} ({vehicle?.placa?.toUpperCase()})
              </p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Financial summary banner */}
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Total de la Factura:</span>
              <span className="font-bold text-white tabular-nums">{fmt(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Depósito / Pagado previo:</span>
              <span className="font-bold text-emerald-400 tabular-nums">+{fmt(currentDeposit)}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-black border-t border-[#1e1e1e] pt-2">
              <span className="text-red-400">Saldo Pendiente (Balance Due):</span>
              <span className="text-base text-red-400 font-mono font-black tabular-nums">
                {fmt(currentSaldo)}
              </span>
            </div>
          </div>

          {/* Quick full-pay pill */}
          {parsedAmount !== currentSaldo && currentSaldo > 0 && (
            <button
              type="button"
              onClick={handlePayFull}
              disabled={isSubmitting}
              className="w-full py-2.5 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30
                         text-sky-400 text-xs font-bold transition active:scale-98 flex items-center justify-center gap-1.5"
            >
              <span>⚡ Liquidar Saldo Completo ({fmt(currentSaldo)})</span>
            </button>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Monto a Cobrar ($ USD) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-lg pointer-events-none">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={currentSaldo}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                disabled={isSubmitting}
                placeholder="0.00"
                required
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl pl-8 pr-4 py-3.5 text-white font-mono font-black text-xl
                           focus:outline-none focus:border-sky-400 transition disabled:opacity-50"
                style={{ fontSize: '20px', minHeight: '52px' }}
              />
            </div>
            {parsedAmount > 0 && parsedAmount <= currentSaldo && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                Nuevo saldo tras este cobro:&nbsp;
                <span className={`font-bold font-mono ${newSaldo === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {newSaldo === 0 ? '$0.00 (Liquidado ✓)' : fmt(newSaldo)}
                </span>
              </p>
            )}
          </div>

          {/* Payment Method Selector (Strictly Cash or Check) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Método de Pago
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {PAYMENT_METHODS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentMethod(key)}
                  disabled={isSubmitting}
                  className={`py-3 px-3 rounded-xl border font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                    paymentMethod === key
                      ? 'bg-sky-500/15 border-sky-400 text-white shadow-md shadow-sky-950/40'
                      : 'bg-[#0a0a0a] border-[#222] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
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
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-xl border border-[#2a2a2a] text-slate-400 font-semibold hover:bg-white/5
                         transition active:scale-95 text-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-3.5 rounded-xl text-white font-black text-sm shadow-lg shadow-emerald-950/50
                         border border-emerald-400/30 transition active:scale-95 flex items-center justify-center gap-2
                         disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              style={{
                background: 'linear-gradient(180deg, #059669 0%, #047857 55%, #065f46 100%)',
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
                  <CheckCircle size={18} />
                  <span>Confirmar Cobro ({fmt(parsedAmount)})</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
