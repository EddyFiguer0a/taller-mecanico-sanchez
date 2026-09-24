import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, Plus, FileText, Camera, Wrench, X, AlertCircle,
  Car, Clock, ChevronRight, Receipt, Users, Home, WifiOff, Sun, Moon,
  ClipboardList, LogOut, Pencil, DollarSign, FileJson,
  Trash2, Ban, AlertTriangle,
} from 'lucide-react';
import BrandLogo from './components/BrandLogo';
import LoginModal from './components/LoginModal';
import NewVehicleModal from './components/NewVehicleModal';
import NewServiceModal from './components/NewServiceModal';
import RecordPaymentModal from './components/RecordPaymentModal';
import EditCustomerModal from './components/EditCustomerModal';
import EditVehicleModal from './components/EditVehicleModal';
import ImportJsonModal from './components/ImportJsonModal';
import InvoiceView from './components/InvoiceView';
import AnimatedLicensePlate from './components/AnimatedLicensePlate';
import {
  getVehicleByPlate,
  getAllVehicles,
  getSession,
  signOut,
  attachPhotoToInvoice,
  voidInvoice,
  deleteInvoice,
} from './lib/tallerService';
import { supabase } from './lib/supabaseClient';

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
const fmtDate = (d) => {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return d; }
};

// ─── SkeletonCard (loading placeholder) ──────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 skeleton" />
        <div className="h-3 w-1/2 skeleton" />
      </div>
    </div>
  );
}

