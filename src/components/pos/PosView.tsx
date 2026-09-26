import React, { useState, useEffect, useRef } from 'react';
import {
  Product,
  Category,
  CartItem,
  UserSession,
  Customer,
  PaymentItem,
  SaleRecord,
} from '../../types/ipc';
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  PauseCircle,
  RotateCcw,
  CheckCircle,
  Check,
  AlertTriangle,

  UserPlus,
  ShoppingBag,
  CreditCard,
  Layers,
  Sparkles,
  Printer,
  X,
  Smartphone,
  Tag,
  FileText,
  ShoppingCart,
  Keyboard,
  ChevronRight,
  ChevronDown,
  Clock,
} from 'lucide-react';

import { InvoiceModal } from './InvoiceModal';
import { HeldSalesModal } from './HeldSalesModal';
import { CustomerFormModal } from '../customers/CustomerFormModal';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { SaleSuccessModal } from './SaleSuccessModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { ProductFormModal } from '../products/ProductFormModal';
import { ReturnRefundModal } from './ReturnRefundModal';
import { useToast } from '../../context/ToastContext';
import { audio, soundFx } from '../../utils/audio';
import { BkashIcon, NagadIcon, CashIcon, CardBankIcon } from './PosIcons';
import {
  buildCategoryTree,
  categoryPath,
  categoryWithDescendantIds,
  productCategoryCounts,
  type CategoryNode,
} from '../../utils/categoryTree';
import {
  getShortcuts,
  matchesBinding,
  bindingLabel,
  SHORTCUTS_CHANGED_EVENT,
} from '../../utils/shortcuts';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

type NonCashMethod = 'bkash' | 'nagad' | 'card' | 'other';

/** The non-cash choices offered under the Other button, in the order shown. */
const NON_CASH_METHODS: Array<{ id: NonCashMethod; label: string; hint: string }> = [
  { id: 'bkash', label: 'bKash', hint: 'bKash wallet transfer' },
  { id: 'nagad', label: 'Nagad', hint: 'Nagad wallet transfer' },
  { id: 'card', label: 'Card', hint: 'Card or bank POS machine' },
  { id: 'other', label: 'Other', hint: 'Rocket, Upay, bank transfer or anything else' },
];

const NonCashIcon: React.FC<{ method: NonCashMethod; className?: string }> = ({ method, className = 'w-3.5 h-3.5' }) => {
  if (method === 'bkash') return <BkashIcon className={className} />;
  if (method === 'nagad') return <NagadIcon className={className} />;
  if (method === 'card') return <CardBankIcon className={className} />;
  return <Smartphone className={`${className} shrink-0`} />;
};

interface CartPriceInputProps {
  unitPricePaisa: number;
  onPriceChange: (newPaisa: number) => void;
}

const CartPriceInput: React.FC<CartPriceInputProps> = ({
  unitPricePaisa,
  onPriceChange,
}) => {
  const [localVal, setLocalVal] = useState<string>((unitPricePaisa / 100).toString());
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalVal((unitPricePaisa / 100).toString());
    }
  }, [unitPricePaisa]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalVal(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      onPriceChange(Math.round(parsed * 100));
    } else if (raw === '') {
      onPriceChange(0);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const parsed = parseFloat(localVal);
    if (isNaN(parsed) || parsed < 0) {
      const reset = (unitPricePaisa / 100).toString();
      setLocalVal(reset);
      onPriceChange(unitPricePaisa);
    } else {
      setLocalVal(parsed.toString());
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    e.target.select();
  };

  return (
    <div className="relative flex items-center">
      <span className="absolute left-1.5 text-ui-2xs text-jungle-teal-600 font-bold font-mono pointer-events-none">৳</span>
      <input
        type="number"
        step="any"
        min="0"
        value={localVal}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onWheel={(e) => e.currentTarget.blur()}
        placeholder="0.00"
        className="w-20 h-6 pl-4 pr-1 text-ui-xs font-mono font-semibold text-jungle-teal-900 bg-jungle-teal-50/80 hover:bg-white focus:bg-white border border-jungle-teal-200 focus:border-muted-teal-600 rounded-md focus:outline-hidden transition-colors shadow-2xs"
        title="Edit sell price per unit (৳)"
      />
    </div>
  );
};

interface PosViewProps {

  products: Product[];
  currentSession: UserSession | null;
  onRefreshProducts: () => void;
  /**
   * Called whenever a sale or a refund moves the drawer.
   *
   * The running shift is held in App and was only re-read on login and from
   * the cash-drawer dialog, so the sidebar's cash figure sat at whatever it was
   * when the till opened - the one number a cashier glances at all day.
   */
  onShiftChanged: () => void;
  /**
   * False when shifts are in use and none is open.
   *
   * The main process refuses a sale in that state, because its cash would fall
   * outside every shift window and land in no Z-report. Knowing it here means
   * saying so before a cart is built, rather than after.
   */
  canTakeMoney: boolean;
  /** Opens the shift dialog, so the refusal comes with its own way out. */
  onOpenShift: () => void;
}

