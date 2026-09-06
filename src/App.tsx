import React, { useEffect, useState } from 'react';
import {
  Wrench,
  Shield,
  Database,
  CheckCircle2,
  ShoppingCart,
  ShoppingBag,
  Package,
  Truck,
  Users,
  BarChart3,
  UserCog,
  Settings,
  ShieldCheck,
  LayoutDashboard,
  AlertTriangle,
  Layers,
  LogOut,
  Menu,
  Lock,
  Clock,
} from 'lucide-react';

import { UserSession, Product, Category, ShiftSummaryData } from './types/ipc';
import { AuthBanner } from './components/AuthBanner';
import { LoginView } from './components/auth/LoginView';
import { PinLoginScreen } from './components/auth/PinLoginScreen';
import { ShiftModal } from './components/shifts/ShiftModal';
import { ShiftsHistoryView } from './components/shifts/ShiftsHistoryView';
import { DashboardView } from './components/dashboard/DashboardView';
import { PosView } from './components/pos/PosView';
import { SalesHistoryView } from './components/pos/SalesHistoryView';
import { ProductsView } from './components/products/ProductsView';
import { CategoriesView } from './components/products/CategoriesView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { CustomersView } from './components/customers/CustomersView';
import { ReportsView } from './components/reports/ReportsView';
import { UsersView } from './components/users/UsersView';
import { SettingsView } from './components/settings/SettingsView';
import { AuditLogView } from './components/audit/AuditLogView';
import { SyncStatusBadge } from './components/sync/SyncStatusBadge';
import { SyncSettingsModal } from './components/sync/SyncSettingsModal';
import { FirstRunWizardModal } from './components/wizard/FirstRunWizardModal';
import { ToastProvider } from './context/ToastContext';
import { Language, translations } from './i18n/translations';
import { BrandLogoIcon, StaffAvatarIcon } from './components/pos/PosIcons';

export default function App() {

  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}