// ─── TipoBadge (high-contrast for garage visibility) ─────────
function TipoBadge({ tipo }) {
  if (tipo === 'Cancelled') {
    return (
      <span className="text-xs sm:text-sm font-black px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40">
        🚫 ANULADA
      </span>
    );
  }
  const isEstimate = tipo === 'Estimate';
  return (
    <span className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-lg ${isEstimate
      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
      }`}>
      {isEstimate ? ' Estimate' : ' Final Invoice'}
    </span>
  );
}

// ─── Sidebar nav items ────────────────────────────────────────
const NAV = [
  { key: 'home', Icon: Home, label: 'Dashboard' },
  { key: 'vehicles', Icon: Car, label: 'Vehicles' },
  { key: 'services', Icon: Receipt, label: 'Services' },
  { key: 'customers', Icon: Users, label: 'Customers' },
];

// ─────────────────────────────────────────────────────────────
export default function App() {
  // ── Authentication session state ───────────────────────────
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out

  useEffect(() => {
    // 1. Restore existing session on mount
    getSession().then((s) => setSession(s ?? null));

    // 2. Subscribe to auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
    // Reset app state
    setVehiculos({});
    setAutoActual(null);
    setBusqueda('');
    setVista('search');
    setMobileMenuOpen(false);
  };

  const [vehiculos, setVehiculos] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [autoActual, setAutoActual] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [vista, setVista] = useState('search');
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [showEditVehicle, setShowEditVehicle] = useState(false);
  const [showNewService, setShowNewService] = useState(false);
  const [editingService, setEditingService] = useState(null); // Existing service object to edit
  const [selectedService, setSelectedService] = useState(null);
  const [invoiceService, setInvoiceService] = useState(null);
  const [voidModalData, setVoidModalData] = useState(null); // { service, vehicle }
  const [deleteModalData, setDeleteModalData] = useState(null); // { service, vehicle }
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null); // { service, vehicle }
  const [editingCustomerData, setEditingCustomerData] = useState(null); // { customer, vehiclePlate }
  const [showImportJson, setShowImportJson] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // ── Theme Management (Dark / Light) ────────────────────────
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  // Monitor connectivity status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const userId = session?.user?.id;
  const isSessionReady = session !== undefined;

  // ── Supabase Data Fetch on Authenticated Session ───────────
  useEffect(() => {
    // Only query when user is authenticated (RLS requires auth token)
    if (!userId) {
      if (isSessionReady) setIsInitialLoading(false);
      return;
    }

    let isMounted = true;
    setIsInitialLoading(true);

    async function loadInitialVehicles() {
      // Small delay to ensure Supabase auth state is fully propagated internally
      await new Promise(r => setTimeout(r, 150));

      try {
        const { data, error } = await getAllVehicles();
        if (!error && isMounted) {
          const map = {};
          (data || []).forEach((v) => {
            if (v && v.placa) {
              map[v.placa] = v;
            }
          });
          setVehiculos(map);
        }
      } catch (err) {
        console.warn('[App] Skipping initial Supabase sync:', err);
      } finally {
        if (isMounted) setIsInitialLoading(false);
      }
    }

    loadInitialVehicles();
    return () => {
      isMounted = false;
    };
  }, [userId, isSessionReady]);

  // ── Stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = Object.values(vehiculos);
    const srvs = all.flatMap((v) => v.historial);
    return {
      vehicles: all.length,
      estimates: srvs.filter((s) => s.tipo === 'Estimate').length,
      invoices: srvs.filter((s) => s.tipo === 'Final Invoice').length,
      pendingBalance: srvs.reduce((sum, s) => sum + (s.saldo || 0), 0),
    };
  }, [vehiculos]);

  // ── Unique Customers (Group vehicles by customer) ───────────
  const uniqueCustomers = useMemo(() => {
    const map = {};
    Object.values(vehiculos).forEach((v) => {
      const custId = v.cliente?.id || (v.cliente?.nombre || '').toLowerCase().trim();
      if (!custId) return;
      if (!map[custId]) {
        map[custId] = {
          ...v.cliente,
          id: v.cliente?.id || custId,
          vehiculos: [],
        };
      }
      if (!map[custId].vehiculos.some((existing) => existing.placa.toLowerCase() === v.placa.toLowerCase())) {
        map[custId].vehiculos.push(v);
      }
    });
    return Object.values(map);
  }, [vehiculos]);

  // ── Async Search via Supabase ─────────────────────────────
  const handleInputChange = (e) => {
    setBusqueda(e.target.value.toLowerCase().replace(/\s+/g, ''));
    setNotFound(false);
  };

  const handleBuscar = async (e) => {
    e?.preventDefault();
    const q = busqueda.trim().toLowerCase().replace(/\s+/g, '');
    if (!q) return;

    setIsSearching(true);
    setNotFound(false);

    try {
      // 1. Live database query to Supabase
      const { data, error } = await getVehicleByPlate(q);

      if (error) {
        console.error('[App] Supabase plate search query error:', error);
      }

      if (data) {
        setAutoActual(data);
        setVehiculos((prev) => ({ ...prev, [data.placa]: data }));
        setNotFound(false);
        setVista('profile');
      } else {
        // 2. Fallback to local memory / mock cache
        const localHit = vehiculos[q];
        if (localHit) {
          setAutoActual(localHit);
          setNotFound(false);
          setVista('profile');
        } else {
          setAutoActual(null);
          setNotFound(true);
        }
      }
    } catch (err) {
      console.error('[App] Unexpected error during vehicle search:', err);
      const localHit = vehiculos[q];
      if (localHit) {
        setAutoActual(localHit);
        setNotFound(false);
        setVista('profile');
      } else {
        setAutoActual(null);
        setNotFound(true);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleBackToSearch = () => {
    setVista('search');
    setAutoActual(null);
    setBusqueda('');
    setNotFound(false);
  };

  // ── CRUD ───────────────────────────────────────────────────
  // Note: Supabase persistence (customer + vehicle) is now handled
  // inside NewVehicleModal. This handler updates local React state with mutex protection.
  const isSavingVehiculoRef = useRef(false);

  const handleSaveVehicleEdit = (updatedVehicle) => {
    setVehiculos((prev) => {
      const nextMap = { ...prev };
      // Si la placa cambió, borrar la entrada anterior para evitar duplicados en la lista local
      if (autoActual?.placa && nextMap[autoActual.placa]) {
        delete nextMap[autoActual.placa];
      }
      nextMap[updatedVehicle.placa] = updatedVehicle;
      return nextMap;
    });

    setAutoActual(updatedVehicle);
    setShowEditVehicle(false);
  };

  const handleSaveVehiculo = (v) => {
    if (isSavingVehiculoRef.current) return;
    isSavingVehiculoRef.current = true;
    try {
      setVehiculos((p) => ({ ...p, [v.placa]: v }));
      setAutoActual(v);
      setShowNewVehicle(false);
      setVista('profile');
      setBusqueda('');
      setNotFound(false);
    } finally {
      setTimeout(() => {
        isSavingVehiculoRef.current = false;
      }, 500);
    }
  };

  const isSavingServicioRef = useRef(false);
  const handleSaveServicio = (updatedVehicleOrService) => {
    if (isSavingServicioRef.current) return;
    isSavingServicioRef.current = true;
    try {
      // If a full refreshed vehicle object was returned from Supabase
      if (updatedVehicleOrService?.placa && updatedVehicleOrService?.historial) {
        setVehiculos((p) => ({ ...p, [updatedVehicleOrService.placa]: updatedVehicleOrService }));
        if (autoActual?.placa === updatedVehicleOrService.placa || !autoActual) {
          setAutoActual(updatedVehicleOrService);
        }
        if (selectedService) {
          const found = updatedVehicleOrService.historial.find((s) => s.id === selectedService.id);
          if (found) setSelectedService(found);
        }
      } else if (autoActual) {
        // If service record was passed directly
        const s = updatedVehicleOrService;
        const exists = (autoActual.historial || []).some((item) => item.id === s.id);
        const updatedHistorial = exists
          ? autoActual.historial.map((item) => (item.id === s.id ? s : item))
          : [s, ...(autoActual.historial || [])];
        const updated = { ...autoActual, historial: updatedHistorial };
        setVehiculos((p) => ({ ...p, [autoActual.placa]: updated }));
        setAutoActual(updated);
        if (selectedService?.id === s.id) {
          setSelectedService(s);
        }
      }
      setShowNewService(false);
      setEditingService(null);
    } finally {
      setTimeout(() => {
        isSavingServicioRef.current = false;
      }, 500);
    }
  };

  // ── Void / Anular Invoice Handlers (Enterprise Method 1) ──
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('Cancelada por el taller');
  const [voidError, setVoidError] = useState(null);

  const handleOpenVoidModal = (service, vehicle) => {
    setVoidReason('Cancelada por el taller');
    setVoidError(null);
    setVoidModalData({ service, vehicle });
  };

  const handleConfirmVoid = async () => {
    if (!voidModalData?.service?.id) return;
    setIsVoiding(true);
    setVoidError(null);
    try {
      const { error } = await voidInvoice(voidModalData.service.id, voidReason);
      if (error) throw error;

      const plate = voidModalData.vehicle?.placa || autoActual?.placa;
      if (plate) {
        const { data: refreshed } = await getVehicleByPlate(plate);
        if (refreshed) {
          setVehiculos((p) => ({ ...p, [refreshed.placa]: refreshed }));
          if (autoActual?.placa === refreshed.placa || !autoActual) {
            setAutoActual(refreshed);
          }
          if (selectedService?.id === voidModalData.service.id) {
            const found = (refreshed.historial || []).find((s) => s.id === voidModalData.service.id);
            if (found) setSelectedService(found);
          }
        }
      }
      setVoidModalData(null);
    } catch (err) {
      console.error('Error anulando factura:', err);
      setVoidError(err.message || 'No se pudo anular la factura. Inténtalo de nuevo.');
    } finally {
      setIsVoiding(false);
    }
  };

  // ── Delete Invoice Permanently Handlers ───────────────────
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleOpenDeleteModal = (service, vehicle) => {
    setDeleteError(null);
    setDeleteModalData({ service, vehicle });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalData?.service?.id) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await deleteInvoice(deleteModalData.service.id);
      if (error) throw error;

      const plate = deleteModalData.vehicle?.placa || autoActual?.placa;
      if (plate) {
        const { data: refreshed } = await getVehicleByPlate(plate);
        if (refreshed) {
          setVehiculos((p) => ({ ...p, [refreshed.placa]: refreshed }));
          if (autoActual?.placa === refreshed.placa) {
            setAutoActual(refreshed);
          }
        } else {
          // Fallback optimistic filter
          setVehiculos((p) => {
            const v = p[plate];
            if (!v) return p;
            const updated = { ...v, historial: (v.historial || []).filter((s) => s.id !== deleteModalData.service.id) };
            if (autoActual?.placa === plate) setAutoActual(updated);
            return { ...p, [plate]: updated };
          });
        }
      }

      if (selectedService?.id === deleteModalData.service.id) {
        setSelectedService(null);
      }
      if (invoiceService?.id === deleteModalData.service.id) {
        setInvoiceService(null);
      }
      setDeleteModalData(null);
    } catch (err) {
      console.error('Error eliminando factura:', err);
      setDeleteError(err.message || 'No se pudo eliminar la factura. Inténtalo de nuevo.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getNextInvoiceNumber = () => {
    const all = Object.values(vehiculos).flatMap((v) => v.historial || []);
    const max = all.reduce((m, s) => {
      const match = (s.invoiceNumber || '').match(/(\d+)$/);
      const n = match ? parseInt(match[1], 10) : 0;
      return Math.max(m, n);
    }, 0);
    return `INV-${String(max + 1).padStart(4, '0')}`;
  };

  const handleViewInvoice = (serv) => {
    const veh =
      serv?.vehicle ||
      autoActual ||
      Object.values(vehiculos).find((v) =>
        (v.historial || []).some((s) => s.id === serv?.id)
      ) || null;

    if (veh && !autoActual) {
      setAutoActual(veh);
    }
    setInvoiceService({ ...serv, vehicle: veh || serv?.vehicle || autoActual });
    setSelectedService(null);
  };

  // ── Payment persistence handler ─────────────────────────────
  const handleSavePayment = (updatedService, vehiclePlate) => {
    setVehiculos((prev) => {
      const v = prev[vehiclePlate];
      if (!v) return prev;
      const updatedHistorial = (v.historial || []).map((s) =>
        s.id === updatedService.id ? updatedService : s
      );
      const updatedV = { ...v, historial: updatedHistorial };
      if (autoActual?.placa === vehiclePlate) {
        setAutoActual(updatedV);
      }
      return { ...prev, [vehiclePlate]: updatedV };
    });

    if (selectedService?.id === updatedService.id) {
      setSelectedService(updatedService);
    }
  };

  // ── Customer profile update handler ─────────────────────────
  const handleSaveCustomer = (updatedCustomer, vehiclePlate) => {
    setVehiculos((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((plate) => {
        const v = next[plate];
        if (
          v.cliente?.id === updatedCustomer.id ||
          v.customer_id === updatedCustomer.id ||
          plate === vehiclePlate
        ) {
          next[plate] = {
            ...v,
            cliente: {
              ...v.cliente,
              ...updatedCustomer,
            },
          };
        }
      });
      return next;
    });

    if (autoActual?.cliente?.id === updatedCustomer.id || autoActual?.placa === vehiclePlate) {
      setAutoActual((prev) => ({
        ...prev,
        cliente: {
          ...prev.cliente,
          ...updatedCustomer,
        },
      }));
    }
  };

  // ── Invoice photo attachment handler ────────────────────────
  const invoicePhotoInputRef = useRef(null);
  const [isUploadingInvoicePhoto, setIsUploadingInvoicePhoto] = useState(false);

  const handleAttachInvoicePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedService?.id) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('La imagen excede el límite de 15MB.');
      if (invoicePhotoInputRef.current) invoicePhotoInputRef.current.value = '';
      return;
    }

    setIsUploadingInvoicePhoto(true);
    try {
      const { attachment, error } = await attachPhotoToInvoice(selectedService.id, file, 'invoice');
      if (error) {
        alert(`Error al subir la imagen: ${error.message || 'Intente nuevamente'}`);
        return;
      }

      if (attachment) {
        // 1. Update selectedService
        const updatedFotos = [...(selectedService.fotos || []), attachment];
        const updatedSelected = { ...selectedService, fotos: updatedFotos };
        setSelectedService(updatedSelected);

        // 2. Update vehiculos state
        setVehiculos((prev) => {
          const nextMap = { ...prev };
          Object.keys(nextMap).forEach((plate) => {
            const veh = nextMap[plate];
            if (veh.historial?.some((s) => s.id === selectedService.id)) {
              const newHistorial = veh.historial.map((s) =>
                s.id === selectedService.id ? updatedSelected : s
              );
              nextMap[plate] = { ...veh, historial: newHistorial };
            }
          });
          return nextMap;
        });

        // 3. Update autoActual if currently focused
        if (autoActual?.historial?.some((s) => s.id === selectedService.id)) {
          setAutoActual((prev) => ({
            ...prev,
            historial: prev.historial.map((s) => (s.id === selectedService.id ? updatedSelected : s)),
          }));
        }
      }
    } catch (err) {
      console.error('[App] Error attaching photo to invoice:', err);
      alert('Ocurrió un error inesperado al subir la foto.');
    } finally {
      setIsUploadingInvoicePhoto(false);
      if (invoicePhotoInputRef.current) invoicePhotoInputRef.current.value = '';
    }
  };

  const handleNav = (key) => {
    if (key === 'home') {
      handleBackToSearch();
    } else {
      setVista(key);
      setAutoActual(null);
      setBusqueda('');
      setNotFound(false);
    }
  };

  // active nav key
  const activeNav = vista === 'profile' ? 'vehicles' : vista === 'search' ? 'home' : vista;

  // ── Auth gate: show spinner while session check is pending ──
  if (session === undefined) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Auth gate: show login screen when no valid session ────────
  if (!session) {
    return <LoginModal onLogin={setSession} />;
  }

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Offline Warning Banner ── */}
      {!isOnline && (
        <div className="bg-rose-600 text-white font-bold text-xs py-2.5 px-4 flex items-center justify-center gap-2 sticky top-0 z-[100] shadow-lg print-hide">
          <WifiOff size={16} />
          <span>⚠️ Sin conexión a internet — Por favor verifica tu red Wi-Fi o datos móviles.</span>
        </div>
      )}

      {/* ── Full-screen Invoice Print / PDF ── */}
      {invoiceService && (
        <div className="fixed inset-0 z-[60] bg-white overflow-auto print:static print:overflow-visible">
          <InvoiceView
            service={invoiceService}
            vehicle={
              invoiceService.vehicle ||
              autoActual ||
              Object.values(vehiculos).find((v) =>
                (v.historial || []).some((s) => s.id === invoiceService.id)
              ) || {
                placa: 'S/P',
                marca: 'Vehículo',
                modelo: '',
                cliente: invoiceService.cliente || { nombre: 'Cliente General' },
              }
            }
            onEdit={(serv) => {
              const veh = serv.vehicle || autoActual || Object.values(vehiculos).find(v => (v.historial || []).some(s => s.id === serv.id));
              setInvoiceService(null);
              setEditingService({ ...serv, vehicle: veh });
            }}
            onClose={() => setInvoiceService(null)}
          />
        </div>
      )}

      <div className={`min-h-screen bg-[#0a0a0a] flex ${invoiceService ? 'print-hide' : ''}`}>

        {/* ══════════════════════════════════════════════════════
            DESKTOP SIDEBAR
        ══════════════════════════════════════════════════════ */}
        <aside className="hidden md:flex md:flex-col w-60 min-h-screen flex-shrink-0 fixed left-0 top-0 bottom-0 z-40">
          {/* Logo / Brand */}
          <div className="bg-[#111] border-b border-[#222] px-5 py-5">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-950/30"
                style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #38bdf8 100%)' }}
              >
                <Wrench size={20} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight">SANCHEZ</p>
                <p className="text-sky-400 text-[10px] font-bold uppercase tracking-[0.12em]">Automecánica</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 bg-[#111] px-3 py-4 space-y-1 border-r border-[#1e1e1e]">
            {NAV.map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => handleNav(key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition active:scale-95 ${activeNav === key
                  ? 'text-white font-black shadow-lg shadow-blue-950/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                style={activeNav === key ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' } : {}}
              >
                <Icon size={17} className="flex-shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="bg-[#111] border-t border-[#1e1e1e] border-r border-r-[#1e1e1e] px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-500 font-medium">© 2026 Sanchez</p>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-sky-500/30 cursor-pointer"
                title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              >
                {theme === 'dark' ? <Sun size={14} className="text-sky-400" /> : <Moon size={14} className="text-slate-400" />}
                <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
              </button>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-red-400 transition px-2.5 py-1.5 rounded-lg hover:bg-red-500/5 border border-transparent hover:border-red-500/20 cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut size={13} />
              <span>Cerrar Sesión</span>
              {session?.user?.email && (
                <span className="ml-auto text-[10px] text-slate-600 font-normal truncate max-w-[90px]">
                  {session.user.email.split('@')[0]}
                </span>
              )}
            </button>
          </div>
        </aside>

        {/* ══════════════════════════════════════════════════════
            MOBILE DRAWER (SIDEBAR)
        ══════════════════════════════════════════════════════ */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex animate-fadeIn">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer Surface */}
            <div
              className="relative w-72 max-w-[85vw] bg-[#111] border-r border-[#1e1e1e] h-full flex flex-col shadow-2xl z-10 animate-slideRight"
            >
              {/* Drawer Header */}
              <div
                className="px-5 pb-5 border-b border-[#1e1e1e] flex items-center justify-between bg-[#141414]"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #38bdf8 100%)' }}
                  >
                    <Wrench size={19} className="text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-white font-black text-sm leading-tight">SANCHEZ</p>
                    <p className="text-sky-400 text-[10px] font-bold uppercase tracking-[0.12em]">Automecánica</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition cursor-pointer"
                  aria-label="Cerrar menú"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Navigation List */}
              <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">Menú Principal</p>
                {NAV.map(({ key, Icon, label }) => {
                  const isActive = activeNav === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        handleNav(key);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold text-sm transition active:scale-95 cursor-pointer ${isActive
                        ? 'text-white font-black shadow-lg shadow-blue-950/40'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                      style={isActive ? { background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' } : {}}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="flex-shrink-0" />
                        <span>{label}</span>
                      </div>
                      {isActive && <ChevronRight size={16} />}
                    </button>
                  );
                })}

                {/* Quick Action Shortcuts inside drawer */}
                <div className="pt-4 mt-4 border-t border-[#1e1e1e] space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">Acciones Rápidas</p>
                  <button
                    onClick={() => {
                      setShowNewVehicle(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition active:scale-95 cursor-pointer"
                  >
                    <Plus size={16} /> Registrar Vehículo
                  </button>
                  <button
                    onClick={() => {
                      setShowImportJson(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs border border-sky-500/20 text-slate-300 hover:text-white hover:bg-white/5 transition active:scale-95 cursor-pointer"
                  >
                    <FileJson size={16} className="text-sky-400" /> Importar Facturas (JSON)
                  </button>
                  {autoActual && (
                    <button
                      onClick={() => {
                        setShowNewService(true);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs text-white shadow transition active:scale-95 cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' }}
                    >
                      <Plus size={16} /> Nueva Factura ({autoActual.placa.toUpperCase()})
                    </button>
                  )}
                </div>
              </nav>

              {/* Drawer Footer with Theme Toggle + Sign Out */}
              <div className="p-4 border-t border-[#1e1e1e] bg-[#141414] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Tema visual</span>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-xs font-bold text-slate-300 hover:text-white bg-[#0a0a0a] transition cursor-pointer"
                  >
                    {theme === 'dark' ? <Sun size={14} className="text-sky-400" /> : <Moon size={14} className="text-slate-400" />}
                    <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                  </button>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5 text-xs font-bold text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Cerrar Sesión</span>
                  {session?.user?.email && (
                    <span className="ml-auto text-[10px] text-slate-500 font-normal truncate max-w-[110px]">
                      {session.user.email}
                    </span>
                  )}
                </button>
                <p className="text-[10px] text-slate-600 text-center">© 2026 Sanchez Automecánica</p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            MAIN CONTENT
        ══════════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-h-screen md:ml-60">

          {/* ── Mobile Header ── */}
          <header
            className="md:hidden bg-[#111] border-b border-[#1e1e1e] px-4 pb-3.5 sticky top-0 z-40 flex items-center justify-between shadow-sm"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 14px)' }}
          >
            <div className="flex items-center gap-2">
              {vista === 'profile' && (
                <button
                  onClick={handleBackToSearch}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg transition mr-0.5 cursor-pointer"
                  aria-label="Volver a búsqueda"
                >
                  ←
                </button>
              )}

              {/* Interactive Wrench Button to Open Drawer */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex items-center gap-2.5 p-1 -ml-1 rounded-xl hover:bg-white/5 active:scale-95 transition text-left cursor-pointer group"
                aria-label="Abrir menú de navegación"
                title="Toca para abrir el menú de navegación"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md relative group-hover:scale-105 transition flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' }}
                >
                  <Wrench size={17} className="text-white" strokeWidth={2.5} />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#111]" />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-white font-black text-sm leading-none">SANCHEZ</p>
                    <ChevronRight size={13} className="text-slate-500 group-hover:text-sky-400 transition" />
                  </div>
                  <p className="text-[10px] text-sky-400 font-bold leading-none uppercase tracking-wider mt-0.5">Automecánica</p>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl border border-[#2a2a2a] text-slate-300 bg-[#0a0a0a] transition active:scale-95 cursor-pointer"
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={15} className="text-sky-400" /> : <Moon size={15} className="text-slate-400" />}
              </button>
              {vista === 'profile' && autoActual && (
                <button
                  onClick={() => setShowNewService(true)}
                  className="flex items-center gap-1.5 text-white font-black text-xs px-3 py-2 rounded-xl active:scale-95 transition cursor-pointer shadow-md shadow-blue-950/40 border border-blue-400/30"
                  style={{ background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)' }}
                >
                  <Plus size={13} strokeWidth={2.5} /> Invoice
                </button>
              )}
              <button
                onClick={() => setShowNewVehicle(true)}
                className="text-sky-400 border border-sky-500/30 hover:bg-sky-500/10 text-xs font-bold px-2.5 py-2 rounded-xl transition active:scale-95 cursor-pointer"
              >
                + Register
              </button>
            </div>
          </header>

          {/* ── Desktop Top Bar ── */}
          <div className="hidden md:block bg-[#111] border-b border-[#1e1e1e] px-4 md:px-8 py-4 sticky top-0 z-30 shadow-sm">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div>
                {vista === 'profile' && autoActual ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                      <button onClick={handleBackToSearch} className="hover:text-sky-400 transition font-medium cursor-pointer">
                        Dashboard
                      </button>
                      <span>/</span>
                      <span className="text-slate-300 font-semibold">
                        {autoActual.marca} {autoActual.modelo}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-white">
                      {autoActual.placa.toUpperCase()}
                      <span className="ml-2 text-slate-400 font-normal text-base">{autoActual.anio}</span>
                    </h2>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-600 mb-0.5">Pages / Dashboard</p>
                    <h2 className="text-xl font-black text-white">Dashboard</h2>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#2a2a2a] hover:border-sky-500/40 text-slate-300 hover:text-white bg-[#0a0a0a] transition active:scale-95 text-xs font-bold shadow-sm cursor-pointer"
                  title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun size={16} className="text-sky-400" />
                      <span>Modo Claro</span>
                    </>
                  ) : (
                    <>
                      <Moon size={16} className="text-slate-400" />
                      <span>Modo Oscuro</span>
                    </>
                  )}
                </button>
                {vista === 'profile' && autoActual && (
                  <button onClick={() => setShowNewService(true)}
                    className="flex items-center gap-2 text-white font-black text-sm px-5 py-2.5 rounded-xl
                               shadow-lg shadow-blue-950/40 border border-blue-400/25 transition active:scale-95 cursor-pointer"
                    style={{ background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)' }}>
                    <Plus size={16} strokeWidth={2.5} /> New Invoice
                  </button>
                )}
                <button
                  onClick={() => setShowImportJson(true)}
                  className="hidden sm:flex items-center gap-2 text-xs font-bold text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-400/50 bg-[#0a0a0a] px-3.5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer"
                  title="Importar facturas históricas en formato JSON"
                >
                  <FileJson size={15} />
                  <span>Importar Facturas</span>
                </button>
                <button onClick={() => setShowNewVehicle(true)}
                  className="flex items-center gap-2 text-white font-black text-sm px-5 py-2.5 rounded-xl
                             shadow-lg shadow-blue-950/40 border border-blue-400/25 transition active:scale-95 cursor-pointer"
                  style={{ background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)' }}>
                  <Plus size={16} strokeWidth={2.5} /> Register Vehicle
                </button>
              </div>
            </div>
          </div>

          {/* ── Page Content ── */}
          <main className="flex-1 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">

              {/* ════════════════════════════════════════════════
                  VIEW A — SEARCH / DASHBOARD
              ════════════════════════════════════════════════ */}
              {vista === 'search' && (
                <div className="space-y-6">

                  {/* Stats Row — Desktop */}
                  <div className="hidden md:grid grid-cols-4 gap-4">
                    {[
                      { label: 'Total Vehicles', value: stats.vehicles, from: '#1d4ed8', to: '#2563eb' },
                      { label: 'Open Estimates', value: stats.estimates, from: '#0284c7', to: '#38bdf8' },
                      { label: 'Final Invoices', value: stats.invoices, from: '#065f46', to: '#059669' },
                      { label: 'Pending Balance', value: fmt(stats.pendingBalance), from: '#1e3a8a', to: '#0284c7' },
                    ].map(({ label, value, from, to }) => (
                      <div key={label} className="rounded-2xl p-5 text-white overflow-hidden relative"
                        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">{label}</p>
                        <p className="text-3xl font-black mt-1">{value}</p>
                        <div className="absolute right-3 bottom-3 opacity-10 text-5xl font-black select-none">
                          {label === 'Total Vehicles' ? '🚗' : label === 'Open Estimates' ? '📋' : label === 'Final Invoices' ? '✅' : '$'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Search Card */}
                  <div className="bg-[#111] rounded-2xl border border-[#1e1e1e] p-5 shadow-xl shadow-black/40">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Search by License Plate / Placa
                    </p>

                    <form onSubmit={handleBuscar} className="flex gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          id="plate-search"
                          type="text"
                          value={busqueda}
                          onChange={handleInputChange}
                          placeholder="ABC123"
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck="false"
                          className="w-full pl-10 pr-4 py-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl
                                     text-white text-xl font-mono tracking-[0.2em] uppercase
                                     placeholder-slate-700 placeholder:normal-case placeholder:tracking-normal
                                     focus:outline-none focus:ring-2 transition-all"
                          style={{ '--tw-ring-color': '#38bdf8' }}
                          onFocus={(e) => e.target.style.borderColor = '#38bdf8'}
                          onBlur={(e) => e.target.style.borderColor = '#2a2a2a'}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearching}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 min-h-[48px]
                                   rounded-xl transition active:scale-95 whitespace-nowrap text-base flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                      >
                        {isSearching ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Searching…</span>
                          </>
                        ) : (
                          <>
                            <Search size={18} />
                            <span>Search</span>
                          </>
                        )}
                      </button>
                    </form>

                    {/* Not Found Banner */}
                    {notFound && (
                      <div className="mt-4 p-4 bg-red-950/40 border border-red-800/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                            <AlertCircle size={22} className="text-red-400" />
                          </div>
                          <div>
                            <p className="text-red-300 text-sm font-bold">Vehicle not found</p>
                            <p className="text-red-400 font-mono font-black text-lg uppercase tracking-widest">{busqueda}</p>
                            <p className="text-red-400/60 text-xs mt-0.5">Register this plate to start tracking services</p>
                          </div>
                        </div>
                        <button onClick={() => setShowNewVehicle(true)}
                          className="text-white font-black text-sm px-5 min-h-[48px] rounded-xl transition active:scale-95 flex-shrink-0 flex items-center gap-2 shadow-lg"
                          style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' }}>
                          <Plus size={16} /> Register Vehicle
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Recent Vehicles */}
                  {isInitialLoading ? (
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Clock size={13} /> Loading Vehicles…
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
                      </div>
                    </div>
                  ) : Object.keys(vehiculos).length > 0 ? (
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Clock size={13} /> Recent Vehicles
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.values(vehiculos).map((v) => (
                          <button
                            key={v.placa}
                            id={`recent-${v.placa}`}
                            onClick={() => { setAutoActual(v); setVista('profile'); }}
                            className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 text-left min-h-[56px]
                                       hover:border-sky-500/40 hover:bg-[#161616] transition
                                       flex items-center gap-3 group active:scale-[0.97]"
                          >
                            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-1.5 shadow-sm">
                              <BrandLogo make={v.marca} size="md" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-white text-sm group-hover:text-sky-400 transition truncate">
                                {v.marca} {v.modelo}
                              </p>
                              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">
                                {v.placa} &bull; {v.anio} &bull; {v.color}
                              </p>
                            </div>
                            <ChevronRight size={15} className="text-slate-700 group-hover:text-sky-400 flex-shrink-0 transition" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#111] border border-dashed border-[#2a2a2a] rounded-2xl p-10 text-center">
                      <Car size={48} className="text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm font-semibold">No vehicles registered yet</p>
                      <p className="text-slate-600 text-xs mt-1">Search for a plate above or register a new vehicle</p>
                      <button onClick={() => setShowNewVehicle(true)}
                        className="mt-4 text-white font-black text-sm px-5 min-h-[48px] rounded-xl transition active:scale-95 shadow-lg inline-flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' }}>
                        <Plus size={16} /> Register Vehicle
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════
                  VIEW B — VEHICLE PROFILE
              ════════════════════════════════════════════════ */}
              {vista === 'profile' && autoActual && (
                <div className="space-y-5">

                  {/* Vehicle Header */}
                  <div className="bg-[#111] rounded-2xl border border-[#1e1e1e] overflow-hidden shadow-xl shadow-black/40">
                    {/* Cobalt & Sky accent top stripe */}
                    <div className="h-1" style={{ background: 'linear-gradient(90deg, #1d4ed8, #38bdf8, #1d4ed8)' }} />

                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 sm:gap-6">

                        {/* Mobile Top Row: Plate & Logo */}
                        <div className="flex items-center justify-between w-full sm:hidden mb-2">
                          <AnimatedLicensePlate placa={autoActual.placa} />
                          <div className="w-[60px] h-[60px] bg-white rounded-xl flex items-center justify-center p-1.5 flex-shrink-0 shadow-lg border border-slate-200/10">
                            <BrandLogo make={autoActual.marca} size="lg" />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Desktop Plate (Hidden on mobile) */}
                          <div className="hidden sm:block mb-4">
                            <AnimatedLicensePlate placa={autoActual.placa} />
                          </div>

                          {/* Headline & Edit Button */}
                          <div className="flex items-center justify-between sm:justify-start gap-4 mb-2">
                            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight truncate">
                              {autoActual.anio} {autoActual.marca} {autoActual.modelo}
                            </h2>
                            <button
                              onClick={() => setShowEditVehicle(true)}
                              className="flex-shrink-0 text-sky-400 hover:text-sky-300 flex items-center justify-center transition p-2 rounded-xl hover:bg-sky-500/10 border border-sky-500/20 active:scale-95 shadow-sm bg-[#111]"
                              title="Editar datos del vehículo"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>

                          {/* Color & VIN */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {autoActual.color && (
                              <span className="text-sm sm:text-base text-slate-300 font-medium">
                                {autoActual.color}
                              </span>
                            )}

                            {autoActual.color && autoActual.vin && (
                              <span className="text-slate-600 font-black px-1">&bull;</span>
                            )}

                            {autoActual.vin && (
                              <div className="flex items-center gap-1.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 px-2.5 py-1 rounded-lg">
                                <span className="font-mono text-xs sm:text-sm font-bold tracking-wide uppercase">
                                  VIN: {autoActual.vin}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Desktop Brand Logo (Hidden on mobile) */}
                        <div className="hidden sm:flex w-24 h-24 bg-white rounded-2xl items-center justify-center p-3 flex-shrink-0 shadow-xl border border-slate-200/10">
                          <BrandLogo make={autoActual.marca} size="lg" />
                        </div>
                      </div>

                      {/* Customer Panel */}
                      <div className="mt-4 bg-[#0a0a0a] rounded-xl p-4 border border-[#1e1e1e]">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.12em]">
                            Customer
                          </p>
                          <button
                            onClick={() => setEditingCustomerData({ customer: autoActual.cliente, vehiclePlate: autoActual.placa })}
                            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1.5 transition py-1 px-2.5 rounded-lg hover:bg-sky-500/10 border border-sky-500/20 active:scale-95 cursor-pointer"
                            title="Editar datos del cliente"
                          >
                            <Pencil size={12} />
                            <span>Editar</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
                          <p className="font-bold text-white">{autoActual.cliente.nombre}</p>
                          <p className="text-slate-400">{autoActual.cliente.telefono}</p>
                          <p className="text-slate-500 text-xs truncate">{autoActual.cliente.email}</p>
                          <p className="text-slate-500 text-xs">
                            {autoActual.cliente.direccion}, {autoActual.cliente.ciudad}, {autoActual.cliente.estado} {autoActual.cliente.zip}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service History Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-white">
                      Service History
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        ({autoActual.historial.length})
                      </span>
                    </h3>
                    <button
                      onClick={() => setShowNewService(true)}
                      className="flex items-center gap-1.5 text-sm font-black min-h-[48px] px-4 rounded-xl transition active:scale-95 border border-sky-500/30 hover:bg-sky-500/10 text-sky-400"
                    >
                      <Plus size={16} /> Add Service
                    </button>
                  </div>

                  {/* Empty state */}
                  {autoActual.historial.length === 0 ? (
                    <div className="bg-[#111] border border-dashed border-[#2a2a2a] rounded-2xl p-10 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0a0a0a] border border-[#1e1e1e] flex items-center justify-center">
                        <ClipboardList size={32} className="text-slate-600" />
                      </div>
                      <p className="text-slate-400 text-base font-bold">No service records yet</p>
                      <p className="text-slate-600 text-sm mt-1 max-w-xs mx-auto">Create the first invoice for this vehicle to start building a service history</p>
                      <button onClick={() => setShowNewService(true)}
                        className="mt-5 text-white font-black text-sm px-6 min-h-[48px] rounded-xl transition active:scale-95 shadow-lg inline-flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' }}>
                        <Plus size={16} /> Create First Invoice
                      </button>
                    </div>
                  ) : (
                    /* ── History Cards — Image 1 inspired ── */
                    <div className="space-y-3">
                      {autoActual.historial.map((serv) => (
                        <div
                          key={serv.id}
                          id={`serv-card-${serv.id}`}
                          className="bg-[#111] rounded-2xl border border-[#1e1e1e] overflow-hidden
                                     hover:border-sky-500/30 hover:shadow-lg hover:shadow-black/40
                                     transition group"
                        >
                          {/* Card Header — cobalt/sky bar with invoice # */}
                          <div
                            className="px-4 py-3 flex items-center justify-between"
                            style={{
                              background: serv.tipo === 'Estimate'
                                ? 'linear-gradient(135deg, #0369a1, #0284c7)'
                                : 'linear-gradient(135deg, #065f46, #059669)'
                            }}
                          >
                            <span className="font-mono font-black text-white text-sm tracking-widest">
                              {serv.invoiceNumber}
                            </span>
                            <TipoBadge tipo={serv.tipo} />
                          </div>

                          {/* Card Body */}
                          <div className="px-4 py-3 space-y-2 text-sm">
                            {[
                              { label: 'Date', value: fmtDate(serv.fecha) },
                              { label: 'Mileage', value: `${(serv.kilometrajeEntrada || 0).toLocaleString()} → ${(serv.kilometrajeSalida || 0).toLocaleString()} mi` },
                              { label: 'Payment', value: serv.metodoPago || '—' },
                              { label: 'Tech', value: serv.tecnico || '—' },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex justify-between">
                                <span className="text-slate-500">{label}:</span>
                                <span className="text-slate-200 font-medium">{value}</span>
                              </div>
                            ))}

                            {serv.observaciones && (
                              <p className="text-xs text-slate-600 italic line-clamp-2 pt-1 border-t border-[#1e1e1e]">
                                {serv.observaciones}
                              </p>
                            )}

                            {((serv.fotos && serv.fotos.length > 0) || serv.facturaImg) && (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                                <Camera size={12} />
                                <span>
                                  {serv.fotos && serv.fotos.length > 0
                                    ? `${serv.fotos.length} photo${serv.fotos.length > 1 ? 's' : ''} attached`
                                    : 'Invoice photo attached'}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Card Footer */}
                          <div className="border-t border-[#1e1e1e] px-4 py-3 flex items-center justify-between">
                            <div>
                              <p className="text-2xl font-black text-white tabular-nums">{fmt(serv.total)}</p>
                              {serv.isAnulada ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black bg-red-500/20 text-red-400 px-2 py-0.5 rounded-md border border-red-500/30 mt-0.5">
                                  🚫 Anulada (Saldo $0.00)
                                </span>
                              ) : serv.saldo > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black bg-red-500/20 text-red-400 px-2 py-0.5 rounded-md border border-red-500/30 mt-0.5">
                                  ⚠ Due: {fmt(serv.saldo)}
                                </span>
                              ) : serv.total > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/30 mt-0.5">
                                  ✓ Paid in full
                                </span>
                              ) : null}
                            </div>

                            <button
                              onClick={() => setSelectedService(serv)}
                              className="flex items-center gap-2 text-white font-black text-sm
                                         px-4 min-h-[48px] rounded-xl transition active:scale-95 shadow-md"
                              style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #38bdf8)' }}
                            >
                              View Details →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ════════════════════════════════════════════════
                  VIEW C — VEHICLES LIST
              ════════════════════════════════════════════════ */}
              {vista === 'vehicles' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black text-white">All Vehicles</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(vehiculos).map((v) => (
                      <button
                        key={v.placa}
                        onClick={() => { setAutoActual(v); setVista('profile'); }}
                        className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 text-left
                                   hover:border-sky-500/40 hover:bg-[#161616] transition
                                   flex items-center gap-3 group active:scale-95"
                      >
                        <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 p-1.5 shadow-sm">
                          <BrandLogo make={v.marca} size="md" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white text-sm group-hover:text-sky-400 transition truncate">
                            {v.marca} {v.modelo}
                          </p>
                          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">
                            {v.placa} &bull; {v.anio} &bull; {v.color}
                          </p>
                        </div>
                        <ChevronRight size={15} className="text-slate-700 group-hover:text-sky-400 flex-shrink-0 transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════
                  VIEW D — CUSTOMERS LIST
              ════════════════════════════════════════════════ */}
              {vista === 'customers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white">
                      All Customers ({uniqueCustomers.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {uniqueCustomers.map((cust) => (
                      <div
                        key={cust.id || cust.nombre}
                        className="bg-[#111] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl p-4 flex flex-col justify-between transition"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-white text-base">{cust.nombre}</p>
                              {cust.direccion && (
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {cust.direccion}{cust.ciudad ? `, ${cust.ciudad}` : ''}{cust.estado ? ` ${cust.estado}` : ''}{cust.zip ? ` ${cust.zip}` : ''}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => setEditingCustomerData({ customer: cust, vehiclePlate: cust.vehiculos[0]?.placa })}
                              className="text-xs text-sky-400 hover:text-sky-300 py-1 px-2.5 hover:bg-sky-500/10 rounded-lg transition flex items-center gap-1.5 border border-sky-500/20 active:scale-95 cursor-pointer flex-shrink-0"
                              title="Editar cliente"
                            >
                              <Pencil size={12} />
                              <span>Editar</span>
                            </button>
                          </div>
                          {cust.telefono && <p className="text-xs text-slate-400 mt-2">📞 {cust.telefono}</p>}
                          {cust.email && <p className="text-xs text-slate-500 truncate mt-0.5">✉️ {cust.email}</p>}
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#1a1a1a]">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Vehículos asociados ({cust.vehiculos.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {cust.vehiculos.map((v) => (
                              <button
                                key={v.placa}
                                onClick={() => { setAutoActual(v); setVista('profile'); }}
                                className="text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 hover:border-sky-500/40 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 active:scale-95"
                                title={`Ver vehículo ${v.marca} ${v.modelo}`}
                              >
                                <Car size={12} />
                                <span>{v.marca ? `${v.marca} ${v.modelo}` : ''} ({v.placa.toUpperCase()})</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════════════════════════════════════════════
                  VIEW E — SERVICES LIST
              ════════════════════════════════════════════════ */}
              {vista === 'services' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black text-white">All Services</h2>
                  <div className="space-y-3">
                    {Object.values(vehiculos).flatMap(v => v.historial.map(s => ({ ...s, vehicle: v }))).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map((serv) => (
                      <div
                        key={serv.id}
                        className="bg-[#111] rounded-2xl border border-[#1e1e1e] overflow-hidden
                                   hover:border-sky-500/30 hover:shadow-lg hover:shadow-black/40
                                   transition group flex flex-col sm:flex-row"
                      >
                        <div className="p-4 flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex-shrink-0">
                            <TipoBadge tipo={serv.tipo} />
                            <p className="font-mono font-black text-white text-sm tracking-widest mt-1">
                              {serv.invoiceNumber}
                            </p>
                            <p className="text-xs text-slate-500">{fmtDate(serv.fecha)}</p>
                          </div>

                          <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-[#1e1e1e] pt-3 sm:pt-0 sm:pl-4">
                            <p className="font-bold text-white text-sm truncate">
                              {serv.vehicle.marca} {serv.vehicle.modelo} ({serv.vehicle.placa.toUpperCase()})
                            </p>
                            <p className="text-xs text-slate-400 truncate">{serv.vehicle.cliente.nombre}</p>
                            <p className="text-xs text-slate-500 mt-1">{serv.metodoPago}</p>
                          </div>
                        </div>

                        <div className="border-t sm:border-t-0 sm:border-l border-[#1e1e1e] p-4 flex flex-row sm:flex-col items-center sm:items-end justify-between bg-black/20 sm:w-44">
                          <div className="text-left sm:text-right">
                            <p className="text-lg font-black text-white tabular-nums">{fmt(serv.total)}</p>
                            {serv.isAnulada ? (
                              <p className="text-xs text-red-400 font-bold">🚫 Anulada</p>
                            ) : serv.saldo > 0 ? (
                              <p className="text-xs text-red-400 font-semibold">Due: {fmt(serv.saldo)}</p>
                            ) : serv.total > 0 ? (
                              <p className="text-xs text-emerald-500 font-semibold">Paid</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <button
                              onClick={() => {
                                setEditingService(serv);
                              }}
                              className="text-xs font-bold text-sky-400 hover:text-sky-300 p-1.5 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg border border-sky-500/25 transition active:scale-95 cursor-pointer"
                              title="Editar Factura / Cotización"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleViewInvoice(serv)}
                              className="text-xs font-bold text-sky-400 hover:text-sky-300 py-1.5 px-2 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg border border-sky-500/25 transition flex items-center gap-1 active:scale-95 cursor-pointer"
                              title="Ver e Imprimir PDF"
                            >
                              <FileText size={13} />
                              <span>PDF</span>
                            </button>
                            <button
                              onClick={() => setSelectedService(serv)}
                              className="text-xs font-bold text-slate-300 hover:text-white py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition active:scale-95 cursor-pointer"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* ── Mobile Floating Action Bar (temporarily hidden per user request) ── */}
          {/*
          {vista === 'profile' && autoActual && (
            <div className="fab-bar md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111]/95 backdrop-blur-md border-t border-[#1e1e1e] px-4 py-3 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
                 style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <button
                onClick={() => setShowNewService(true)}
                className="flex-1 flex items-center justify-center gap-2 text-white font-black text-sm min-h-[48px] rounded-xl transition active:scale-95 shadow-lg"
                style={{ background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%)' }}
              >
                <Plus size={18} /> New Invoice
              </button>
              {autoActual.cliente?.telefono && (
                <a
                  href={`tel:${autoActual.cliente.telefono}`}
                  className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm min-h-[48px] px-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 transition active:scale-95"
                >
                  <Phone size={16} /> Call
                </a>
              )}
            </div>
          )}
          */}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════ */}


      {showEditVehicle && autoActual && (
        <EditVehicleModal
          vehicle={autoActual}
          onSave={handleSaveVehicleEdit}
          onClose={() => setShowEditVehicle(false)}
        />
      )}

      {showNewVehicle && (
        <NewVehicleModal
          placaInicial={busqueda}
          onSave={handleSaveVehiculo}
          onClose={() => setShowNewVehicle(false)}
        />
      )}

      {(showNewService || editingService) && (editingService?.vehicle || autoActual) && (
        <NewServiceModal
          vehicle={editingService?.vehicle || autoActual}
          nextInvoiceNumber={getNextInvoiceNumber()}
          serviceToEdit={editingService}
          onSave={handleSaveServicio}
          onClose={() => {
            setShowNewService(false);
            setEditingService(null);
          }}
        />
      )}

      {/* ── Record Payment Modal ── */}
      {paymentModalData && (
        <RecordPaymentModal
          service={paymentModalData.service}
          vehicle={paymentModalData.vehicle}
          onSave={(updatedService) => handleSavePayment(updatedService, paymentModalData.vehicle?.placa)}
          onClose={() => setPaymentModalData(null)}
        />
      )}

      {/* ── Edit Customer Modal ── */}
      {editingCustomerData && (
        <EditCustomerModal
          customer={editingCustomerData.customer}
          onSave={(updatedCustomer) => handleSaveCustomer(updatedCustomer, editingCustomerData.vehiclePlate)}
          onClose={() => setEditingCustomerData(null)}
        />
      )}

      {/* ── Import JSON Modal ── */}
      {showImportJson && (
        <ImportJsonModal
          isOpen={showImportJson}
          onClose={() => setShowImportJson(false)}
          onImportComplete={async () => {
            const { data } = await getAllVehicles();
            if (data) {
              const map = {};
              data.forEach((v) => {
                if (v && v.placa) map[v.placa] = v;
              });
              setVehiculos(map);
            }
            setShowImportJson(false);
          }}
        />
      )}

      {/* ── Service Detail Modal ── */}
      {selectedService && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => e.target === e.currentTarget && setSelectedService(null)}
        >
          <div className="bg-[#111] w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto border border-[#2a2a2a] shadow-2xl">

            {/* Cobalt & Sky Blue header */}
            <div
              className="px-5 py-4 flex justify-between items-center"
              style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb, #38bdf8)' }}
            >
              <div>
                <p className="font-mono font-black text-white text-lg tracking-widest">
                  {selectedService.invoiceNumber}
                </p>
                <p className="text-xs text-sky-100/90">
                  {fmtDate(selectedService.fecha)} &bull; {selectedService.metodoPago}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <TipoBadge tipo={selectedService.tipo} />
                <button
                  onClick={() => setSelectedService(null)}
                  className="text-white hover:text-sky-200 p-1.5 rounded-lg hover:bg-black/20 transition"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">

              {/* Mileage */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Mileage In', val: selectedService.kilometrajeEntrada },
                  { label: 'Mileage Out', val: selectedService.kilometrajeSalida },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                    <p className="text-white font-bold text-lg tabular-nums">{(val || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Line Items */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Work Items</p>
                <div className="border border-[#1e1e1e] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[24px_1fr_76px] bg-[#0a0a0a] border-b border-[#1e1e1e] text-xs font-bold text-slate-500 px-3 py-2 uppercase tracking-wider">
                    <span>Q</span><span>Description</span><span className="text-right">Amt</span>
                  </div>
                  {(selectedService.lineas || []).map((l, i) => (
                    <div key={i} className="grid grid-cols-[24px_1fr_76px] text-xs px-3 py-2.5 border-b border-[#1a1a1a] last:border-b-0">
                      <span className="text-slate-500 font-mono">{l.qty}</span>
                      <div className="min-w-0 pr-2">
                        <p className="text-white font-medium truncate">{l.descripcion}</p>
                        {l.partNo && <p className="text-slate-600 font-mono text-[10px]">{l.partNo}</p>}
                      </div>
                      <span className="text-right text-slate-300 font-bold tabular-nums">{fmt(l.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financials */}
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4 space-y-2">
                {[
                  { l: 'Subtotal', v: selectedService.subtotal },
                  { l: 'Tax', v: selectedService.impuesto },
                ].map(({ l, v }) => (
                  <div key={l} className="flex justify-between text-sm text-slate-500">
                    <span>{l}</span><span className="tabular-nums">{fmt(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-black text-white border-t border-[#1e1e1e] pt-2">
                  <span>TOTAL</span><span className="tabular-nums">{fmt(selectedService.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Deposit</span><span className="tabular-nums">-{fmt(selectedService.deposito)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold border-t border-[#1e1e1e] pt-2">
                  <span className={selectedService.saldo > 0 ? 'text-red-400' : 'text-emerald-400'}>Balance Due</span>
                  <div className="flex items-center gap-3">
                    {selectedService.saldo > 0 && (
                      <button
                        onClick={() => {
                          const v = Object.values(vehiculos).find(veh => veh.historial.some(s => s.id === selectedService.id));
                          if (v) setPaymentModalData({ service: selectedService, vehicle: v });
                        }}
                        className="text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-500/30 transition border border-emerald-500/30 flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                      >
                        <DollarSign size={13} /> Cobrar Saldo
                      </button>
                    )}
                    <span className={`tabular-nums ${selectedService.saldo > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {fmt(selectedService.saldo)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {selectedService.observaciones && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-sky-400">
                    <AlertCircle size={13} /> Recommendations &amp; Notes
                  </p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedService.observaciones}
                  </p>
                  {selectedService.tecnico && (
                    <p className="text-xs text-sky-400 mt-2 pt-2 border-t border-slate-800">
                      Technician: {selectedService.tecnico}
                    </p>
                  )}
                </div>
              )}

              {/* Photo Attachments Studio Gallery & Uploader */}
              <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera size={14} className="text-sky-400" />
                    Fotos y Documentos ({selectedService.fotos?.length || (selectedService.facturaImg ? 1 : 0)})
                  </p>
                  <div>
                    <input
                      type="file"
                      ref={invoicePhotoInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleAttachInvoicePhoto}
                      disabled={isUploadingInvoicePhoto}
                    />
                    <button
                      type="button"
                      onClick={() => invoicePhotoInputRef.current?.click()}
                      disabled={isUploadingInvoicePhoto}
                      className="text-xs font-bold text-sky-400 hover:text-sky-300 py-1.5 px-3 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingInvoicePhoto ? (
                        <>
                          <span className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                          <span>Subiendo...</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>Adjuntar Factura</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {((selectedService.fotos && selectedService.fotos.length > 0) || selectedService.facturaImg) ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {selectedService.fotos && selectedService.fotos.length > 0 ? (
                      selectedService.fotos.map((f, i) => (
                        <div
                          key={f.id || i}
                          onClick={() => setLightboxPhoto(f)}
                          className="group relative cursor-pointer rounded-xl overflow-hidden border border-[#222] bg-[#0a0a0a] hover:border-sky-500/50 transition"
                        >
                          <img
                            src={f.url}
                            alt={f.caption || f.categoriaLabel || 'Attachment'}
                            className="w-full h-24 object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 p-2 flex flex-col justify-between">
                            <span className="self-start bg-black/75 text-[10px] text-white px-2 py-0.5 rounded font-semibold border border-white/10">
                              {f.categoriaLabel || 'Factura'}
                            </span>
                            {f.caption && (
                              <p className="text-[10px] text-slate-200 line-clamp-1 font-medium">
                                {f.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        onClick={() => setLightboxPhoto({ url: selectedService.facturaImg, categoriaLabel: 'Invoice Snapshot' })}
                        className="col-span-full cursor-pointer rounded-xl overflow-hidden border border-[#222] hover:border-sky-500/50 transition"
                      >
                        <img src={selectedService.facturaImg} alt="Invoice" className="w-full max-h-48 object-cover" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => invoicePhotoInputRef.current?.click()}
                    className="border border-dashed border-[#2a2a2a] hover:border-sky-500/40 rounded-xl p-4 text-center cursor-pointer transition bg-black/20 hover:bg-sky-500/5 group"
                  >
                    <Camera size={22} className="mx-auto text-slate-500 group-hover:text-sky-400 transition mb-1.5" />
                    <p className="text-xs text-slate-400 font-medium">No hay fotos o factura adjunta todavía</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Haz clic aquí para subir la foto original de la factura</p>
                  </div>
                )}
              </div>

              {/* Annulled alert if applicable */}
              {selectedService.isAnulada && (
                <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-4 flex items-start gap-3">
                  <Ban size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-300 uppercase tracking-wider">
                      Factura Anulada / Cancelada
                    </p>
                    <p className="text-xs text-red-400 mt-0.5 leading-relaxed">
                      Esta factura no genera saldo pendiente ni computa en ingresos.
                      {selectedService.motivoAnulacion && (
                        <span className="block mt-1 text-slate-300 font-normal">
                          <strong>Motivo:</strong> {selectedService.motivoAnulacion}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Administrative Actions Bar */}
              <div className="border-t border-[#1e1e1e] pt-4 space-y-2.5">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acciones de Factura</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const veh = selectedService.vehicle || autoActual || Object.values(vehiculos).find(v => (v.historial || []).some(s => s.id === selectedService.id));
                      setEditingService({ ...selectedService, vehicle: veh });
                      setSelectedService(null);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm"
                  >
                    <Pencil size={13} />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleViewInvoice(selectedService)}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 font-bold text-xs transition active:scale-95 cursor-pointer"
                  >
                    <FileText size={13} />
                    <span>PDF / Print</span>
                  </button>

                  {!selectedService.isAnulada ? (
                    <button
                      type="button"
                      onClick={() => {
                        const veh = selectedService.vehicle || autoActual || Object.values(vehiculos).find(v => (v.historial || []).some(s => s.id === selectedService.id));
                        handleOpenVoidModal(selectedService, veh);
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 font-bold text-xs transition active:scale-95 cursor-pointer"
                      title="Anular factura conservando folio para auditoría"
                    >
                      <Ban size={13} />
                      <span>Anular</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-center text-[11px] font-bold text-slate-600 bg-black/40 border border-[#222] rounded-xl py-2.5">
                      Anulada
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const veh = selectedService.vehicle || autoActual || Object.values(vehiculos).find(v => (v.historial || []).some(s => s.id === selectedService.id));
                      handleOpenDeleteModal(selectedService, veh);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 font-bold text-xs transition active:scale-95 cursor-pointer"
                    title="Eliminar de la base de datos"
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Void / Anular Modal (Enterprise Standard Method 1) ── */}
      {voidModalData && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && !isVoiding && setVoidModalData(null)}
        >
          <div className="bg-[#111] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 flex-shrink-0">
                <Ban size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Anular Factura {voidModalData.service.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Estándar empresarial: el folio se mantendrá con saldo $0.00 en la base de datos para no alterar la secuencia ni generar huecos contables.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Motivo de anulación
              </label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Ej: Cancelada por cliente, Error en piezas..."
                disabled={isVoiding}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none transition"
              />
            </div>

            {voidError && (
              <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-400">
                {voidError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVoidModalData(null)}
                disabled={isVoiding}
                className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-slate-400 font-semibold hover:bg-white/5 transition text-xs active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={isVoiding}
                className="flex-[1.5] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              >
                {isVoiding ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Anulando…</span>
                  </>
                ) : (
                  <>
                    <Ban size={14} />
                    <span>Confirmar Anulación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal (Permanent Hard Delete) ── */}
      {deleteModalData && (
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[90] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && !isDeleting && setDeleteModalData(null)}
        >
          <div className="bg-[#111] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 flex-shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  ¿Eliminar {deleteModalData.service.tipo === 'Estimate' ? 'Cotización' : 'Factura'}?
                </h3>
                <p className="font-mono text-xs text-rose-400 font-bold mt-0.5">
                  {deleteModalData.service.invoiceNumber}
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  ⚠️ Esta acción borrará permanentemente este registro y sus líneas de trabajo en Supabase.
                  Esta operación <strong>no se puede deshacer</strong>.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-400">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalData(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-[#2a2a2a] text-slate-400 font-semibold hover:bg-white/5 transition text-xs active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-[1.5] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Eliminar Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Lightbox Modal ── */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-[80] flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition"
              aria-label="Cerrar vista previa"
            >
              <X size={20} />
            </button>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || 'Expanded Photo'}
              className="max-w-full max-h-[80vh] rounded-2xl object-contain border border-[#333] shadow-2xl"
            />
            {(lightboxPhoto.categoriaLabel || lightboxPhoto.caption) && (
              <div className="mt-3 bg-[#111] border border-[#222] px-4 py-2 rounded-xl text-center">
                {lightboxPhoto.categoriaLabel && (
                  <span className="text-xs text-sky-400 font-bold uppercase tracking-wider mr-2">
                    {lightboxPhoto.categoriaLabel}
                  </span>
                )}
                {lightboxPhoto.caption && (
                  <span className="text-xs text-slate-300">
                    {lightboxPhoto.caption}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}