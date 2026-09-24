import { ArrowLeft, Printer, Pencil } from 'lucide-react';

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

  const cityStZip = [customer.ciudad, customer.estado].filter(Boolean).join(', ') + (customer.zip ? ` ${customer.zip}` : '');

  return (
    <>
      {/* ── Action Bar (hidden on print) ── */}
      <div className="no-print fixed top-0 left-0 right-0 bg-slate-900 text-white px-4 py-3 flex items-center justify-between z-[70] shadow-xl border-b border-slate-700">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm font-semibold hover:text-blue-400 transition px-3 min-h-[48px] rounded-xl hover:bg-slate-800 cursor-pointer"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <span className="font-bold text-white text-sm hidden sm:block">
          {service?.invoiceNumber} — {vehicle?.marca} {vehicle?.modelo}
          {isAnulada && <span className="ml-2 text-xs font-black text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800/60">ANULADA</span>}
        </span>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(service)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 px-3.5 min-h-[48px] rounded-xl text-sm font-bold transition active:scale-95 cursor-pointer shadow-md"
            >
              <Pencil size={15} /> Editar
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 min-h-[48px] rounded-xl text-sm font-bold transition active:scale-95 shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── Invoice Document ── */}
      <div
        className="bg-white min-h-screen pt-[56px] no-print-padding"
        style={{ fontFamily: "'Arial', 'Helvetica', sans-serif" }}
      >
        <div
          id="invoice-document"
          className="max-w-[820px] mx-auto px-8 py-8 text-slate-900"
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
            <div className="print-financial-box" style={{ border: '1px solid #cbd5e1', padding: '12px' }}>
              {[
                { label: 'Subtotal:', value: fmt(service.subtotal), bold: false },
                { label: 'Tax:', value: fmt(service.impuesto), bold: false },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px', color: '#475569' }}>
                  <span>{label}</span><span style={{ fontWeight: '600' }}>{value}</span>
                </div>
              ))}
              {/* TOTAL */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', marginTop: '4px', marginBottom: '8px' }}>
                <span style={{ fontWeight: '900', fontSize: '13px', color: '#0f172a' }}>TOTAL:</span>
                <span style={{ fontWeight: '900', fontSize: '13px', color: '#0f172a' }}>{fmt(service.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px', color: '#475569' }}>
                <span>50% Deposit Paid:</span>
                <span style={{ fontWeight: '600' }}>({fmt(service.deposito)})</span>
              </div>
              {/* BALANCE */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', marginTop: '4px' }}>
                <span style={{ fontWeight: '900', fontSize: '13px', color: '#0f172a' }}>Balance Due:</span>
                <span style={{ fontWeight: '900', fontSize: '13px', color: '#0f172a' }}>{fmt(service.saldo)}</span>
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