function MainApp() {
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'pos' | 'sales' | 'customers' | 'products' | 'categories' | 'suppliers' | 'reports' | 'shifts' | 'users' | 'settings' | 'audit'
  >('dashboard');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [dueCustomerCount, setDueCustomerCount] = useState<number>(0);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lang, setLang] = useState<Language>('en');

  // Shift & Quick Lock State
  const [activeShift, setActiveShift] = useState<ShiftSummaryData | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState<'view' | 'open' | 'close'>('view');
  const [isLocked, setIsLocked] = useState(false);
  const [authMode, setAuthMode] = useState<'pin' | 'password'>('password'); // Password login by default!
  const [nowTicker, setNowTicker] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTicker(Date.now()), 15000);
    
    // Globally prevent number inputs from changing value on mouse wheel scroll
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (
        document.activeElement === target &&
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type === 'number'
      ) {
        (target as HTMLInputElement).blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      clearInterval(timer);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const formatShiftDuration = (openedAt?: string) => {
    if (!openedAt) return '';
    const diffMs = Math.max(0, nowTicker - new Date(openedAt).getTime());
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const isElectron = Boolean(window.api && window.api.ping);

  const t = translations[lang];

  const fetchCatalog = async () => {
    if (!window.api) return;
    setLoading(true);
    try {
      const [prods, cats, dueSummary] = await Promise.all([
        window.api.products.list(),
        window.api.categories.list(),
        window.api.customers.getDueSummary().catch(() => null),
      ]);
      setProducts(prods);
      setCategories(cats);
      if (dueSummary) {
        setDueCustomerCount(dueSummary.customers_with_due_count || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const [enableShifts, setEnableShifts] = useState(true);

  const fetchActiveShift = async () => {
    if (!window.api || !window.api.shifts) return null;
    try {
      const curr = await window.api.shifts.getCurrent();
      setActiveShift(curr);
      return curr;
    } catch (err) {
      console.error('Failed to fetch active shift:', err);
      return null;
    }
  };

  useEffect(() => {
    if (window.api) {
      // Check first-run status
      window.api.wizard?.checkStatus().then((res) => {
        if (res.isFirstRun) {
          setShowWizardModal(true);
        }
      });

      // Check current session WITHOUT auto-login
      window.api.auth.getSession().then(async (sess) => {
        if (sess) {
          setCurrentSession(sess);
          fetchCatalog();
          let shiftsEnabled = true;
          if (window.api.settings) {
            const s = await window.api.settings.get();
            shiftsEnabled = s.enable_shifts ?? true;
            setEnableShifts(shiftsEnabled);
          }
          const currShift = await fetchActiveShift();
          if (sess.role === 'staff') {
            setActiveTab('pos');
          }
          if (!currShift && shiftsEnabled) {
            setShiftModalMode('open');
            setShowShiftModal(true);
          }
        }
      });
    }
  }, []);

  // Global F1 shortcut to Lock terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' && currentSession && !isLocked) {
        e.preventDefault();
        setAuthMode(currentSession.has_pin ? 'pin' : 'password');
        setIsLocked(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSession, isLocked]);

  const handleLoginSuccess = async (sess: UserSession) => {
    setCurrentSession(sess);
    setIsLocked(false);
    fetchCatalog();
    let shiftsEnabled = enableShifts;
    if (window.api && window.api.settings) {
      const s = await window.api.settings.get();
      shiftsEnabled = s.enable_shifts ?? true;
      setEnableShifts(shiftsEnabled);
    }
    const currShift = await fetchActiveShift();
    if (sess.role === 'staff') {
      setActiveTab('pos');
    } else {
      setActiveTab('dashboard');
    }
    // If no shift is open, prompt for opening float
    if (!currShift && shiftsEnabled) {
      setShiftModalMode('open');
      setShowShiftModal(true);
    }
  };

  const handleLogout = async () => {
    if (!window.api) return;
    try {
      await window.api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setCurrentSession(null);
    setIsLocked(false);
    setAuthMode('password'); // Strictly require Username & Password on next login after logout!
    setActiveShift(null);
    setProducts([]);
    setCategories([]);
    setActiveTab('dashboard');
  };

  const handleSettingsChanged = async () => {
    if (window.api && window.api.settings) {
      const s = await window.api.settings.get();
      setEnableShifts(s.enable_shifts ?? true);
    }
  };

  const handleAddCategory = async (name: string): Promise<Category | null> => {
    if (!window.api) return null;
    try {
      const cat = await window.api.categories.create(name);
      setCategories((prev) => [...prev, cat]);
      return cat;
    } catch (err: any) {
      console.error('Failed to add category:', err);
      return null;
    }
  };

  const handleUpdateCategory = async (id: string, name: string): Promise<boolean> => {
    if (!window.api) return false;
    try {
      const updated = await window.api.categories.update(id, name);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: updated.name } : c)));
      return true;
    } catch (err: any) {
      console.error("Failed to rename category:", err);
      throw err;
    }
  };

  const handleDeleteCategory = async (id: string): Promise<boolean> => {
    if (!window.api) return false;
    try {
      await window.api.categories.remove(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      fetchCatalog();
      return true;
    } catch (err: any) {
      console.error("Failed to delete category:", err);
      throw err;
    }
  };

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'bn' ? 'en' : 'bn'));
  };

  // If user is not authenticated or counter is locked, render Lock / PIN Screen
  if (!currentSession || isLocked) {
    if (authMode === 'pin') {
      return (
        <>
          <PinLoginScreen
            onLoginSuccess={handleLoginSuccess}
            onSwitchToPasswordLogin={() => setAuthMode('password')}
          />
          <FirstRunWizardModal
            isOpen={showWizardModal}
            onCompleted={() => {
              setShowWizardModal(false);
              fetchCatalog();
            }}
          />
        </>
      );
    }

    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
          onLanguageToggle={toggleLanguage}
          onSwitchToPinLogin={() => setAuthMode('pin')}
        />
        <FirstRunWizardModal
          isOpen={showWizardModal}
          onCompleted={() => {
            setShowWizardModal(false);
            fetchCatalog();
          }}
        />
      </>
    );
  }

  const isOwner = currentSession.role === 'owner';
  const lowStockCount = products.filter((p) => p.stock_qty <= (p.low_stock_threshold ?? 5)).length;

  // The menu as data. Sections are ordered by how often a shop actually reaches
  // for them: counter work all day, stock now and then, records at closing, admin
  // rarely. Items the signed-in role cannot open are dropped rather than shown
  // disabled, and a section with nothing left in it disappears with them.
  const navSections: {
    key: string;
    heading: string;
    items: {
      id: typeof activeTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number | string;
      badgeTone?: 'warn' | 'due' | 'muted';
      badgeTitle?: string;
    }[];
  }[] = [
    {
      key: 'counter',
      heading: t.secOperations,
      items: [
        { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
        { id: 'pos', label: t.navPos, icon: ShoppingCart },
        {
          id: 'customers',
          label: t.navCustomers,
          icon: Users,
          badge: dueCustomerCount > 0 ? dueCustomerCount : undefined,
          badgeTone: 'due',
          badgeTitle: `${dueCustomerCount} customers carrying a due balance`,
        },
      ],
    },
    {
      key: 'stock',
      heading: t.secCatalog,
      items: [
        {
          id: 'products',
          label: t.navProducts,
          icon: Package,
          badge: lowStockCount > 0 ? lowStockCount : undefined,
          badgeTone: 'warn',
          badgeTitle: `${lowStockCount} items below minimum stock threshold`,
        },
        { id: 'categories', label: t.navCategories, icon: Layers, badge: categories.length, badgeTone: 'muted' },
        ...(isOwner ? [{ id: 'suppliers' as const, label: t.navSuppliers, icon: Truck }] : []),
      ],
    },
    {
      key: 'records',
      heading: t.secReports,
      items: [
        { id: 'reports', label: t.navReports, icon: BarChart3 },
        { id: 'sales', label: t.navSales, icon: ShoppingBag },
        ...(enableShifts ? [{ id: 'shifts' as const, label: t.navShifts, icon: Clock }] : []),
      ],
    },
    ...(isOwner
      ? [{
          key: 'admin',
          heading: t.secAdmin,
          items: [
            { id: 'settings' as const, label: t.navSettings, icon: Settings },
            { id: 'users' as const, label: t.navUsers, icon: UserCog },
            { id: 'audit' as const, label: t.navAudit, icon: ShieldCheck },
          ],
        }]
      : []),
  ];

  return (

    <div className="h-screen w-screen flex flex-col bg-jungle-teal-100/90 text-jungle-teal-900 font-sans overflow-hidden select-none">
      {!isElectron && (
        <div className="shrink-0 bg-amber-500 text-jungle-teal-950 px-4 py-1 text-xs font-mono font-bold flex items-center justify-between border-b border-amber-600 shadow-xs">
          <span>⚠️ Web Browser Preview Mode. SQLite DB active natively in Electron.</span>
          <span className="text-[11px] bg-black/20 px-2 py-0.5 rounded-sm">npm run electron:dev</span>
        </div>
      )}

      {/* Body: fixed left rail + scrolling viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

      {/* Main Unified Navigation Sidebar */}
      <aside
        className={`shrink-0 ${
          sidebarOpen ? 'w-[192px]' : 'w-[56px]'
        } bg-jungle-teal-50 border-r border-jungle-teal-200 shadow-xs flex flex-col min-h-0 select-none overflow-hidden transition-[width] duration-[240ms] ease-in-out`}
      >
        {/* Brand. One row rather than three: the title, tagline and version
            badge each had their own line and pushed the menu itself down the
            rail. Version now sits with the profile in the footer. */}
        <div className="shrink-0 px-2 py-2 border-b border-jungle-teal-200">
          <div className="flex items-center gap-1.5">
            {/* Rail toggle. Kept leftmost so it stays on screen when the rail
                collapses - a toggle further right would be clipped away and
                there would be nothing left to click to reopen. */}
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
              aria-label={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
              aria-expanded={sidebarOpen}
              className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-jungle-teal-600 hover:text-jungle-teal-900 hover:bg-jungle-teal-100 transition-colors"
            >
              <Menu className="w-[18px] h-[18px]" />
            </button>

            {sidebarOpen && (
              <>
                <BrandLogoIcon className="w-7 h-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-ui-xs font-bold tracking-tight text-jungle-teal-900 font-sans truncate leading-tight">
                    Mechanical Shop POS
                  </h1>
                  {isOwner && <SyncStatusBadge onOpenSyncModal={() => setShowSyncModal(true)} />}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Primary navigation.
            Grouped rather than one flat list of thirteen: reports and history
            screens read as reports, admin screens as admin, and the counter
            work the cashier does all day sits at the top. Every row shares one
            definition below, so an item cannot drift out of style from the
            rest - previously each button carried its own copy of the classes. */}
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col p-1.5 text-ui-sm font-medium">

          {/* Shift Status & Drawer Button */}
          {enableShifts && (
            <button
              type="button"
              onClick={() => {
                if (activeShift) {
                  setShiftModalMode('view');
                } else {
                  setShiftModalMode('open');
                }
                setShowShiftModal(true);
              }}
              className={`${sidebarOpen ? 'w-full' : 'w-10'} px-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition-colors text-left overflow-hidden whitespace-nowrap mb-1.5 ${
                activeShift
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                  : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
              }`}
              title={activeShift ? `Shift Active: ৳ ${(activeShift.expected_cash_paisa / 100).toFixed(2)}` : 'Shift Closed - Click to Open'}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${activeShift ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`} />
              {sidebarOpen && (
                <div className="min-w-0 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-1 leading-none">
                    <span className="text-[9.5px] uppercase font-bold tracking-wider text-jungle-teal-700">
                      {activeShift ? 'Shift Active' : 'Shift Closed'}
                    </span>
                    {activeShift && (
                      <span className="text-[9.5px] font-mono text-emerald-800 font-bold bg-emerald-100/90 px-1 py-0.2 rounded">
                        {formatShiftDuration(activeShift.opened_at)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-extrabold truncate mt-0.5">
                    {activeShift ? `৳ ${(activeShift.expected_cash_paisa / 100).toLocaleString('en-US')}` : 'Start Shift'}
                  </span>
                </div>
              )}
            </button>
          )}

          {navSections.map((section, sectionIndex) => (
            <div key={section.key} className="flex flex-col">
              {sidebarOpen ? (
                <span className="px-3 pt-3 pb-1 text-ui-2xs font-mono uppercase tracking-[0.14em] text-jungle-teal-400 select-none">
                  {section.heading}
                </span>
              ) : (
                sectionIndex > 0 && <span className="my-1.5 mx-2 border-t border-jungle-teal-200" />
              )}

              {section.items.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={sidebarOpen ? undefined : item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-1.5 mb-0.5 rounded-lg flex items-center gap-2.5 transition-colors text-left overflow-hidden whitespace-nowrap ${
                      active
                        ? 'bg-muted-teal-800 text-white font-semibold'
                        : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
                    }`}
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                    {sidebarOpen && item.badge != null && (
                      <span
                        className={`ml-auto shrink-0 px-1.5 rounded-full text-[10px] font-mono font-bold border ${
                          active
                            ? 'bg-white/15 text-white border-white/25'
                            : item.badgeTone === 'warn'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : item.badgeTone === 'due'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-jungle-teal-100 text-jungle-teal-600 border-jungle-teal-200'
                        }`}
                        title={item.badgeTitle}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer Tools (Language, Theme, User Profile) */}
        <div className="shrink-0 border-t border-jungle-teal-200 p-2 space-y-2">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              {/* Language Selector Button */}
              <button
                onClick={toggleLanguage}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-jungle-teal-50 hover:bg-jungle-teal-100 border border-jungle-teal-200 text-ui-xs font-semibold text-jungle-teal-700 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>🌐</span>
                <span className="truncate">{lang === 'bn' ? 'বাংলা' : 'English'}</span>
                <span className="ml-auto text-ui-2xs text-jungle-teal-400">▾</span>
              </button>

              {/* Theme Toggle Button (Light/Sun) */}
              <div className="p-1.5 rounded-xl bg-jungle-teal-50 border border-jungle-teal-200 text-amber-500 shadow-xs flex items-center justify-center shrink-0">
                <span className="text-ui-sm">☀️</span>
              </div>
            </div>
          )}

          {/* User Profile Badge with Dropdown */}
          <div className="relative">
            <button
              onClick={() => (sidebarOpen ? setShowUserMenu(!showUserMenu) : setSidebarOpen(true))}
              className={`${
                sidebarOpen ? 'w-full pr-3' : 'w-10 pr-2'
              } pl-2 py-1.5 rounded-xl bg-jungle-teal-50 hover:bg-jungle-teal-100 border border-jungle-teal-200 text-ui-xs font-semibold text-jungle-teal-800 transition-colors flex items-center gap-2 shadow-xs text-left overflow-hidden whitespace-nowrap`}
              title={sidebarOpen ? undefined : currentSession.name}
            >
              <StaffAvatarIcon className="w-6 h-6 shrink-0" />
              <span className="font-bold truncate">
                {currentSession.role === 'owner'
                  ? lang === 'bn'
                    ? 'মালিক (OWNER)'
                    : 'OWNER'
                  : lang === 'bn'
                  ? 'স্টাফ (STAFF)'
                  : 'STAFF'}
              </span>
              <span className="ml-auto w-2 h-2 rounded-full bg-muted-teal-600 inline-block animate-pulse shrink-0" />
              <span className="text-[10px] text-jungle-teal-400 shrink-0">▴</span>
            </button>

            {/* Dropdown Menu — opens upward from the sidebar footer.
                Only while expanded: the rail clips its own overflow, so a menu
                rendered against a 4rem rail would be sliced off. Clicking the
                avatar while collapsed expands the rail instead. */}
            {showUserMenu && sidebarOpen && (
              <div className="absolute left-0 right-0 bottom-full mb-2 bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-fade-in text-xs">
                <div className="p-2.5 bg-jungle-teal-50 rounded-xl mb-1 border border-jungle-teal-100">
                  <div className="font-bold text-jungle-teal-900 truncate">{currentSession.name}</div>
                  <div className="text-[11px] text-jungle-teal-500 font-mono truncate">@{currentSession.username} · {currentSession.role}</div>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setIsLocked(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-jungle-teal-800 hover:bg-jungle-teal-100 rounded-xl transition-colors font-semibold text-left"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock Screen [F1]</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-semibold text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.logout}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>


      {/* Main Viewport */}
      <main className="flex-1 min-w-0 p-3 sm:p-4 max-w-[1600px] w-full overflow-hidden flex flex-col min-h-0">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentSession={currentSession}
            products={products}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            lang={lang}
          />
        )}

        {activeTab === 'pos' && (
          <PosView
            products={products}
            currentSession={currentSession}
            onRefreshProducts={fetchCatalog}
          />
        )}

        {activeTab === 'sales' && <SalesHistoryView currentSession={currentSession} />}

        {activeTab === 'customers' && <CustomersView currentSession={currentSession} />}

        {activeTab === 'products' && (
          <ProductsView
            currentSession={currentSession}
            products={products}
            categories={categories}
            loading={loading}
            onRefresh={fetchCatalog}
            onAddCategory={handleAddCategory}
          />
        )}

        {activeTab === 'categories' && (
          <CategoriesView
            categories={categories}
            products={products}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onOpenProducts={() => setActiveTab('products')}
          />
        )}

        {activeTab === 'suppliers' && isOwner && (
          <SuppliersView
            products={products}
            onRefreshProducts={fetchCatalog}
            userRole={currentSession?.role}
          />
        )}


        {activeTab === 'reports' && <ReportsView currentSession={currentSession} />}

        {activeTab === 'shifts' && (
          <ShiftsHistoryView
            currentSession={currentSession}
            onOpenShiftModal={() => {
              setShiftModalMode(activeShift ? 'view' : 'open');
              setShowShiftModal(true);
            }}
          />
        )}

        {activeTab === 'users' && isOwner && <UsersView currentSession={currentSession} />}

        {activeTab === 'settings' && isOwner && <SettingsView currentSession={currentSession} onSettingsChanged={handleSettingsChanged} />}

        {activeTab === 'audit' && isOwner && <AuditLogView currentSession={currentSession} />}
      </main>

      </div>

      {/* Cloud Sync & Backup Modal */}
      <SyncSettingsModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        currentSession={currentSession}
      />

      {/* First-Run Setup Wizard */}
      <FirstRunWizardModal
        isOpen={showWizardModal}
        onCompleted={() => {
          setShowWizardModal(false);
          fetchCatalog();
        }}
      />

      {/* Shift & Cash Drawer Modal */}
      <ShiftModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        mode={shiftModalMode}
        onShiftUpdated={fetchActiveShift}
      />
    </div>
  );
}

