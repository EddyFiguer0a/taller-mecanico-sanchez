import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Pencil, X, ChevronUp } from 'lucide-react';

const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
const fmtDate = (d) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return d;
  }
};
const fmtMi = (n) => (n != null && n !== '' ? Number(n).toLocaleString() : '—');
/**
 * InvoiceView — printable, shop-formatted invoice.
 * Replaces the current full viewport; hides on print via .no-print.
 *
 * Props:
 *   service  {object} — Full service record (from historial)
 *   vehicle  {object} — Vehicle + cliente data
 *   onEdit   {fn}     — [Optional] Open editor for this invoice
 *   onClose  {fn}     — Back to profile view
 */
export default function InvoiceView({ service, vehicle, onEdit, onClose }) {
  const customer = vehicle?.cliente || service?.vehicle?.cliente || {};
  const lineas = service?.lineas || [];

  const isAnulada = service?.isAnulada || service?.tipo === 'Cancelled';

  const tipoBadge = isAnulada
    ? { bg: '#fee2e2', color: '#b91c1c', label: 'FACTURA ANULADA / VOID' }
    : service?.tipo === 'Estimate'
    ? { bg: '#ede9fe', color: '#5b21b6', label: 'ESTIMATE / COTIZACIÓN' }
    : { bg: '#dbeafe', color: '#1d4ed8', label: 'FINAL INVOICE' };

  const [isOpen, setIsOpen] = useState(false);

  // Manage document.title dynamically so browsers name downloaded PDF as "Sanchez Automotive - INV-xxxx"
  useEffect(() => {
    const originalTitle = document.title;
    const invNum = String(service?.invoiceNumber || '');
    const match = invNum.match(/\d+/);
    const formattedCode = match ? `INV-${match[0].padStart(4, '0')}` : (invNum || 'INV-0001');
    const pdfTitle = `Sanchez Automotive - ${formattedCode}`;

    document.title = pdfTitle;

    return () => {
      document.title = originalTitle;
    };
  }, [service?.invoiceNumber]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isOpen) {
          setIsOpen(false);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cityStZip = [customer.ciudad, customer.estado].filter(Boolean).join(', ') + (customer.zip ? ` ${customer.zip}` : '');

  return (
    <>
      {/* ── Dynamic Floating Action Button (FAB) (hidden on print) ── */}
      <div
        className="no-print fixed z-[80] flex flex-col items-end select-none"
        style={{
          bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          right: 'max(20px, env(safe-area-inset-right, 20px))',
        }}
      >
        {/* Backdrop for closing when tapping outside */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-slate-950/30 backdrop-blur-[2px] z-[-1] transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Speed Dial Menu Items */}
        <div
          className={`flex flex-col items-end gap-2.5 mb-3 transition-all duration-300 transform origin-bottom-right ${
            isOpen
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-90 translate-y-4 pointer-events-none'
          }`}
        >
          {/* Action 1: Print / Save PDF */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              const invNum = String(service?.invoiceNumber || '');
              const match = invNum.match(/\d+/);
              const formattedCode = match ? `INV-${match[0].padStart(4, '0')}` : (invNum || 'INV-0001');
              document.title = `Sanchez Automotive - ${formattedCode}`;
              setTimeout(() => window.print(), 120);
            }}
            className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white pl-4 pr-5 py-3 rounded-full shadow-2xl shadow-blue-600/40 border border-blue-400/30 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Printer size={17} className="text-white" />
            </div>
            <span className="font-bold text-xs tracking-wider uppercase whitespace-nowrap">
              Imprimir / PDF
            </span>
          </button>

          {/* Action 2: Edit Invoice (if available) */}
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onEdit(service);
              }}
              className="group flex items-center gap-3 bg-slate-900/95 hover:bg-slate-800 text-white pl-4 pr-5 py-3 rounded-full shadow-2xl border border-slate-700 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <Pencil size={16} className="text-sky-400" />
              </div>
              <span className="font-bold text-xs tracking-wider uppercase text-slate-200 whitespace-nowrap">
                Editar Factura
              </span>
            </button>
          )}

          {/* Action 3: Return / Back */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onClose?.();
            }}
            className="group flex items-center gap-3 bg-slate-900/95 hover:bg-slate-800 text-white pl-4 pr-5 py-3 rounded-full shadow-2xl border border-slate-700 active:scale-95 transition-all duration-200 cursor-pointer backdrop-blur-md"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <ArrowLeft size={16} className="text-slate-300" />
            </div>
            <span className="font-bold text-xs tracking-wider uppercase text-slate-200 whitespace-nowrap">
              Regresar
            </span>
          </button>
        </div>

        {/* Dynamic Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Cerrar opciones' : 'Abrir opciones de factura'}
          className={`flex items-center gap-2.5 px-5 py-3.5 rounded-full shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer ${
            isOpen
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
              : 'bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 hover:from-slate-800 hover:to-slate-800 text-white border border-slate-700/80 shadow-slate-950/60 hover:border-blue-500/60'
          }`}
        >
          {isOpen ? (
            <>
              <X size={18} className="text-white" />
              <span className="text-xs font-black tracking-wider uppercase">Cerrar</span>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center">
                <Printer size={17} className="text-blue-400" />
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
              </div>
              <span className="text-xs font-black tracking-wider uppercase text-slate-100">
                Opciones
              </span>
              <ChevronUp size={16} className="text-slate-400" />
            </>
          )}
        </button>
      </div>

      {/* ── Invoice Document ── */}
      <div
        className="bg-slate-100/70 min-h-screen py-6 sm:py-10 px-2 sm:px-4 no-print-padding print:bg-white print:p-0"
        style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}
      >
        <div
          id="invoice-document"
          className="max-w-[820px] mx-auto bg-white shadow-xl print:shadow-none px-6 sm:px-10 py-8 text-slate-900 border border-slate-200/80 print:border-none rounded-2xl print:rounded-none"
          style={{ fontSize: '12px' }}
        >

          {/* ══ ANULADA WATERMARK / BANNER ══════════════════════════ */}
          {isAnulada && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-600 rounded-xl text-center">
              <p className="text-red-700 font-black tracking-widest text-base uppercase">
                ⚠ FACTURA ANULADA / CANCELADA
              </p>
              {service?.motivoAnulacion && (
                <p className="text-red-600 text-xs font-semibold mt-1">
                  Motivo: {service.motivoAnulacion}
                </p>
              )}
            </div>
          )}

          {/* ══ SHOP HEADER ══════════════════════════════════════════ */}
          <div className="flex justify-between items-start mb-4 pb-4 border-b-2 border-slate-900">
            <div>
              <h1 className="text-3xl font-black text-slate-900 leading-tight tracking-tight">
                SANCHEZ AUTOMOTIVE
              </h1>
              <p className="text-sm text-slate-500 font-semibold mt-0.5">Diésel & Gasolines Engines</p>
            </div>

            <div className="text-right">
              {/* Invoice # box */}
              <div
                style={{
                  display: 'inline-block',
                  border: '2px solid #0f172a',
                  padding: '6px 16px',
                  marginBottom: '8px',
                }}
              >
                <p style={{ fontSize: '9px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                  Invoice #
                </p>
                <p style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', letterSpacing: '0.04em' }}>
                  {service.invoiceNumber}
                </p>
              </div>
              <br />
              <span
                style={{
                  display: 'inline-block',
                  background: tipoBadge.bg,
                  color: tipoBadge.color,
                  fontWeight: '800',
                  fontSize: '9px',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '6px',
                }}
              >
                {tipoBadge.label}
              </span>
              <p style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                <strong>Date:</strong> {fmtDate(service.fecha)}
              </p>
              {service.metodoPago && (
                <p style={{ fontSize: '11px', color: '#64748b' }}>
                  <strong>Payment:</strong> {service.metodoPago}
                </p>
              )}
            </div>
          </div>

          {/* ══ CUSTOMER + VEHICLE INFO ═══════════════════════════════ */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Customer */}
            <div style={{ border: '1px solid #cbd5e1', padding: '12px' }}>
              <p style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', color: '#0f172a' }}>
                Customer Information
              </p>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Name', <strong key="n">{customer.nombre || '—'}</strong>],
                    ['Address', customer.direccion || '—'],
                    ['City/St', cityStZip || '—'],
                    ['Phone', customer.telefono || '—'],
                    ['Email', customer.email || '—'],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td style={{ color: '#64748b', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {label}:
                      </td>
                      <td style={{ color: '#1e293b', paddingBottom: '3px' }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vehicle */}
            <div style={{ border: '1px solid #cbd5e1', padding: '12px' }}>
              <p style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', color: '#0f172a' }}>
                Vehicle Specification
              </p>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Make', <strong key="mk">{vehicle?.marca || '—'}</strong>],
                    ['Model', vehicle?.modelo || '—'],
                    ['Year', vehicle?.anio || '—'],
                    ['Color', vehicle?.color || '—'],
                    ['Plate', <strong key="pl" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{vehicle?.placa || '—'}</strong>],
                    ['VIN', <span key="vin" style={{ fontFamily: 'monospace', fontSize: '10px' }}>{vehicle?.vin || '—'}</span>],
                    ['Mileage In', fmtMi(service?.kilometrajeEntrada)],
                    ['Mileage Out', fmtMi(service?.kilometrajeSalida)],
                  ].map(([label, val]) => (
                    <tr key={label}>
                      <td style={{ color: '#64748b', paddingRight: '8px', paddingBottom: '3px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {label}:
                      </td>
                      <td style={{ color: '#1e293b', paddingBottom: '3px' }}>{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ══ WORK ITEMS TABLE ══════════════════════════════════════ */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '16px',
              fontSize: '11px',
            }}
          >
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff' }}>
                {[
                  { label: 'QTY', w: '48px', align: 'center' },
                  { label: 'PART NO.', w: '100px', align: 'left' },
                  { label: 'DESCRIPTION', w: 'auto', align: 'left' },
                  { label: 'UNIT PRICE', w: '90px', align: 'right' },
                  { label: 'AMOUNT', w: '90px', align: 'right' },
                ].map(({ label, w, align }) => (
                  <th key={label}
                    style={{
                      padding: '7px 10px', textAlign: align, width: w, fontWeight: '800',
                      fontSize: '9px', letterSpacing: '0.06em'
                    }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '6px 10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>{l.qty}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', fontFamily: 'monospace', color: '#475569' }}>
                    {l.partNo || '—'}
                  </td>
                  <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0' }}>{l.descripcion}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', border: '1px solid #e2e8f0' }}>
                    {fmt(l.precioUnit)}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', border: '1px solid #e2e8f0' }}>
                    {fmt(l.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ══ REMARKS + FINANCIAL SUMMARY ═══════════════════════════ */}
          <div className="grid grid-cols-[1fr_230px] gap-4 mb-8 print-no-break">
            {/* Remarks */}
            <div style={{ border: '1px solid #cbd5e1', padding: '12px', minHeight: '120px' }}>
              <p style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '8px', color: '#0f172a' }}>
                Remarks, Recommendations &amp; Guarantee
              </p>
              <p style={{ fontSize: '11px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {service.observaciones || ''}
              </p>
              {service.tecnico && (
                <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                  Technician: <strong>{service.tecnico}</strong>
                </p>
              )}
            </div>

            {/* Financials */}
            <div className="print-financial-box" style={{ border: '1px solid #cbd5e1', padding: '14px 16px', background: '#f8fafc' }}>
              {[
                { label: 'Subtotal:', value: fmt(service.subtotal) },
                { label: 'Tax:', value: fmt(service.impuesto) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px', color: '#475569' }}>
                  <span>{label}</span><span style={{ fontWeight: '600' }}>{value}</span>
                </div>
              ))}
              {/* TOTAL */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #0f172a', paddingTop: '8px', marginTop: '6px' }}>
                <span style={{ fontWeight: '900', fontSize: '14px', color: '#0f172a', letterSpacing: '0.04em' }}>TOTAL:</span>
                <span style={{ fontWeight: '900', fontSize: '15px', color: '#0f172a' }}>{fmt(service.total)}</span>
              </div>
            </div>
          </div>


          {/* ══ PRINT FOOTER ═══════════════════════════════════════ */}
          <div className="print-no-break" style={{ borderTop: '2px solid #e2e8f0', marginTop: '32px', paddingTop: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Sanchez Automotive
            </p>
            <p style={{ fontSize: '9px', color: '#64748b', marginTop: '4px', lineHeight: '1.5' }}>
              Thanks for your trust!
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
