import { useEffect, useState } from 'react';

/**
 * A blob: URL for a base64 PDF, valid while the component is mounted.
 *
 * Chrome - and so Electron - will not render a PDF handed to an <iframe> as a
 * `data:application/pdf` URL: the plugin refuses data URLs, and the frame comes
 * up blank with no error anywhere. A blob: URL is same-origin and the viewer
 * takes it, which is why every PDF preview here goes through this.
 *
 * The URL is revoked when it changes or the component unmounts; left alone the
 * blob stays in memory for the life of the window, and an invoice is megabytes.
 */
export function usePdfObjectUrl(base64: string | undefined | null): string {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!base64) {
      setUrl('');
      return;
    }

    let objectUrl = '';
    try {
      const raw = atob(base64.replace(/^data:.*?base64,/, ''));
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      setUrl(objectUrl);
    } catch {
      setUrl('');
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [base64]);

  return url;
}
