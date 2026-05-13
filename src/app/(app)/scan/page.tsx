"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Html5QrcodeCtor = typeof import("html5-qrcode").Html5Qrcode;

const READER_ID = "barcode-reader";

async function safeStop(scanner: InstanceType<Html5QrcodeCtor>) {
  try {
    await scanner.stop();
  } catch {
    // not running or already stopped — ignore
  }
  try {
    scanner.clear();
  } catch {
    // ignore
  }
}

export default function ScanPage() {
  const router = useRouter();
  const scannerRef = useRef<InstanceType<Html5QrcodeCtor> | null>(null);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<"idle" | "starting" | "scanning" | "looking-up" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    async function start() {
      if (!mountedRef.current) return;
      setStatus("starting");
      setError(null);
      try {
        const mod = await import("html5-qrcode");
        if (!mountedRef.current) return;

        const scanner = new mod.Html5Qrcode(READER_ID, {
          verbose: false,
          formatsToSupport: [
            mod.Html5QrcodeSupportedFormats.EAN_13,
            mod.Html5QrcodeSupportedFormats.EAN_8,
            mod.Html5QrcodeSupportedFormats.UPC_A,
            mod.Html5QrcodeSupportedFormats.UPC_E,
            mod.Html5QrcodeSupportedFormats.CODE_128,
          ],
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 160 } },
          async (decoded) => {
            if (!mountedRef.current) return;
            setLastBarcode(decoded);
            setStatus("looking-up");
            await safeStop(scanner);
            if (!mountedRef.current) return;
            const res = await fetch(`/api/foods/barcode/${encodeURIComponent(decoded)}`);
            if (!mountedRef.current) return;
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              if (mountedRef.current) {
                setError(body.error || `Barcode ${decoded} not found.`);
                setStatus("error");
              }
              return;
            }
            const food = await res.json();
            if (mountedRef.current) router.push(`/dashboard?foodId=${encodeURIComponent(food.id)}`);
          },
          () => { /* per-frame decode errors — ignore */ },
        );

        if (mountedRef.current) setStatus("scanning");
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to start camera");
          setStatus("error");
        }
      }
    }

    start();

    return () => {
      mountedRef.current = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) safeStop(s);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Scan Barcode</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Point your camera at a product barcode. Found products are saved to your library automatically.
        </p>
      </div>

      <div className="card p-3">
        <div id={READER_ID} className="w-full aspect-video bg-slate-900 rounded-lg overflow-hidden" />
        <div className="mt-3 text-sm">
          {status === "starting" && <p className="text-slate-500">Starting camera...</p>}
          {status === "scanning" && <p className="text-brand-600">Scanning...</p>}
          {status === "looking-up" && <p className="text-brand-600">Looking up {lastBarcode}...</p>}
          {status === "error" && (
            <div className="space-y-2">
              <p className="text-red-600">{error}</p>
              <button className="btn-primary" onClick={() => location.reload()}>Try again</button>
            </div>
          )}
        </div>
      </div>

      <button className="btn-secondary w-full" onClick={() => router.push("/dashboard")}>
        Cancel
      </button>
    </div>
  );
}
