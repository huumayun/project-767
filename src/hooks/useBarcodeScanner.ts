import { useEffect, useRef } from 'react';

export const useBarcodeScanner = (onScan: (barcode: string) => void) => {
  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(Date.now());
  const scanStartElement = useRef<HTMLElement | null>(null);
  
  // Settings config
  const modeRef = useRef<'speed' | 'prefix'>('speed');
  const prefixKeyRef = useRef<string>('');
  const isPrefixModeActiveRef = useRef<boolean>(false); // tracks if we're currently capturing after prefix was pressed

  useEffect(() => {
    // Load settings once
    if (window.api && window.api.settings) {
      window.api.settings.get().then(s => {
        if (s.barcode_scanner_mode) {
          modeRef.current = s.barcode_scanner_mode;
          prefixKeyRef.current = s.barcode_scanner_prefix || '';
        }
      });
    }

    // Use capture phase to intercept before React
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // PREFIX MODE LOGIC
      if (modeRef.current === 'prefix' && prefixKeyRef.current) {
        if (!isPrefixModeActiveRef.current) {
          if (e.key === prefixKeyRef.current) {
            // Start capturing!
            isPrefixModeActiveRef.current = true;
            barcodeBuffer.current = '';
            scanStartElement.current = document.activeElement as HTMLElement;
            e.preventDefault();
            e.stopPropagation();
          }
          // If not prefix key, just let the human type normally
          return;
        } else {
          // We are in active prefix capture mode!
          e.preventDefault();
          e.stopPropagation();
          
          if (e.key === 'Enter') {
            if (barcodeBuffer.current.length >= 3) {
              onScan(barcodeBuffer.current);
            }
            barcodeBuffer.current = '';
            isPrefixModeActiveRef.current = false;
          } else if (e.key.length === 1) {
            barcodeBuffer.current += e.key;
          }
          return;
        }
      }

      // SPEED ANALYSIS LOGIC (Fallback / Default)
      // Hardware scanners type very fast. Reset if delay > 50ms (human typing)
      if (now - lastKeyTime.current > 50) {
        barcodeBuffer.current = '';
        scanStartElement.current = document.activeElement as HTMLElement;
      }
      lastKeyTime.current = now;

      // Scanners end with 'Enter'
      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 3) {
          const code = barcodeBuffer.current;
          
          // Dirty trick to remove the barcode that the scanner just rapidly typed into the focused input
          const targetEl = scanStartElement.current as HTMLInputElement | HTMLTextAreaElement;
          if (targetEl && (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA')) {
            // We use native setter to bypass React's event tracker
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              'value'
            )?.set;
            
            // Because React state might be a step behind, we clean it immediately AND after a tiny timeout
            const cleanInput = () => {
              if (targetEl.value.endsWith(code)) {
                if (nativeInputValueSetter) {
                  nativeInputValueSetter.call(targetEl, targetEl.value.slice(0, -code.length));
                  targetEl.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                  targetEl.value = targetEl.value.slice(0, -code.length);
                  targetEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }
            };
            
            cleanInput();
            setTimeout(cleanInput, 10);
          }

          onScan(code);
          barcodeBuffer.current = '';
          
          // Stop form submission
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      // Append standard printable characters
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onScan]);
};
