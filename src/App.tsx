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
  ChevronDown,
  Layers3,
} from 'lucide-react';

import { UserSession, Product, Category } from './types/ipc';
import { AuthBanner } from './components/AuthBanner';
import { LoginView } from './components/auth/LoginView';
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
    'dashboard' | 'pos' | 'sales' | 'customers' | 'products' | 'categories' | 'suppliers' | 'reports' | 'users' | 'settings' | 'audit'
  >('dashboard');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [dueCustomerCount, setDueCustomerCount] = useState<number>(0);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(true); // Catalog group in the rail // presentational only — rail expanded/collapsed
  const [lang, setLang] = useState<Language>('en'); // English UI; bilingual strings left intact


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

  useEffect(() => {
    if (window.api) {
      // Check first-run status
      window.api.wizard?.checkStatus().then((res) => {
        if (res.isFirstRun) {
          setShowWizardModal(true);
        }
      });

      // Check current session WITHOUT auto-login
      window.api.auth.getSession().then((sess) => {
        if (sess) {
          setCurrentSession(sess);
          fetchCatalog();
          if (sess.role === 'staff') {
            setActiveTab('pos');
          }
        }
      });
    }
  }, []);

  const handleLoginSuccess = (sess: UserSession) => {
    setCurrentSession(sess);
    fetchCatalog();
    if (sess.role === 'staff') {
      setActiveTab('pos');
    } else {
      setActiveTab('dashboard');
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
    setProducts([]);
    setCategories([]);
    setActiveTab('dashboard');
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
      // Zero-stock products were detached from it, so reload the catalog.
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

  // If user is not authenticated, render Login Screen
  if (!currentSession) {
    return (
      <>
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
          onLanguageToggle={toggleLanguage}
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
        {/* Brand & Logo */}
        <div className="shrink-0 px-3 py-3 border-b border-jungle-teal-200">
          <div className="flex items-center gap-2.5">
            {/* Rail toggle. Kept leftmost so it stays on screen when the rail
                collapses — a toggle further right would be clipped away and
                there would be nothing left to click to reopen. */}
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
              aria-label={sidebarOpen ? 'Collapse menu' : 'Expand menu'}
              aria-expanded={sidebarOpen}
              className="w-10 h-10 shrink-0 -ml-1 rounded-xl flex items-center justify-center text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            {sidebarOpen && <BrandLogoIcon className="w-9 h-9 shrink-0" />}
          </div>
          {sidebarOpen && (
            <div className="min-w-0 mt-2">
              <h1 className="text-ui-sm font-bold tracking-tight text-jungle-teal-900 font-sans truncate">
                Mechanical Shop POS
              </h1>
              <p className="text-ui-2xs text-jungle-teal-500 font-mono truncate">Offline-First</p>
            </div>
          )}
          {sidebarOpen && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              <span className="text-ui-2xs font-mono font-semibold bg-[#f0f5f2] text-[#3c5d4b] border border-[#c1d7cb] px-2 py-0.5 rounded-full whitespace-nowrap">
                v1.0 Production
              </span>
              {isOwner && <SyncStatusBadge onOpenSyncModal={() => setShowSyncModal(true)} />}
            </div>
          )}
        </div>

        {/* Primary Tab Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 p-2 text-ui-sm font-medium">

          {isOwner && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                  : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className="truncate">{t.navDashboard}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('pos')}
            className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
              activeTab === 'pos'
                ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'সিস্টেম (POS)' : 'POS Terminal'}</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
              activeTab === 'customers'
                ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'গ্রাহক (Customers)' : 'Customers'}</span>
            {dueCustomerCount > 0 && (
              <span className="ml-auto shrink-0 px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-mono font-bold">
                {dueCustomerCount}
              </span>
            )}
          </button>

          {/* Catalog group — Products + Categories */}
          <button
            onClick={() => (sidebarOpen ? setCatalogOpen((prev) => !prev) : setSidebarOpen(true))}
            aria-expanded={catalogOpen}
            title={sidebarOpen ? 'Catalog' : 'Catalog — click to expand the menu'}
            className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
              activeTab === 'products' || activeTab === 'categories' && !catalogOpen
                ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
            }`}
          >
            <Layers3 className="w-4 h-4 shrink-0" />
            <span className="truncate">Catalog</span>
            {lowStockCount > 0 && !catalogOpen && (
              <span
                className="ml-auto shrink-0 px-1.5 py-0.2 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-[10px] font-mono font-bold"
                title={`${lowStockCount} items below minimum stock threshold`}
              >
                {lowStockCount}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                lowStockCount > 0 && !catalogOpen ? 'ml-1.5' : 'ml-auto'
              } ${catalogOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {sidebarOpen && catalogOpen && (
            <div className="ml-3 pl-3 border-l border-jungle-teal-200 flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('products')}
                className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
                  activeTab === 'products'
                    ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                    : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
                }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span className="truncate">Products</span>
                {lowStockCount > 0 && (
                  <span
                    className="ml-auto shrink-0 px-1.5 py-0.2 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-[10px] font-mono font-bold"
                    title={`${lowStockCount} items below minimum stock threshold`}
                  >
                    {lowStockCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('categories')}
                className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
                  activeTab === 'categories'
                    ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                    : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span className="truncate">Categories</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-jungle-teal-500">
                  {categories.length}
                </span>
              </button>
            </div>
          )}

          {isOwner && (
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
                activeTab === 'suppliers'
                  ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                  : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span className="truncate">{lang === 'bn' ? 'সরবরাহকারী (Suppliers)' : 'Suppliers'}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('reports')}
            className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'রিপোর্ট (Reports)' : 'Reports'}</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
              activeTab === 'sales'
                ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'বিক্রয় তালিকা' : 'Sales'}</span>
          </button>

          {isOwner && (
            <>
              <button
                onClick={() => setActiveTab('settings')}
                className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                    : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
                }`}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span className="truncate">{lang === 'bn' ? 'সেটিংস (Settings)' : 'Settings'}</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
                  activeTab === 'users'
                    ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                    : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
                }`}
              >
                <UserCog className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.navUsers}</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`${sidebarOpen ? 'w-full' : 'w-10'} px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left overflow-hidden whitespace-nowrap ${
                  activeTab === 'audit'
                    ? 'bg-muted-teal-800 text-white font-bold shadow-md shadow-muted-teal-800/20'
                    : 'text-jungle-teal-700 hover:text-jungle-teal-900 hover:bg-jungle-teal-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.navAudit}</span>
              </button>
            </>
          )}
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
        {activeTab === 'dashboard' && isOwner && (
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

        {activeTab === 'users' && isOwner && <UsersView currentSession={currentSession} />}

        {activeTab === 'settings' && isOwner && <SettingsView currentSession={currentSession} />}

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
    </div>
  );
}

