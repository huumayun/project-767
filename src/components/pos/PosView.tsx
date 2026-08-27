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
} from 'lucide-react';

import { InvoiceModal } from './InvoiceModal';
import { HeldSalesModal } from './HeldSalesModal';
import { CustomerFormModal } from '../customers/CustomerFormModal';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { ProductFormModal } from '../products/ProductFormModal';
import { ReturnRefundModal } from './ReturnRefundModal';
import { useToast } from '../../context/ToastContext';
import { audio } from '../../utils/audio';
import { BkashIcon, NagadIcon, CashIcon, CardBankIcon } from './PosIcons';
import {
  getShortcuts,
  matchesBinding,
  bindingLabel,
  SHORTCUTS_CHANGED_EVENT,
} from '../../utils/shortcuts';

interface PosViewProps {

  products: Product[];
  currentSession: UserSession | null;
  onRefreshProducts: () => void;
}

export const PosView: React.FC<PosViewProps> = ({
  products,
  currentSession,
  onRefreshProducts,
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
  const [bkashAmount, setBkashAmount] = useState<string>('');
  const [nagadAmount, setNagadAmount] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [discountTaka, setDiscountTaka] = useState<string>('0');
  const [invoiceLayout, setInvoiceLayout] = useState<'80mm' | 'a5'>('80mm');
  const [isDueSaleMode, setIsDueSaleMode] = useState(false);


  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
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
      if (shopSettings?.default_invoice_layout === 'a5' || shopSettings?.default_invoice_layout === '80mm') {
        setInvoiceLayout(shopSettings.default_invoice_layout);
      }
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


      const now = Date.now();
      if (e.key === 'Enter' && scanBuffer.length > 2) {
        handleBarcodeScanned(scanBuffer.trim());
        scanBuffer = '';
        return;
      }

      if (now - lastKeyTime > 150) {
        scanBuffer = '';
      }
      if (e.key.length === 1) {
        scanBuffer += e.key;
      }
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cart, products]);


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

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setCashAmount('');
    setBkashAmount('');
    setNagadAmount('');
    setCardAmount('');
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

  const cashPaisa = Math.round((parseFloat(cashAmount) || 0) * 100);
  const bkashPaisa = Math.round((parseFloat(bkashAmount) || 0) * 100);
  const nagadPaisa = Math.round((parseFloat(nagadAmount) || 0) * 100);
  const cardPaisa = Math.round((parseFloat(cardAmount) || 0) * 100);

  const totalPaidPaisa = cashPaisa + bkashPaisa + nagadPaisa + cardPaisa;
  const isFullDue = isDueSaleMode && Boolean(selectedCustomerId);
  const effectiveCashPaisa = (!isFullDue && totalPaidPaisa === 0) ? totalPaisa : cashPaisa;
  const effectivePaidPaisa = isFullDue ? 0 : (totalPaidPaisa === 0 ? totalPaisa : totalPaidPaisa);
  const effectiveChangePaisa = Math.max(0, effectivePaidPaisa - totalPaisa);
  const effectiveDuePaisa = Math.max(0, totalPaisa - effectivePaidPaisa);

  const changePaisa = Math.max(0, totalPaidPaisa - totalPaisa);
  const duePaisa = Math.max(0, totalPaisa - totalPaidPaisa);

  let paymentSummaryStr = 'Cash';
  if (isFullDue) paymentSummaryStr = 'Full Due';
  else if (bkashPaisa > 0 && cashPaisa > 0) paymentSummaryStr = 'Cash + bKash';
  else if (bkashPaisa > 0) paymentSummaryStr = 'bKash';
  else if (nagadPaisa > 0) paymentSummaryStr = 'Nagad';
  else if (cardPaisa > 0) paymentSummaryStr = 'Card';

  // Quick Cash Fill (F4)
  const handleQuickCash = () => {
    if (totalPaisa <= 0) return;
    setIsDueSaleMode(false);
    setCashAmount((totalPaisa / 100).toFixed(2));
    setBkashAmount('');
    setNagadAmount('');
    setCardAmount('');
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
    toast.info(`Due sale: ৳${(totalPaisa / 100).toFixed(2)} — press Complete Sale to record it.`);
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
    if (isDueSaleMode && selectedCustomerId) {
      const customerName =
        customers.find((c) => c.id === selectedCustomerId)?.name || 'this customer';
      setConfirmModalConfig({
        isOpen: true,
        title: 'Confirm due sale',
        message: `Record ৳ ${(totalPaisa / 100).toFixed(
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
        message: `Has the customer paid the full ৳ ${(totalPaisa / 100).toFixed(2)} in cash?`,
        onConfirm: () => {
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
          setCashAmount((totalPaisa / 100).toFixed(2));
          setShowPreviewModal(true);
        },
      });
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

    if (!window.api) return;
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
    }

    try {
      const res = await window.api.sales.create({
        customer_id: selectedCustomerId || null,
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

        if (shouldPrint) {
          setShowInvoiceModal(true);
        }

        handleClearCart();
        // Back to walk-in, so the next person at the counter cannot be billed
        // to whoever was served last. Done here rather than in handleClearCart
        // so a manual Clear (a mis-scan) keeps the customer in place.
        setSelectedCustomerId('');
        onRefreshProducts();
        // The sale just moved this customer's balance. `customers` was loaded
        // once at mount, so without this the picker keeps showing the old due.
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Checkout failed.');
      setError(err.message || 'Checkout failed.');
    } finally {
      setLoading(false);
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
  const payExactBy = (method: 'bkash' | 'nagad' | 'card') => {
    const current =
      method === 'bkash' ? bkashPaisa : method === 'nagad' ? nagadPaisa : cardPaisa;
    const setAmount =
      method === 'bkash'
        ? setBkashAmount
        : method === 'nagad'
        ? setNagadAmount
        : setCardAmount;

    // Tapping a chip that is already carrying an amount clears it, so a
    // mis-tap is undoable without reaching for the keyboard.
    if (current > 0) {
      setAmount('');
      return;
    }

    // Fill only what is still outstanding. Anything already entered — cash, or
    // another transfer — stays put, so a bill can still be split across
    // methods (e.g. ৳1,000 cash then bKash for the rest).
    const outstandingPaisa = totalPaisa - totalPaidPaisa;
    setAmount(outstandingPaisa > 0 ? (outstandingPaisa / 100).toFixed(2) : '');
  };

  // ── Browse lists ───────────────────────────────────────────────────
  // `filteredProducts` above stays search-only (it returns nothing while the
  // search box is empty). These drive the browse panel instead.
  const productCountByCategory = products.reduce<Record<string, number>>((acc, p) => {
    const key = p.category_id || '';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const visibleCategories = categories
    .filter((c) => c.name.toLowerCase().includes(categoryFilter.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const categoryProducts = products.filter(
    (p) => !selectedCategoryId || p.category_id === selectedCategoryId
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

  const selectedCategoryName =
    categories.find((c) => c.id === selectedCategoryId)?.name || 'All products';

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
                className={`w-full bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl pl-10 py-2 text-xs text-jungle-teal-900 focus:outline-hidden focus:border-muted-teal-700 font-mono font-semibold placeholder:font-sans placeholder:text-jungle-teal-400 ${
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
                  ? 'bg-jungle-teal-800 border-jungle-teal-800 text-white'
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
        {/* Categories are flat in the schema ({id, name}, no parent_id), so the  */}
        {/* list is narrowed by a filter box and a brand axis, not a tree.        */}
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
      
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSelectedCategoryId(c.id); setSelectedBrand(''); }}
                title={c.name}
                className={`w-full min-h-8 px-2.5 py-1.5 rounded-lg flex items-start gap-2 text-left text-ui-sm transition-colors ${
                  selectedCategoryId === c.id
                    ? 'bg-muted-teal-800 text-white font-semibold'
                    : 'text-jungle-teal-700 hover:bg-jungle-teal-100'
                }`}
              >
                <span className="flex-1 leading-tight break-words">{c.name}</span>
                <span
                  className={`font-mono text-ui-2xs shrink-0 ${
                    (productCountByCategory[c.id] || 0) === 0 ? "opacity-35" : "opacity-70"
                  }`}
                >
                  {productCountByCategory[c.id] || 0}
                </span>
              </button>
            ))}
      
            {visibleCategories.length === 0 && (
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
                        <span className="font-mono text-ui-2xs text-jungle-teal-400 truncate">
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
                          ? 'border border-jungle-teal-200 text-jungle-teal-300'
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
                  className="p-1 text-jungle-teal-400 hover:text-jungle-teal-700 rounded-lg"
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
                  <PauseCircle className="w-3.5 h-3.5 text-jungle-teal-400" />
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
                  <svg className="w-3.5 h-3.5 text-jungle-teal-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              
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
                <div className="h-full flex flex-col items-center justify-center text-jungle-teal-400 text-xs py-12 px-4 text-center">
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
                  className="group h-[46px] px-3 flex items-center gap-2 hover:bg-muted-teal-50/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-ui-sm font-medium text-jungle-teal-900 truncate leading-tight">
                      {item.name}
                    </div>
                    <div className="text-ui-2xs font-mono text-jungle-teal-600 leading-tight">
                      ৳ {(item.unit_price_paisa / 100).toFixed(2)}
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
                    <span className="w-7 text-center font-mono text-ui-sm font-semibold text-jungle-teal-900">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.product_id, item.qty + 1)}
                      className="w-7 h-full flex items-center justify-center text-jungle-teal-700 hover:bg-jungle-teal-200 rounded-r-lg transition-colors"
                      title="Increase"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
            
                  <div className="w-[92px] text-right font-mono text-ui-sm font-semibold text-jungle-teal-900 shrink-0 whitespace-nowrap">
                    ৳ {((item.unit_price_paisa * item.qty) / 100).toFixed(2)}
                  </div>
            
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product_id)}
                    className="w-5 h-5 shrink-0 flex items-center justify-center rounded text-jungle-teal-400 opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity"
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
            <div className="flex items-center bg-jungle-teal-900 text-white px-3.5 py-2 rounded-xl mt-1">
              <span className="text-ui-xs text-jungle-teal-300 font-sans">Payable</span>
              <span className="ml-auto text-ui-2xl font-semibold font-mono tracking-tight leading-none">
                ৳ {(totalPaisa / 100).toFixed(2)}
              </span>
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
                onClick={() => (isDueSaleMode ? setIsDueSaleMode(false) : handleFullDue())}
                className={`h-8 px-3 text-ui-xs font-medium rounded-xl border transition-colors flex items-center gap-1.5 ${
                  isDueSaleMode
                    ? 'bg-amber-500 border-amber-600 text-white'
                    : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                }`}
                title={
                  isDueSaleMode
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
                  onChange={(e) => setCashAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleStartCheckout();
                    }
                  }}
                  placeholder="Cash"
                  className={`w-full h-[40px] bg-jungle-teal-50 border border-muted-teal-300 focus:border-muted-teal-700 rounded-xl pl-8 text-ui-base font-mono font-semibold text-jungle-teal-900 focus:outline-hidden transition-colors ${
                    showShortcuts ? 'pr-[74px]' : 'pr-[52px]'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleQuickCash}
                  title="Fill in the exact payable as cash (F4)"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2 rounded-lg text-ui-2xs font-semibold text-muted-teal-800 hover:bg-muted-teal-100 transition-colors"
                >
                  Exact{showShortcuts ? ` (${bindingLabel(keys.exactCash)})` : ''}
                </button>
              </div>
            
              <button
                type="button"
                onClick={() => payExactBy('bkash')}
                title="bKash — fills the outstanding balance; tap again to clear"
                className={`h-[40px] px-2.5 rounded-xl border flex items-center gap-1.5 text-ui-xs font-medium shrink-0 transition-colors ${
                  Number(bkashAmount) > 0
                    ? 'border-[#D12053] bg-[#D12053]/10 text-[#D12053]'
                    : 'border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#D12053] shrink-0" />
                <span>bKash</span>
              </button>
            
              <button
                type="button"
                onClick={() => payExactBy('nagad')}
                title="Nagad — fills the outstanding balance; tap again to clear"
                className={`h-[40px] px-2.5 rounded-xl border flex items-center gap-1.5 text-ui-xs font-medium shrink-0 transition-colors ${
                  Number(nagadAmount) > 0
                    ? 'border-[#F7941D] bg-[#F7941D]/10 text-amber-800'
                    : 'border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#F7941D] shrink-0" />
                <span>Nagad</span>
              </button>
            
              <button
                type="button"
                onClick={() => payExactBy('card')}
                title="Card / bank — fills the outstanding balance; tap again to clear"
                className={`h-[40px] px-2.5 rounded-xl border flex items-center gap-1.5 text-ui-xs font-medium shrink-0 transition-colors ${
                  Number(cardAmount) > 0
                    ? 'border-blue-600 bg-blue-600/10 text-blue-700'
                    : 'border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span>Card</span>
              </button>
            </div>

            {totalPaidPaisa > 0 && (
              <div className="pt-2.5 border-t border-jungle-teal-100 flex items-center justify-between text-ui-sm font-mono">
                <div className="text-jungle-teal-600">
                  Received: <span className="font-semibold text-jungle-teal-900">৳ {(totalPaidPaisa / 100).toFixed(2)}</span>
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
          <button
            type="button"
            onClick={() => handleStartCheckout()}
            disabled={cart.length === 0 || loading}
            className="w-full h-12 bg-muted-teal-700 hover:bg-muted-teal-800 text-white font-semibold text-ui-lg rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 active:scale-[0.99]"
            title="Complete the sale and print the receipt (F8)"
          >
            <Check className="w-4 h-4" />
            <span>Complete Sale</span>
            {showShortcuts && (
              <span className="font-mono text-ui-2xs font-semibold bg-white/20 rounded px-1.5 py-0.5">
                {bindingLabel(keys.checkout)}
              </span>
            )}
          </button>
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
        totalPaisa={totalPaisa}
        paidPaisa={effectivePaidPaisa}
        changePaisa={effectiveChangePaisa}
        duePaisa={effectiveDuePaisa}
        paymentMethodSummary={paymentSummaryStr}
        invoiceLayout={invoiceLayout}
        loading={loading}
      />


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
                className="p-1.5 text-jungle-teal-400 hover:text-jungle-teal-700 rounded-lg"
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
            // A refund moves the customer's balance too.
            fetchData();
            toast.success('Return and refund completed.');
          }}
        />
      )}
    </div>
  );
};