export const PosView: React.FC<PosViewProps> = ({
  products,
  currentSession,
  onRefreshProducts,
  onShiftChanged,
  canTakeMoney,
  onOpenShift,
}) => {
  const toast = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [customerQuery, setCustomerQuery] = useState('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // Scan Feedback visual state ('success' | 'error' | null)
  const [scanStatus, setScanStatus] = useState<'success' | 'error' | null>(null);
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Scanned Invoice Recognition
  const [scannedInvoiceSale, setScannedInvoiceSale] = useState<SaleRecord | null>(null);
  const [showInvoiceActionModal, setShowInvoiceActionModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Payments State
  const [cashAmount, setCashAmount] = useState<string>('');
  const [previousDuePaidTaka, setPreviousDuePaidTaka] = useState<string>('');
  const [bkashAmount, setBkashAmount] = useState<string>('');
  const [nagadAmount, setNagadAmount] = useState<string>('');
  /*
   * Non-cash is chosen by name again: bKash, Nagad, Card, or Other for anything
   * else (Rocket, Upay, a bank transfer).
   *
   * These were merged into a single "Other" button on the grounds that the shop
   * did not care which wallet money arrived on. It does - the bKash and Nagad
   * statements have to be matched against the till - and the merged button gave
   * no way to say which, so every transfer was recorded as "other" and the
   * per-wallet lines in Reports stayed at zero.
   */
  const [otherAmount, setOtherAmount] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [showNonCashPicker, setShowNonCashPicker] = useState(false);
  const [discountTaka, setDiscountTaka] = useState<string>('0');
  const [invoiceLayout, setInvoiceLayout] = useState<'80mm' | 'a4'>('80mm');
  // From Settings › Receipt Printer. Assumed true until read, so a counter with
  // a printer never briefly loses its print button while settings load.
  const [hasPrinter, setHasPrinter] = useState(true);
  const [isDueSaleMode, setIsDueSaleMode] = useState(false);


  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successSaleMeta, setSuccessSaleMeta] = useState<{
    invoiceNo: string;
    totalPaisa: number;
    paidPaisa: number;
    changePaisa: number;
    duePaisa: number;
    paymentMethodSummary: string;
    customer: Customer | null;
    autoPrint: boolean;
  } | null>(null);
  const [invoicePdfBase64, setInvoicePdfBase64] = useState('');
  const [lastInvoiceNo, setLastInvoiceNo] = useState('');
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Confirm Modal state
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Keyboard hints are off until asked for.
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Bindings are editable in Settings; re-read whenever they change there.
  const [keys, setKeys] = useState(getShortcuts);
  useEffect(() => {
    const sync = () => setKeys(getShortcuts());
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SHORTCUTS_CHANGED_EVENT, sync);
  }, []);

  // Browse panel — presentational filter state only.
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  /*
   * Which group is open in the rail. One at a time, like an accordion.
   *
   * Every group expanded is fine for the handful a new shop has and unusable
   * for a stocked one: 30 groups holding 100 subcategories is a 3,300px rail,
   * about seven screens of scrolling to reach the end. Kept to one, it is two.
   */
  const [expandedCategoryId, setExpandedCategoryId] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  const handleQuickCashRef = useRef<() => void>(() => {});
  const handleStartCheckoutRef = useRef<() => void>(() => {});
  const handleHoldCartRef = useRef<() => void>(() => {});
  const handleClearCartRef = useRef<() => void>(() => {});

  const refreshHeldCount = async () => {
    if (!window.api) return;
    try {
      const list = await window.api.sales.getHeldSales();
      setHeldCount(list.length);
    } catch {
      // A failed count should never block the till.
    }
  };

  // Fetch customers & categories
  const fetchData = async () => {
    if (!window.api) return;
    try {
      const [custList, catList, shopSettings] = await Promise.all([
        window.api.customers.list().catch(() => []),
        window.api.categories.list().catch(() => []),
        window.api.settings.get().catch(() => null),
      ]);
      setCustomers(custList);
      setCategories(catList);
      // Every paper Settings offers, not just two of them: the A4 case fell
      // through here, so a shop set to A4 was quietly billed on an 80mm roll
      // and the confirmation modal insisted the layout was 80mm.
      const savedLayout = shopSettings?.default_invoice_layout;
      if (savedLayout === '80mm' || savedLayout === 'a4') {
        setInvoiceLayout(savedLayout);
      }
      if (shopSettings) setHasPrinter(shopSettings.has_printer ?? true);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    refreshHeldCount();
    barcodeInputRef.current?.focus();
  }, []);

  // Global barcode scanner listener & shortcuts
  useEffect(() => {
    let scanBuffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Shortcuts
      const sc = getShortcuts();
      if (matchesBinding(e, sc.toggleHints)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }
      if (matchesBinding(e, sc.focusSearch)) {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
        return;
      }
      if (matchesBinding(e, sc.focusDiscount)) {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
        return;
      }
      if (matchesBinding(e, sc.exactCash)) {
        e.preventDefault();
        handleQuickCashRef.current();
        return;
      }
      if (matchesBinding(e, sc.checkout)) {
        e.preventDefault();
        handleStartCheckoutRef.current();
        return;
      }
      if (matchesBinding(e, sc.holdCart)) {
        e.preventDefault();
        handleHoldCartRef.current();
        return;
      }
      if (matchesBinding(e, sc.clearCart)) {
        if (cart.length > 0) {
          e.preventDefault();
          handleClearCartRef.current();
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }

      // Quick 'd' or 'D' shortcut to select discount when not typing
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
        return;
      }

    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cart, products]);

  useBarcodeScanner((code) => {
    handleBarcodeScanned(code);
  });

  const triggerScanFlash = (status: 'success' | 'error') => {
    setScanStatus(status);
    setTimeout(() => setScanStatus(null), 500);
  };

  const handleBarcodeScanned = async (scannedCode: string) => {
    const trimmed = scannedCode.trim();
    if (!trimmed) return;

    // 1. Check if scanned code is an Invoice (starts with INV- or lookup returns a sale)
    if (trimmed.toUpperCase().startsWith('INV-')) {
      if (window.api) {
        try {
          const sale = await window.api.sales.getByInvoice(trimmed);
          if (sale) {
            audio.playScanSuccess();
            triggerScanFlash('success');
            setUnrecognizedBarcode(null);
            setScannedInvoiceSale(sale);
            setShowInvoiceActionModal(true);
            toast.success(`Invoice found: #${sale.invoice_no}`);
            return;
          }
        } catch (err) {
          console.error('Invoice lookup error:', err);
        }
      }
    }

    // 2. Look for product by barcode
    const found = products.find(
      (p) => p.barcode?.toLowerCase() === trimmed.toLowerCase()
    );
    if (found) {
      audio.playScanSuccess();
      triggerScanFlash('success');
      setUnrecognizedBarcode(null);
      addToCart(found);
      toast.success(`Scanned: ${found.name}`);
    } else {
      // Check fallback if it is an invoice without INV- prefix
      if (window.api) {
        try {
          const sale = await window.api.sales.getByInvoice(trimmed);
          if (sale) {
            audio.playScanSuccess();
            triggerScanFlash('success');
            setUnrecognizedBarcode(null);
            setScannedInvoiceSale(sale);
            setShowInvoiceActionModal(true);
            toast.success(`Invoice found: #${sale.invoice_no}`);
            return;
          }
        } catch {
          // not an invoice
        }
      }

      audio.playScanError();
      triggerScanFlash('error');
      setUnrecognizedBarcode(trimmed);
      toast.error(`Barcode "${trimmed}" is not in inventory.`);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock_qty <= 0) {
      audio.playScanError();
      triggerScanFlash('error');
      setError(`"${product.name}" is out of stock!`);
      toast.error(`"${product.name}" is out of stock!`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.qty >= product.stock_qty) {
          audio.playScanError();
          triggerScanFlash('error');
          setError(`Cannot add more than available stock (${product.stock_qty}).`);
          toast.warning(`Maximum available stock reached (${product.stock_qty}).`);
          setTimeout(() => setError(null), 3000);
          return prev;
        }
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            barcode: product.barcode,
            name: product.name,
            name_bn: product.name_bn,
            unit: product.unit,
            unit_price_paisa: product.sell_price_paisa,
            cost_price_paisa: product.cost_price_paisa,
            qty: 1,
            discount_paisa: 0,
            available_stock: product.stock_qty,
            is_serial_tracked: Boolean(product.is_serial_tracked),
          },
        ];
      }
    });
  };

  const updateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id === productId) {
          if (newQty > item.available_stock) {
            setError(`Max available stock is ${item.available_stock}`);
            toast.warning(`Max available stock is ${item.available_stock}`);
            setTimeout(() => setError(null), 3000);
            return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      })
    );
  };

  const updateCartUnitPrice = (productId: string, newUnitPricePaisa: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id === productId) {
          return { ...item, unit_price_paisa: Math.max(0, newUnitPricePaisa) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setCashAmount('');
    setBkashAmount('');
    setNagadAmount('');
    setCardAmount('');
    setOtherAmount('');
    setPreviousDuePaidTaka('');
    setShowNonCashPicker(false);
    setDiscountTaka('0');
    // Due is a property of the bill being built, not a standing preference.
    // Without this it stayed armed after a sale and quietly put the next
    // customer's bill on credit too.
    setIsDueSaleMode(false);
    setError(null);
  };

  // Calculation (Integer Paisa)
  const subtotalPaisa = cart.reduce(
    (sum, item) => sum + item.unit_price_paisa * item.qty,
    0
  );
  const discountPaisa = Math.max(0, Math.round((parseFloat(discountTaka) || 0) * 100));
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);
  const previousDuePaidPaisa = Math.round((parseFloat(previousDuePaidTaka) || 0) * 100);
  const grandTotalExpectedPaisa = totalPaisa + previousDuePaidPaisa;

  const cashPaisa = Math.round((parseFloat(cashAmount) || 0) * 100);
  const bkashPaisa = Math.round((parseFloat(bkashAmount) || 0) * 100);
  const nagadPaisa = Math.round((parseFloat(nagadAmount) || 0) * 100);
  const cardPaisa = Math.round((parseFloat(cardAmount) || 0) * 100);
  const otherPaisa = Math.round((parseFloat(otherAmount) || 0) * 100);
  const currentCustomerInfo = customers.find(c => c.id === selectedCustomerId);

  const totalPaidPaisa = cashPaisa + bkashPaisa + nagadPaisa + cardPaisa + otherPaisa;
  /*
   * A full due is a sale where nothing at all is collected.
   *
   * It used to mean only that the Due sale chip was lit, and the checkout below
   * then posted a single zero payment - so a cashier who lit the chip and took
   * ৳2,000 against a ৳3,000 bill had the ৳2,000 thrown away and the customer
   * was billed the whole ৳3,000. Money in the drawer, and the ledger denying it.
   *
   * The moment any amount is entered the sale is a part payment, whatever the
   * chip says, and the remainder becomes the due on its own.
   */
  const isFullDue = isDueSaleMode && Boolean(selectedCustomerId) && totalPaidPaisa === 0;
  const effectiveCashPaisa = (!isFullDue && totalPaidPaisa === 0) ? grandTotalExpectedPaisa : cashPaisa;
  const effectivePaidPaisa = isFullDue ? 0 : (totalPaidPaisa === 0 ? grandTotalExpectedPaisa : totalPaidPaisa);
  const effectiveChangePaisa = Math.max(0, effectivePaidPaisa - grandTotalExpectedPaisa);
  const effectiveDuePaisa = Math.max(0, grandTotalExpectedPaisa - effectivePaidPaisa);

  const changePaisa = Math.max(0, totalPaidPaisa - grandTotalExpectedPaisa);
  const duePaisa = Math.max(0, grandTotalExpectedPaisa - totalPaidPaisa);

  // Every method that took money, by name. The old chain knew only "Cash +
  // bKash" and "Cash + Other", so a bill paid partly in cash and partly on
  // Nagad or Card was labelled plain "Cash".
  const nonCashPaisa: Record<NonCashMethod, number> = {
    bkash: bkashPaisa,
    nagad: nagadPaisa,
    card: cardPaisa,
    other: otherPaisa,
  };
  const selectedNonCash = NON_CASH_METHODS.find((m) => nonCashPaisa[m.id] > 0) || null;

  let paymentSummaryStr = 'Cash';
  if (isFullDue) {
    paymentSummaryStr = 'Full Due';
  } else {
    const used = [
        ...(cashPaisa > 0 ? ['Cash'] : []),
        ...NON_CASH_METHODS.filter((m) => nonCashPaisa[m.id] > 0).map((m) => m.label),
      ];
    if (used.length > 0) paymentSummaryStr = used.join(' + ');
  }

  // Quick Cash Fill (F4)
  const handleQuickCash = () => {
    if (totalPaisa <= 0) return;
    setIsDueSaleMode(false);
    setCashAmount((grandTotalExpectedPaisa / 100).toFixed(2));
    setBkashAmount('');
    setNagadAmount('');
    setCardAmount('');
    setOtherAmount('');
    setShowNonCashPicker(false);
    toast.info(`Exact cash ৳${(totalPaisa / 100).toFixed(2)} applied.`);
  };

  // Explicit Due Sale
  const handleFullDue = () => {
    if (cart.length === 0) {
      toast.warning('Cart is empty. Scan or select products first.');
      return;
    }
    if (!selectedCustomerId) {
      toast.warning('A walk-in customer cannot be given credit. Select or add a customer first.');
      return;
    }
    setIsDueSaleMode(true);
    setCashAmount('0');
    setBkashAmount('');
    setNagadAmount('');
    setCardAmount('');
    setOtherAmount('');
    setShowNonCashPicker(false);
    toast.info(`Due sale: ৳${(grandTotalExpectedPaisa / 100).toFixed(2)} — press Complete Sale to record it.`);
    // Deliberately does NOT open the receipt preview. This only arms the mode;
    // the sale is still confirmed through Complete Sale, so a credit sale can
    // no longer be committed on a single click with nothing to confirm.
  };

  const handleHoldCart = async () => {
    if (cart.length === 0 || !window.api) return;
    try {
      const cust = customers.find((c) => c.id === selectedCustomerId);
      await window.api.sales.holdSale({
        cartData: cart,
        customerName: cust?.name,
      });
      toast.success('Cart parked / held successfully!');
      refreshHeldCount();
      handleClearCart();
      // The customer's name is stored on the held bill, so the till goes back
      // to walk-in — same reasoning as after a sale.
      setSelectedCustomerId('');
    } catch (err: any) {
      toast.error(`Failed to hold sale: ${err.message}`);
    }
  };

  const handleStartCheckout = () => {
    // Guarded here rather than only on the button: the checkout shortcut and
    // the payment panel both reach this, and either would otherwise walk into
    // the main process's refusal with a full cart already rung up.
    if (selectedCustomer && previousDuePaidPaisa > (selectedCustomer.due_paisa || 0)) {
      toast.error(`You cannot collect more than the customer's previous due (৳ ${((selectedCustomer.due_paisa || 0) / 100).toFixed(2)})!`);
      return;
    }

    if (!canTakeMoney) {
      toast.warning('No shift is open. Open one before taking money.');
      onOpenShift();
      return;
    }

    if (cart.length === 0) {
      toast.warning('Cart is empty. Scan or select products first.');
      return;
    }

    // Staff max discount validation (10%)
    if (currentSession?.role === 'staff') {
      const maxAllowedDiscount = Math.round(subtotalPaisa * 0.1);
      if (discountPaisa > maxAllowedDiscount) {
        toast.error(
          `Staff discount limit exceeded: ৳${(discountPaisa / 100).toFixed(
            2
          )} exceeds 10% maximum (৳${(maxAllowedDiscount / 100).toFixed(2)}). Ask Owner for approval.`
        );
        return;
      }
    }

    // A due sale is already a deliberate choice, so asking "paid in cash?" both
    // contradicts it and used to cancel it (isDueSaleMode was cleared below
    // before this check ran). Confirm the credit instead, and keep the mode.
    if (isFullDue) {
      const customerName =
        customers.find((c) => c.id === selectedCustomerId)?.name || 'this customer';
      setConfirmModalConfig({
        isOpen: true,
        title: 'Confirm due sale',
        message: `Record ৳ ${(grandTotalExpectedPaisa / 100).toFixed(
          2
        )} as due for ${customerName}? No money is being collected now.`,
        onConfirm: () => {
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
          setShowPreviewModal(true);
        },
      });
      return;
    }

    setIsDueSaleMode(false);

    // If NO payment amount entered in any field (cash, bkash, nagad, card are all empty/0):
    if (totalPaidPaisa === 0) {
      setConfirmModalConfig({
        isOpen: true,
        title: 'Confirm cash payment',
        message: `Has the customer paid the full ৳ ${(grandTotalExpectedPaisa / 100).toFixed(2)} in cash?`,
        onConfirm: () => {
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
          setCashAmount((grandTotalExpectedPaisa / 100).toFixed(2));
          setShowPreviewModal(true);
        },
      });
      return;
    }

    // Strict Validation: If there is remaining due on a walk-in customer, block checkout!
    if (duePaisa > 0 && !selectedCustomerId) {
      toast.error('A walk-in customer cannot be sold on credit. Select a customer above, or take the full payment.');
      return;
    }

    // If payment amount was ALREADY entered by user, directly open preview without prompt!
    setShowPreviewModal(true);
  };

  handleQuickCashRef.current = handleQuickCash;
  handleStartCheckoutRef.current = handleStartCheckout;
  handleHoldCartRef.current = handleHoldCart;
  handleClearCartRef.current = handleClearCart;

  const executeFinalCheckout = async (shouldPrint: boolean) => {
    if (isSubmittingRef.current) return;
    if (effectiveDuePaisa > 0 && !selectedCustomerId) {
      toast.error('A walk-in customer cannot be sold on credit. Please select a customer.');
      return;
    }

    if (!window.api) return;
    
    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);

    const payments: PaymentItem[] = [];
    if (isFullDue) {
      payments.push({ method: 'cash', amount_paisa: 0 });
    } else {
      if (effectiveCashPaisa > 0) payments.push({ method: 'cash', amount_paisa: effectiveCashPaisa });
      if (bkashPaisa > 0) payments.push({ method: 'bkash', amount_paisa: bkashPaisa });
      if (nagadPaisa > 0) payments.push({ method: 'nagad', amount_paisa: nagadPaisa });
      if (cardPaisa > 0) payments.push({ method: 'card', amount_paisa: cardPaisa });
      if (otherPaisa > 0) payments.push({ method: 'other', amount_paisa: otherPaisa });
    }

    try {
      const res = await window.api.sales.create({
        customer_id: selectedCustomerId || null,
          previous_due_paid_paisa: previousDuePaidPaisa,
        subtotal_paisa: subtotalPaisa,
        discount_paisa: discountPaisa,
        total_paisa: totalPaisa,
        items: cart.map((item) => ({
          product_id: item.product_id,
          qty: item.qty,
          unit_price_paisa: item.unit_price_paisa,
          discount_paisa: item.discount_paisa,
        })),
        payments,
        total_paid_paisa: effectivePaidPaisa,
        change_paisa: effectiveChangePaisa,
        layout: invoiceLayout,
      });


      if (res.success) {
        toast.success(`Sale completed successfully! Invoice #${res.invoice_no}`);
        setLastInvoiceNo(res.invoice_no);
        setInvoicePdfBase64(res.pdfBase64 || '');
        setShowPreviewModal(false);

        const currentCustomer = customers.find((c) => c.id === selectedCustomerId) || null;
        setSuccessSaleMeta({
          invoiceNo: res.invoice_no,
          totalPaisa: totalPaisa,
          paidPaisa: effectivePaidPaisa,
          changePaisa: effectiveChangePaisa,
          duePaisa: effectiveDuePaisa,
          paymentMethodSummary: paymentSummaryStr,
          customer: currentCustomer,
          autoPrint: shouldPrint && hasPrinter,
        });
        setShowSuccessModal(true);

        handleClearCart();
        // Back to walk-in, so the next person at the counter cannot be billed
        // to whoever was served last. Done here rather than in handleClearCart
        // so a manual Clear (a mis-scan) keeps the customer in place.
        setSelectedCustomerId('');
        onRefreshProducts();
        // Cash taken at the till changes the shift's expected drawer total.
        onShiftChanged();
        // The sale just moved this customer's balance. `customers` was loaded
        // once at mount, so without this the picker keeps showing the old due.
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed.');
      setError(err.message || 'Checkout failed.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchQuery.trim();
      if (!query) return;

      // Check if query matches barcode exactly
      const barcodeMatch = products.find(
        (p) => p.barcode?.toLowerCase() === query.toLowerCase()
      );
      if (barcodeMatch) {
        handleBarcodeScanned(query);
        setSearchQuery('');
        return;
      }

      // Check if there are name matches
      const matches = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.name_bn && p.name_bn.toLowerCase().includes(query.toLowerCase())) ||
          (p.barcode && p.barcode.toLowerCase().includes(query.toLowerCase()))
      );

      if (matches.length === 1) {
        addToCart(matches[0]);
        audio.playScanSuccess();
        toast.success(`Added: ${matches[0].name}`);
        setSearchQuery('');
      } else if (matches.length === 0) {
        handleBarcodeScanned(query);
        setSearchQuery('');
      }
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.name_bn && p.name_bn.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  });

  // bKash / Nagad / Card are transfers of the exact amount — there is no
  // change to hand back — so choosing one assigns it the whole payable and
  // clears the others, rather than asking staff to retype a figure.
  const nonCashSetters: Record<NonCashMethod, (v: string) => void> = {
    bkash: setBkashAmount,
    nagad: setNagadAmount,
    card: setCardAmount,
    other: setOtherAmount,
  };

  const payByMethod = (method: NonCashMethod) => {
    const current = nonCashPaisa[method];
    const setAmount = nonCashSetters[method];
    // Money arriving by transfer is still money collected.
    if (current === 0) setIsDueSaleMode(false);
    // The choice is made; the row of chips has done its job.
    setShowNonCashPicker(false);

    // Tapping the chip that already holds the amount clears it, so a mis-tap is
    // undoable without reaching for the keyboard.
    if (current > 0) {
      setAmount('');
      return;
    }

    // Tapping a different one moves the bill to it. Leaving the old amount in
    // place meant the outstanding was already nil, so the new chip filled with
    // nothing and the till looked broken - staff had to clear the first chip
    // before the second would take. A customer changing their mind between
    // wallets is one tap, not two.
    for (const m of NON_CASH_METHODS) {
      if (m.id !== method) nonCashSetters[m.id]('');
    }

    /*
     * Cash keeps its place so a part-cash bill can still be finished on a
     * wallet - ৳1,000 in notes, the rest on bKash.
     *
     * Unless cash already covers the whole bill, which is what tapping Exact
     * leaves behind. A customer who then says "I'll send it instead" left the
     * outstanding at nil, so the chip filled with nothing and appeared dead.
     * Taking the bill off cash is plainly what the tap meant.
     */
    if (cashPaisa >= totalPaisa) {
      setCashAmount('');
      setAmount((totalPaisa / 100).toFixed(2));
      return;
    }

    const outstandingPaisa = grandTotalExpectedPaisa - cashPaisa;
    setAmount(outstandingPaisa > 0 ? (outstandingPaisa / 100).toFixed(2) : '');
  };

  /*
   * What a customer plausibly hands over for this bill.
   *
   * Fixed ৳500/1000/2000/5000 keys are no help on a ৳2,850 sale - none of them
   * is what anyone would offer. Rounding the actual total up to the next 10,
   * 50, 100, 500 and 1,000 gives the notes people really reach for, and the
   * exact figure is already on its own button. Anything equal to the total is
   * dropped, since Exact covers it, and ৳1,000 is the largest note here so
   * nothing above the next thousand is worth offering.
   */
  const quickCashOptions = (() => {
    if (totalPaisa <= 0) return [] as number[];
    const totalTaka = totalPaisa / 100;
    const steps = [10, 50, 100, 500, 1000];
    const seen = new Set<number>();
    const out: number[] = [];
    for (const step of steps) {
      const up = Math.ceil(totalTaka / step) * step;
      if (up <= totalTaka || seen.has(up)) continue;
      seen.add(up);
      out.push(up);
      if (out.length === 4) break;
    }
    return out;
  })();

  // ── Browse lists ───────────────────────────────────────────────────
  // `filteredProducts` above stays search-only (it returns nothing while the
  // search box is empty). These drive the browse panel instead.
  // A parent's count includes its children's stock. Counting only direct
  // `category_id` matches showed a parent as 0 whenever its products were
  // filed on a subcategory - which is where a shop files them.
  const { direct: directCountByCategory, rollup: rollupCountByCategory } =
    productCategoryCounts(products, categories);

  /*
   * The rail as parents with their children, not one flat alphabetical list.
   *
   * The filter matches either level. Typing a child's name keeps its parent on
   * screen as the heading it belongs under, and typing a parent's name keeps
   * all of its children, so a match is never shown without its context.
   */
  const categoryQuery = categoryFilter.trim().toLowerCase();
  // A filter is already a narrowing, so its matches open regardless: hiding
  // children behind a closed group would hide the very rows being searched for.
  const expandAllGroups = categoryQuery.length > 0;
  const visibleCategoryTree = buildCategoryTree(categories)
    .map((node) => {
      if (!categoryQuery) return node;
      const parentMatches = node.parentName.toLowerCase().includes(categoryQuery);
      if (parentMatches) return node;
      const children = node.children.filter((c) => c.name.toLowerCase().includes(categoryQuery));
      return children.length ? { ...node, children } : null;
    })
    .filter((node): node is CategoryNode => node !== null);

  // Selecting a parent lists everything beneath it, so tapping a group at the
  // till shows its stock rather than an empty grid.
  const selectedCategoryIds = selectedCategoryId
    ? categoryWithDescendantIds(selectedCategoryId, categories)
    : [];
  const categoryProducts = products.filter(
    (p) => !selectedCategoryId || selectedCategoryIds.includes(p.category_id || '')
  );

  const brandsInCategory = Array.from(
    new Set(categoryProducts.map((p) => (p.brand || '').trim()).filter(Boolean))
  ).sort();

  // In-stock first, then alphabetical — staff should not tap a dead row.
  const browseProducts = categoryProducts
    .filter((p) => !selectedBrand || (p.brand || '').trim() === selectedBrand)
    .sort((a, b) => {
      const aOut = a.stock_qty <= 0 ? 1 : 0;
      const bOut = b.stock_qty <= 0 ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return a.name.localeCompare(b.name);
    });

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  // A child on its own says "Oil Filters" and leaves the cashier guessing which
  // group they are in; the path says where they are.
  const selectedCategoryName = selectedCategory
    ? categoryPath(selectedCategory, categories)
    : 'All products';

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Name or phone. Digits are matched against the number with separators
  // stripped, so "01712" finds "01712-345678".
  const customerQ = customerQuery.trim().toLowerCase();
  const customerDigits = customerQ.replace(/\D/g, '');
  const matchingCustomers = customerQ
    ? customers.filter((c) => {
        if (c.name.toLowerCase().includes(customerQ)) return true;
        if (!c.phone) return false;
        const phone = c.phone.toLowerCase();
        if (phone.includes(customerQ)) return true;
        return customerDigits.length > 0 && phone.replace(/\D/g, '').includes(customerDigits);
      })
    : customers;

  return (

    <div className="h-full flex-1 flex flex-col overflow-hidden min-h-0 text-jungle-teal-900 font-sans select-none">
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">

        {/* Left: scan bar over the browse columns */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          {/* Top Search & Barcode Scanner Bar */}
          <div
            className={`shrink-0 bg-jungle-teal-50 border p-2 rounded-2xl shadow-xs flex items-center gap-2 flex-nowrap transition-all duration-300 ${scanStatus === 'success'
                ? 'border-muted-teal-600 ring-2 ring-muted-teal-400/50 bg-muted-teal-50/20'
                : scanStatus === 'error'
                  ? 'border-rose-500 ring-2 ring-rose-400/50 bg-rose-50/20'
                  : 'border-jungle-teal-200'
              }`}
          >

            <div className="relative flex-1 min-w-[200px]">
              <Barcode className="w-4 h-4 text-muted-teal-800 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Scan a barcode or type a part name..."
                className={`w-full bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl pl-10 py-2 text-xs text-jungle-teal-900 focus:outline-hidden focus:border-muted-teal-700 font-mono font-semibold placeholder:font-sans placeholder:text-jungle-teal-600 ${
                  showShortcuts ? 'pr-12' : 'pr-4'
                }`}
              />
              {showShortcuts && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none font-mono text-ui-2xs font-semibold text-jungle-teal-600 bg-jungle-teal-100 border border-jungle-teal-200 rounded px-1.5 py-0.5">
                  {bindingLabel(keys.focusSearch)}
                </span>
              )}

              {/* Instant Search Results Dropdown */}
              {searchQuery.trim().length > 0 && filteredProducts.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-jungle-teal-50 border border-jungle-teal-300 rounded-2xl shadow-2xl z-30 max-h-64 overflow-y-auto divide-y divide-jungle-teal-100 animate-fade-in">
                  <div className="px-3 py-1.5 bg-jungle-teal-50 text-[11px] font-bold text-jungle-teal-500 font-mono">
                    Products ({filteredProducts.length} found — click to add to the bill):
                  </div>
                  {filteredProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        addToCart(p);
                        setSearchQuery('');
                        barcodeInputRef.current?.focus();
                      }}
                      className="w-full p-3 text-left hover:bg-muted-teal-50/50 flex items-center justify-between transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-jungle-teal-900 text-xs group-hover:text-muted-teal-900">
                          {p.name_bn ? `${p.name_bn} (${p.name})` : p.name}
                        </div>
                        <div className="text-ui-2xs text-jungle-teal-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{p.barcode ? `BC: ${p.barcode}` : 'No Barcode'}</span>
                          {p.brand && <span>· {p.brand}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="text-xs font-mono font-bold text-muted-teal-800">
                          ৳ {(p.sell_price_paisa / 100).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-jungle-teal-500 font-mono">
                          Stock: {p.stock_qty} {p.unit || 'pcs'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Keyboard hint toggle — same thing F11 does */}
            <button
              type="button"
              onClick={() => setShowShortcuts((prev) => !prev)}
              aria-pressed={showShortcuts}
              title={`${showShortcuts ? 'Hide' : 'Show'} keyboard shortcuts (${bindingLabel(keys.toggleHints)})`}
              className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center transition-colors ${
                showShortcuts
                  ? 'bg-jungle-teal-100 border-jungle-teal-200 text-jungle-teal-900'
                  : 'bg-jungle-teal-50 border-jungle-teal-200 text-jungle-teal-600 hover:bg-jungle-teal-100'
              }`}
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Quick Add Product Button */}
            <button
              onClick={() => {
                setUnrecognizedBarcode(null);
                setShowAddProductModal(true);
              }}
              className="px-4 py-2 bg-muted-teal-800 hover:bg-muted-teal-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-muted-teal-800/20 transition-all shrink-0"
              title="Add a new item"
            >
              <Plus className="w-4 h-4" />
              <span>New item</span>
            </button>

            {/* Recall Held Carts */}
            <button
              onClick={() => setShowHeldModal(true)}
              className="px-3.5 py-2 bg-jungle-teal-50 hover:bg-amber-50 text-amber-800 rounded-xl text-ui-xs font-medium flex items-center gap-1.5 transition-colors border border-amber-200 shrink-0 shadow-xs"
              title={
                heldCount > 0
                  ? `${heldCount} parked bill${heldCount === 1 ? '' : 's'} — click to recall`
                  : 'No parked bills'
              }
            >
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>Hold Carts</span>
              {heldCount > 0 && (
                <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white font-mono text-ui-2xs font-semibold flex items-center justify-center shrink-0">
                  {heldCount}
                </span>
              )}
            </button>
          </div>
      
        <div className="flex-1 flex gap-3 min-h-0">
      
        {/* ===================================================================== */}
        {/* BROWSE — CATEGORY COLUMN                                              */}
        {/* Two levels, from `categories.parent_id`: a parent row with its       */}
        {/* subcategories indented under it. The comment here used to say the     */}
        {/* schema was flat - it gained parent_id, and this rail had not caught   */}
        {/* up, so parents read 0 and listed nothing.                             */}
        {/* ===================================================================== */}
        <div className="w-[150px] min-[1180px]:w-[168px] shrink-0 bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl shadow-xs flex flex-col overflow-hidden min-h-0">
          <div className="shrink-0 p-2 border-b border-jungle-teal-200">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-jungle-teal-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                placeholder="Filter categories"
                className="w-full h-9 pl-8 pr-2 bg-jungle-teal-100 border border-jungle-teal-200 rounded-lg text-ui-sm text-jungle-teal-800 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
              />
            </div>
          </div>
      
          <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
            <button
              type="button"
              onClick={() => { setSelectedCategoryId(''); setSelectedBrand(''); }}
              className={`w-full min-h-8 px-2.5 py-1.5 rounded-lg flex items-start gap-2 text-left text-ui-sm transition-colors ${
                selectedCategoryId === ''
                  ? 'bg-muted-teal-800 text-white font-semibold'
                  : 'text-jungle-teal-700 hover:bg-jungle-teal-100'
              }`}
            >
              <span className="flex-1 leading-tight">All products</span>
              <span className="font-mono text-ui-2xs opacity-70 shrink-0">{products.length}</span>
            </button>
      
            {visibleCategoryTree.map((node) => {
              const parentCount = rollupCountByCategory[node.parent.id] || 0;
              const parentSelected = selectedCategoryId === node.parent.id;
              const holdsSelection = node.children.some((c) => c.id === selectedCategoryId);
              const expanded =
                expandAllGroups || holdsSelection || expandedCategoryId === node.parent.id;
              return (
                <div key={node.parent.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(node.parent.id);
                      setSelectedBrand('');
                      // Selecting a group opens it, so its subcategories are one
                      // tap away rather than two. Tapping the open group again
                      // closes it.
                      setExpandedCategoryId((current) =>
                        current === node.parent.id ? '' : node.parent.id
                      );
                    }}
                    title={`${node.parentName} — ${parentCount} product${parentCount === 1 ? '' : 's'}`}
                    className={`w-full min-h-8 px-2.5 py-1.5 rounded-lg flex items-start gap-2 text-left text-ui-sm transition-colors ${
                      parentSelected
                        ? 'bg-muted-teal-800 text-white font-semibold'
                        : 'text-jungle-teal-700 hover:bg-jungle-teal-100 font-semibold'
                    }`}
                  >
                    {node.children.length > 0 && (
                      <ChevronRight
                        className={`w-3 h-3 mt-0.5 shrink-0 transition-transform ${
                          expanded ? 'rotate-90' : ''
                        }`}
                      />
                    )}
                    <span className="flex-1 leading-tight break-words">{node.parentName}</span>
                    <span
                      className={`font-mono text-ui-2xs shrink-0 ${
                        parentCount === 0 ? 'opacity-35' : 'opacity-70'
                      }`}
                    >
                      {parentCount}
                    </span>
                  </button>

                  {/*
                    Children sit in a hairline-ruled indent rather than carrying
                    the parent's name in their own label. A 150px rail has no
                    room for "Filters — Oil Filters", and the rule makes the
                    nesting readable at a glance from a step back.
                  */}
                  {node.children.length > 0 && expanded && (
                    <div className="ml-2.5 pl-1.5 border-l border-jungle-teal-200 space-y-0.5 mt-0.5">
                      {node.children.map((child) => {
                        const childCount = directCountByCategory[child.id] || 0;
                        const childSelected = selectedCategoryId === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => { setSelectedCategoryId(child.id); setSelectedBrand(''); }}
                            title={`${node.parentName} — ${child.name}`}
                            className={`w-full min-h-7 px-2 py-1 rounded-lg flex items-start gap-2 text-left text-ui-xs transition-colors ${
                              childSelected
                                ? 'bg-muted-teal-800 text-white font-semibold'
                                : 'text-jungle-teal-600 hover:bg-jungle-teal-100'
                            }`}
                          >
                            <span className="flex-1 leading-tight break-words">{child.name}</span>
                            <span
                              className={`font-mono text-ui-2xs shrink-0 ${
                                childCount === 0 ? 'opacity-35' : 'opacity-70'
                              }`}
                            >
                              {childCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
      
            {visibleCategoryTree.length === 0 && (
              <div className="px-2.5 py-8 text-center text-ui-xs text-jungle-teal-500">
                No category matches that filter.
              </div>
            )}
          </div>
        </div>
      
        {/* ===================================================================== */}
        {/* BROWSE — RESULTS                                                      */}
        {/* A list, not a tile grid: products carry no image column, so tiles      */}
        {/* would be text in boxes and would fit less on screen.                   */}
        {/* ===================================================================== */}
        <div className="flex-1 min-w-0 bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl shadow-xs flex flex-col overflow-hidden min-h-0">
          <div className="shrink-0 border-b border-jungle-teal-200 px-3 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-jungle-teal-600 shrink-0" />
              <span className="text-ui-base font-semibold text-jungle-teal-900 truncate">
                {selectedCategoryName}
              </span>
              <span className="font-mono text-ui-xs text-jungle-teal-600 shrink-0">
                {browseProducts.length} products
              </span>
              <span className="ml-auto text-ui-xs text-jungle-teal-500 shrink-0">In stock first</span>
            </div>
      
            {brandsInCategory.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedBrand('')}
                  className={`h-7 px-3 rounded-full text-ui-xs shrink-0 whitespace-nowrap transition-colors ${
                    selectedBrand === ''
                      ? 'bg-azure-mist-700 text-white font-medium'
                      : 'border border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                  }`}
                >
                  All brands
                </button>
                {brandsInCategory.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelectedBrand(b)}
                    className={`h-7 px-3 rounded-full text-ui-xs shrink-0 whitespace-nowrap transition-colors ${
                      selectedBrand === b
                        ? 'bg-azure-mist-700 text-white font-medium'
                        : 'border border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
      
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-jungle-teal-100">
              {browseProducts.slice(0, 60).map((p) => {
                const outOfStock = p.stock_qty <= 0;
                const lowStock = !outOfStock && p.stock_qty <= (p.low_stock_threshold ?? 5);
                const stockClass = outOfStock
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : lowStock
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-muted-teal-50 text-muted-teal-800 border-muted-teal-200';
                const stockLabel = outOfStock
                  ? 'Out of stock'
                  : `${p.stock_qty} ${p.unit || 'pcs'}${lowStock ? ' · low' : ''}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={outOfStock}
                    title={p.name}
                    onClick={() => { addToCart(p); barcodeInputRef.current?.focus(); }}
                    className={`group w-full h-[54px] pl-3 pr-2.5 flex items-center gap-3 text-left border-l-2 transition-colors ${
                      outOfStock
                        ? 'border-l-transparent opacity-55'
                        : 'border-l-transparent hover:border-l-azure-mist-700 hover:bg-azure-mist-50/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-ui-sm font-semibold text-jungle-teal-900 truncate leading-tight">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 min-w-0">
                        {p.brand && (
                          <span className="shrink-0 text-ui-2xs font-medium text-jungle-teal-700 bg-jungle-teal-100 border border-jungle-teal-200 rounded px-1.5 py-px">
                            {p.brand}
                          </span>
                        )}
                        <span className={`shrink-0 font-mono text-ui-2xs font-semibold border rounded px-1.5 py-px ${stockClass}`}>
                          {stockLabel}
                        </span>
                        <span className="font-mono text-ui-2xs text-jungle-teal-600 truncate">
                          {p.barcode || '—'}
                        </span>
                      </div>
                    </div>
              
                    <div className="font-mono text-ui-base font-semibold text-jungle-teal-900 shrink-0 whitespace-nowrap">
                      ৳ {(p.sell_price_paisa / 100).toFixed(2)}
                    </div>
              
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        outOfStock
                          ? 'border border-jungle-teal-200 text-jungle-teal-700'
                          : 'bg-azure-mist-700 text-white group-hover:bg-azure-mist-800'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })}
      
            {browseProducts.length === 0 && (
              <div className="p-8 text-center text-ui-sm text-jungle-teal-500">
                Nothing in this category yet.
              </div>
            )}
      
            {browseProducts.length > 60 && (
              <div className="px-3 py-2.5 text-center text-ui-xs text-jungle-teal-500">
                Showing the first 60 of {browseProducts.length}. Narrow by brand, or scan/search above.
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

        {/* ===================================================================== */}
        {/* CART RAIL: BILL, CUSTOMER, PRICING, PAYMENT & CHECKOUT                */}
        {/* ===================================================================== */}
        <div className="w-[330px] min-[1180px]:w-[380px] shrink-0 bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl shadow-xs flex flex-col overflow-hidden min-h-0">
          <div className="shrink-0 px-3 pt-3 space-y-2">
          {/* Unrecognized Barcode Quick-Add Banner */}
          {unrecognizedBarcode && (
            <div className="shrink-0 p-3 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-center justify-between gap-3 shadow-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Barcode <strong className="font-mono bg-amber-200/60 px-1.5 py-0.5 rounded-sm">"{unrecognizedBarcode}"</strong> is not in inventory.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="px-3 py-1.5 bg-muted-teal-800 hover:bg-muted-teal-900 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add this product now</span>
                </button>
                <button
                  onClick={() => setUnrecognizedBarcode(null)}
                  className="p-1 text-jungle-teal-600 hover:text-jungle-teal-700 rounded-lg"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="shrink-0 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Selector & Quick Actions */}
          <div className="shrink-0 border-b border-jungle-teal-100 pb-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans flex items-center gap-1.5">
                <span>Customer</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleHoldCart}
                  disabled={cart.length === 0}
                  className="px-2.5 py-1 bg-jungle-teal-50 hover:bg-amber-50 hover:text-amber-800 text-jungle-teal-600 border border-jungle-teal-200 rounded-lg text-ui-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
                  title="Park / hold this bill (F9)"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-jungle-teal-600" />
                  <span>Hold{showShortcuts ? ` (${bindingLabel(keys.holdCart)})` : ''}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerPickerOpen((prev) => !prev);
                    setCustomerQuery('');
                  }}
                  className="w-full h-[40px] px-3 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl flex items-center gap-2 text-left hover:border-azure-mist-600 transition-colors"
                >
                  <span className="flex-1 min-w-0 truncate text-ui-sm font-medium text-jungle-teal-900">
                    {selectedCustomer ? selectedCustomer.name : 'Walk-in customer'}
                  </span>
                  {selectedCustomer && (selectedCustomer.due_paisa || 0) > 0 && (
                    <span className="font-mono text-ui-2xs text-amber-800 shrink-0">
                      due ৳ {((selectedCustomer.due_paisa || 0) / 100).toFixed(2)}
                    </span>
                  )}
                  <svg className="w-3.5 h-3.5 text-jungle-teal-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {selectedCustomer && (selectedCustomer.due_paisa || 0) > 0 && (
                  <div className="w-full mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <span className="text-xs font-semibold text-amber-800">Collect Previous Due ৳</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Amount"
                      value={previousDuePaidTaka}
                      onChange={(e) => {
                      setPreviousDuePaidTaka(e.target.value);
                      if (Math.round((parseFloat(e.target.value) || 0) * 100) > 0) {
                        setIsDueSaleMode(false);
                      }
                    }}
                      className="w-24 text-right bg-white border border-amber-300 rounded-lg text-sm font-mono font-bold text-amber-900 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                )}
                
                {customerPickerOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-jungle-teal-200">
                      <input
                        autoFocus
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setCustomerPickerOpen(false);
                          }
                        }}
                        placeholder="Search name or phone…"
                        className="w-full h-9 px-2.5 bg-jungle-teal-100 border border-jungle-teal-200 rounded-lg text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
                      />
                    </div>
              
                    <div className="max-h-64 overflow-y-auto divide-y divide-jungle-teal-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId('');
                          setCustomerPickerOpen(false);
                        }}
                        className="w-full h-[40px] px-3 flex items-center text-left text-ui-sm text-jungle-teal-700 hover:bg-jungle-teal-100 transition-colors"
                      >
                        Walk-in customer
                      </button>
              
                      {matchingCustomers.slice(0, 50).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCustomerPickerOpen(false);
                          }}
                          className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-muted-teal-50/60 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-ui-sm font-medium text-jungle-teal-900 truncate">{c.name}</div>
                            <div className="text-ui-2xs font-mono text-jungle-teal-600 truncate">
                              {c.phone || 'no phone'}
                            </div>
                          </div>
                          {(c.due_paisa || 0) > 0 && (
                            <span className="font-mono text-ui-2xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 rounded px-1.5 py-0.5 shrink-0">
                              ৳ {((c.due_paisa || 0) / 100).toFixed(2)}
                            </span>
                          )}
                        </button>
                      ))}
              
                      {matchingCustomers.length === 0 && customerQuery.trim() !== '' && (
                        <div className="px-3 py-6 text-center text-ui-xs text-jungle-teal-500">
                          No customer matches that name or number.
                        </div>
                      )}
              
                      {matchingCustomers.length > 50 && (
                        <div className="px-3 py-2 text-center text-ui-2xs text-jungle-teal-500">
                          Showing 50 of {matchingCustomers.length} — keep typing to narrow it down.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="p-2.5 bg-muted-teal-50 hover:bg-muted-teal-100 text-muted-teal-900 border border-muted-teal-300 rounded-xl transition-colors shrink-0"
                title="Add New Customer"
              >
                <UserPlus className="w-4 h-4" />
                </button>
              </div>
              


            </div>
          </div>
      
          {/* Active Bill / Cart Table */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-[148px]">
            <div className="shrink-0 h-9 px-3 bg-jungle-teal-100 border-b border-jungle-teal-200 flex items-center gap-2">
              <ShoppingCart className="w-3.5 h-3.5 text-jungle-teal-800 shrink-0" />
              <span className="text-ui-base font-semibold text-jungle-teal-900">Current Bill</span>
              <span className="font-mono text-ui-2xs text-jungle-teal-600 truncate">
                {cart.length} items · {cart.reduce((n, i) => n + i.qty, 0)} units
              </span>
              <button
                type="button"
                onClick={handleClearCart}
                disabled={cart.length === 0}
                className="ml-auto text-ui-xs font-medium text-rose-700 hover:underline disabled:opacity-40 disabled:no-underline shrink-0"
                title="Clear the bill (Esc)"
              >
                Clear{showShortcuts ? ` (${bindingLabel(keys.clearCart)})` : ''}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-jungle-teal-600 text-xs py-12 px-4 text-center">
                  <div className="w-20 h-20 rounded-full bg-muted-teal-50 text-muted-teal-700 flex items-center justify-center mb-3 border border-muted-teal-100/60 shadow-inner">
                    <ShoppingCart className="w-9 h-9" />
                  </div>
                  <h3 className="font-semibold text-jungle-teal-900 text-ui-base mb-1 font-sans">The bill is empty</h3>
                  <p className="text-xs text-jungle-teal-500 max-w-sm mb-4 leading-relaxed font-sans">
                    Scan a barcode, or type a part name to add it<br />
                    Then take payment
                  </p>
                  <button
                    onClick={() => {
                      setUnrecognizedBarcode(null);
                      setShowAddProductModal(true);
                    }}
                    className="px-4 py-2 bg-muted-teal-50 hover:bg-muted-teal-100 text-muted-teal-800 rounded-xl text-xs font-bold border border-muted-teal-200 flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add a new product manually</span>
                  </button>
                </div>
              ) : (
            <div className="divide-y divide-jungle-teal-100">
              {cart.map((item) => (
                <div
                  key={item.product_id}
                  title={item.name}
                  className="group min-h-[50px] py-1.5 px-3 flex items-center gap-2 hover:bg-muted-teal-50/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-ui-sm font-medium text-jungle-teal-900 truncate leading-tight mb-1">
                      {item.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CartPriceInput
                        unitPricePaisa={item.unit_price_paisa}
                        onPriceChange={(newPaisa) => updateCartUnitPrice(item.product_id, newPaisa)}
                      />
                      <span className="text-ui-2xs text-jungle-teal-500 font-sans">
                        / {item.unit || 'pcs'}
                      </span>
                    </div>
                  </div>
            
                  <div className="flex items-center h-7 border border-jungle-teal-200 rounded-lg bg-jungle-teal-100 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.product_id, item.qty - 1)}
                      className="w-7 h-full flex items-center justify-center text-jungle-teal-700 hover:bg-jungle-teal-200 rounded-l-lg transition-colors"
                      title="Decrease"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          updateCartQty(item.product_id, val);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-8 h-full text-center font-mono text-ui-sm font-semibold text-jungle-teal-900 bg-transparent focus:outline-hidden focus:bg-white"
                      title="Quantity"
                    />
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.product_id, item.qty + 1)}
                      className="w-7 h-full flex items-center justify-center text-jungle-teal-700 hover:bg-jungle-teal-200 rounded-r-lg transition-colors"
                      title="Increase"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
            
                  <div className="w-[88px] text-right font-mono text-ui-sm font-semibold text-jungle-teal-900 shrink-0 whitespace-nowrap">
                    ৳ {((item.unit_price_paisa * item.qty) / 100).toFixed(2)}
                  </div>
            
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product_id)}
                    className="w-5 h-5 shrink-0 flex items-center justify-center rounded text-jungle-teal-600 opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity"
                    title="Remove from bill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
              )}
            </div>
          </div>
          <div className="shrink-0 min-h-0 border-t border-jungle-teal-100 px-3 py-2.5 space-y-2 overflow-y-auto">
          {/* Pricing Calculation Summary */}
          <div className="shrink-0 space-y-2 border-b border-jungle-teal-100 pb-3">
            <div className="flex justify-between items-center text-ui-sm">
              <span className="text-jungle-teal-600 font-sans">Subtotal</span>
              <span className="font-mono font-bold text-jungle-teal-900">
                ৳ {(subtotalPaisa / 100).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-ui-sm">
              <span className="text-jungle-teal-600 font-sans flex items-center gap-1.5">
                Discount (৳)
                {showShortcuts && (
                  <span className="font-mono text-ui-2xs font-semibold text-jungle-teal-600 bg-jungle-teal-100 border border-jungle-teal-200 rounded px-1.5 py-0.5">
                    {bindingLabel(keys.focusDiscount)}
                  </span>
                )}
              </span>
              <div className="relative flex items-center">
                <span className="absolute left-2.5 text-xs text-muted-teal-800 font-bold font-mono">৳</span>
                <input
                  ref={discountInputRef}
                  type="number"
                  min="0"
                  value={discountTaka}
                  onChange={(e) => setDiscountTaka(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      cashInputRef.current?.focus();
                      cashInputRef.current?.select();
                    }
                  }}
                  placeholder="0"
                  className="w-28 h-9 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl pl-7 pr-3 text-ui-sm text-right font-mono font-semibold text-jungle-teal-800 focus:outline-hidden focus:border-muted-teal-700"
                />
              </div>
            </div>


            {/* Big Highlighted Payable Box */}
            <div className="flex flex-col gap-1 mt-1">
              {previousDuePaidPaisa > 0 && (
                <div className="flex items-center bg-amber-50 text-amber-900 px-3.5 py-1.5 rounded-xl border border-amber-200">
                  <span className="text-ui-xs text-amber-700 font-sans font-medium">Prev. Due Added</span>
                  <span className="ml-auto text-sm font-semibold font-mono tracking-tight leading-none">
                    + ৳ {(previousDuePaidPaisa / 100).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center bg-white text-jungle-teal-900 px-3.5 py-2 rounded-xl border border-jungle-teal-200/50">
                <span className="text-ui-xs text-jungle-teal-700 font-sans">Payable</span>
                <span className="ml-auto text-ui-2xl font-semibold font-mono tracking-tight leading-none">
                  ৳ {(grandTotalExpectedPaisa / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Split Payment Methods */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <label className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans block">
                Payment breakdown
              </label>
              <button
                type="button"
                disabled={previousDuePaidPaisa > 0}
                onClick={() => (isDueSaleMode ? setIsDueSaleMode(false) : handleFullDue())}
                className={`h-8 px-3 text-ui-xs font-medium rounded-xl border transition-colors flex items-center gap-1.5 ${
                  previousDuePaidPaisa > 0
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : isDueSaleMode
                    ? 'bg-amber-500 border-amber-600 text-white'
                    : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                }`}
                title={
                  previousDuePaidPaisa > 0
                    ? 'Cannot make a due sale while collecting previous due'
                    : isDueSaleMode
                    ? 'This bill is set to due — click to cancel'
                    : 'Put the whole bill on the customer’s account'
                }
              >
                {isDueSaleMode && <Check className="w-3 h-3 shrink-0" />}
                <span>Due sale</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex items-center flex-1 min-w-0">
                <span className="absolute left-2.5 pointer-events-none">
                  <CashIcon className="w-4 h-4 text-muted-teal-700" />
                </span>
                <input
                  ref={cashInputRef}
                  type="number"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => {
                    setCashAmount(e.target.value);
                    // Taking money is the opposite of "collect nothing now", so
                    // the chip lets go rather than sitting lit and misleading.
                    if (Math.round((parseFloat(e.target.value) || 0) * 100) > 0) {
                      setIsDueSaleMode(false);
                    }
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleStartCheckout();
                    }
                  }}
                  placeholder="Cash received"
                  className={`w-full h-[40px] bg-jungle-teal-50 border border-muted-teal-300 focus:border-muted-teal-700 rounded-xl pl-8 text-ui-base font-mono font-semibold text-jungle-teal-900 focus:outline-hidden transition-colors ${
                    showShortcuts ? 'pr-[74px]' : 'pr-[52px]'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleQuickCash}
                  title="Fill in the exact payable as cash (F4)"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2.5 rounded-lg border border-muted-teal-300 bg-white hover:bg-muted-teal-50 text-ui-2xs font-bold text-muted-teal-800 shadow-2xs transition-colors"
                >
                  Exact{showShortcuts ? ` (${bindingLabel(keys.exactCash)})` : ''}
                </button>
              </div>
            
              {/* Opens the choice of wallet or card. Once one holds money the
                  button carries its name, so the cashier can see at a glance
                  how the bill is being paid. */}
              <button
                type="button"
                onClick={() => setShowNonCashPicker((open) => !open)}
                aria-expanded={showNonCashPicker}
                title="Pay by bKash, Nagad, card or another method"
                className={`h-[40px] px-3 rounded-xl border flex items-center gap-1.5 text-ui-xs font-semibold shrink-0 transition-colors ${
                  selectedNonCash
                    ? 'border-azure-mist-600 bg-azure-mist-50 text-azure-mist-800'
                    : showNonCashPicker
                      ? 'border-jungle-teal-400 bg-jungle-teal-100 text-jungle-teal-800'
                      : 'border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                }`}
              >
                {selectedNonCash ? (
                  <NonCashIcon method={selectedNonCash.id} />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{selectedNonCash ? selectedNonCash.label : 'Other'}</span>
                {/* Marks it as a button that opens a list, so the "Other" among
                    the choices below does not read as the same control twice. */}
                <ChevronDown
                  className={`w-3 h-3 shrink-0 transition-transform ${showNonCashPicker ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {showNonCashPicker && (
              <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Non-cash payment method">
                {NON_CASH_METHODS.map((m) => {
                  const active = nonCashPaisa[m.id] > 0;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => payByMethod(m.id)}
                      aria-pressed={active}
                      title={active ? `${m.label} holds ৳${(nonCashPaisa[m.id] / 100).toFixed(2)} — tap to clear` : m.hint}
                      className={`h-9 px-2 rounded-lg border flex items-center justify-center gap-1.5 text-ui-xs font-semibold transition-colors ${
                        active
                          ? 'border-azure-mist-600 bg-azure-mist-50 text-azure-mist-800'
                          : 'border-jungle-teal-200 bg-white text-jungle-teal-800 hover:bg-jungle-teal-50 hover:border-jungle-teal-300'
                      }`}
                    >
                      {active ? <Check className="w-3 h-3 shrink-0" /> : <NonCashIcon method={m.id} />}
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Notes the customer is likely to hand over for this exact bill. */}
            {quickCashOptions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-ui-2xs text-jungle-teal-500 shrink-0">Quick cash</span>
                {quickCashOptions.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      setIsDueSaleMode(false);
                      setBkashAmount('');
                      setNagadAmount('');
                      setCardAmount('');
                      setOtherAmount('');
                      setShowNonCashPicker(false);
                      setCashAmount(String(amount));
                    }}
                    title={`Customer hands over ৳${amount} — change ৳${(amount - grandTotalExpectedPaisa / 100).toFixed(2)}`}
                    className="h-7 px-2.5 rounded-lg border border-jungle-teal-200 bg-white hover:bg-muted-teal-50 hover:border-muted-teal-300 text-ui-2xs font-mono font-bold text-jungle-teal-800 transition-colors"
                  >
                    ৳ {amount.toLocaleString('en-US')}
                  </button>
                ))}
              </div>
            )}

            {totalPaidPaisa > 0 && (
              <div className="pt-2.5 border-t border-jungle-teal-100 flex items-center justify-between text-ui-sm font-mono">
                <div className="text-jungle-teal-600">
                  Received: <span className="font-semibold text-jungle-teal-900">৳ {(totalPaidPaisa / 100).toFixed(2)}</span>
                  <span className="ml-1.5 font-sans text-ui-2xs text-jungle-teal-500">{paymentSummaryStr}</span>
                </div>
                {changePaisa > 0 && (
                  <div className="text-muted-teal-800 bg-muted-teal-50 px-2.5 py-0.5 rounded-lg border border-muted-teal-200 font-semibold">
                    Change: ৳ {(changePaisa / 100).toFixed(2)}
                  </div>
                )}
                {duePaisa > 0 && (
                  <div className="text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200 font-semibold">
                    Due: ৳ {(duePaisa / 100).toFixed(2)}
                  </div>
                )}
              </div>
            )}
          </div>

          </div>
      
          <div className="shrink-0 border-t border-jungle-teal-100 px-3 py-2.5">
          {/* Checkout */}
          {(() => {
            const isWalkInPartialDue = !selectedCustomerId && totalPaidPaisa > 0 && duePaisa > 0;

            /*
             * No shift, no sale - and the button says so instead of taking a
             * full cart and failing at the end. Pressing it opens the shift
             * dialog, so the way out is the same control that refused.
             */
            if (!canTakeMoney) {
              return (
                <button
                  type="button"
                  onClick={onOpenShift}
                  className="w-full h-12 font-semibold text-ui-lg rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all bg-amber-600 hover:bg-amber-700 text-white active:scale-[0.99]"
                  title="A sale puts cash in the drawer, and the drawer is counted per shift. Open one first."
                >
                  <Clock className="w-4 h-4" />
                  <span>Open Shift to Sell</span>
                </button>
              );
            }

            return (
              <button
                type="button"
                onClick={() => handleStartCheckout()}
                disabled={cart.length === 0 || loading || isWalkInPartialDue}
                className={`w-full h-12 font-semibold text-ui-lg rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all ${
                  isWalkInPartialDue
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-not-allowed opacity-90'
                    : 'bg-muted-teal-700 hover:bg-muted-teal-800 text-white disabled:opacity-50 active:scale-[0.99]'
                }`}
                title={
                  isWalkInPartialDue
                    ? 'Walk-in customer cannot have remaining due. Select a customer or pay in full.'
                    : 'Complete the sale and print the receipt (F8)'
                }
              >
                <Check className="w-4 h-4" />
                <span>
                  {isWalkInPartialDue
                    ? 'Select Customer for Due'
                    : 'Complete Sale'}
                </span>
                {showShortcuts && (
                  <span className="font-mono text-ui-2xs font-semibold bg-white/20 rounded px-1.5 py-0.5">
                    {bindingLabel(keys.checkout)}
                  </span>
                )}
              </button>
            );
          })()}
          </div>
        </div>
      
      </div>

      {/* Receipt Preview & Confirmation Modal */}

      <ReceiptPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          onConfirmSale={executeFinalCheckout}
          cart={cart}
          customer={selectedCustomer}
          subtotalPaisa={subtotalPaisa}
          discountPaisa={discountPaisa}
          previousDuePaidPaisa={previousDuePaidPaisa}
          totalPaisa={totalPaisa}
        paidPaisa={effectivePaidPaisa}
        changePaisa={effectiveChangePaisa}
        duePaisa={effectiveDuePaisa}
        paymentMethodSummary={paymentSummaryStr}
        invoiceLayout={invoiceLayout}
        loading={loading}
        hasPrinter={hasPrinter}
      />


      {/* Sale Success & Print Feedback Modal */}
      {successSaleMeta && (
        <SaleSuccessModal
          layout={invoiceLayout}
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setSuccessSaleMeta(null);
          }}
          onNewSale={() => {
            setShowSuccessModal(false);
            setSuccessSaleMeta(null);
            barcodeInputRef.current?.focus();
          }}
          invoiceNo={successSaleMeta.invoiceNo}
          totalPaisa={successSaleMeta.totalPaisa}
          paidPaisa={successSaleMeta.paidPaisa}
          changePaisa={successSaleMeta.changePaisa}
          duePaisa={successSaleMeta.duePaisa}
          paymentMethodSummary={successSaleMeta.paymentMethodSummary}
          customer={successSaleMeta.customer}
          autoPrint={successSaleMeta.autoPrint}
          hasPrinter={hasPrinter}
          pdfBase64={invoicePdfBase64}
          onViewInvoice={() => {
            setShowSuccessModal(false);
            setShowInvoiceModal(true);
          }}
        />
      )}

      {/* Final Printed Invoice Modal */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        invoiceNo={lastInvoiceNo}
        pdfBase64={invoicePdfBase64}
        layout={invoiceLayout}
      />

      {/* Held Sales Modal */}
      <HeldSalesModal
        isOpen={showHeldModal}
        onClose={() => {
          setShowHeldModal(false);
          refreshHeldCount();
        }}
        onRestoreCart={(restoredCart) => {
          setCart(restoredCart);
          setShowHeldModal(false);
          refreshHeldCount();
        }}
      />

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <CustomerFormModal
          isOpen={showAddCustomerModal}
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={(newCust) => {
            fetchData();
            setSelectedCustomerId(newCust.id);
            setShowAddCustomerModal(false);
          }}
        />
      )}

      {/* Quick Add Product from Scanned Barcode Modal */}
      {showAddProductModal && (
        <ProductFormModal
          isOpen={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          initialBarcode={unrecognizedBarcode || ''}
          categories={categories}
          onSuccess={async () => {
            setShowAddProductModal(false);
            onRefreshProducts();
            if (unrecognizedBarcode) {
              const code = unrecognizedBarcode;
              setUnrecognizedBarcode(null);
              setTimeout(async () => {
                try {
                  if (window.api) {
                    const fresh = await window.api.products.getByBarcode(code);
                    if (fresh) {
                      addToCart(fresh);
                      toast.success(`"${fresh.name}" was created and added to the bill.`);
                    }
                  }
                } catch (err) {
                  console.error(err);
                }
              }, 400);
            }
          }}
          onAddCategory={async (name: string) => {
            if (!window.api) return null;
            try {
              const cat = await window.api.categories.create(name);
              setCategories((prev) => [...prev, cat]);
              return cat;
            } catch (err: any) {
              toast.error(err.message || 'Failed to add category');
              return null;
            }
          }}
        />
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Scanned Invoice Quick Action Modal */}
      {showInvoiceActionModal && scannedInvoiceSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-jungle-teal-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-azure-mist-100 text-azure-mist-800 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-jungle-teal-900 text-sm">Invoice scanned</h3>
                  <p className="text-[11px] font-mono text-jungle-teal-500">#{scannedInvoiceSale.invoice_no}</p>
                </div>
              </div>
              <button
                onClick={() => setShowInvoiceActionModal(false)}
                className="p-1.5 text-jungle-teal-600 hover:text-jungle-teal-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-jungle-teal-600">
                <span>Date and time</span>
                <span>{new Date(scannedInvoiceSale.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-jungle-teal-600">
                <span>Customer</span>
                <span className="font-sans font-bold text-jungle-teal-800">{scannedInvoiceSale.customer_name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between font-bold text-jungle-teal-900 border-t border-jungle-teal-200 pt-1.5 text-sm">
                <span>Bill total</span>
                <span className="text-azure-mist-800">৳ {((scannedInvoiceSale.total_paisa || 0) / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setShowInvoiceActionModal(false);
                  setShowReturnModal(true);
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Process a return / refund</span>
              </button>

              <button
                onClick={() => {
                  setShowInvoiceActionModal(false);
                  setLastInvoiceNo(scannedInvoiceSale.invoice_no);
                  setInvoicePdfBase64('');
                  setShowInvoiceModal(true);
                }}
                className="w-full py-3 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border border-jungle-teal-300 transition-all active:scale-[0.98]"
              >
                <Printer className="w-4 h-4 text-azure-mist-700" />
                <span>View or reprint the receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return & Refund Modal */}
      {showReturnModal && scannedInvoiceSale && (
        <ReturnRefundModal
          isOpen={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          sale={scannedInvoiceSale}
          onSuccess={() => {
            setShowReturnModal(false);
            onRefreshProducts();
            // A refund pays out of the same drawer.
            onShiftChanged();
            // A refund moves the customer's balance too.
            fetchData();
            toast.success('Return and refund completed.');
          }}
        />
      )}
    </div>
  );
};

