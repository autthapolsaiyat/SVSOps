// FILE: src/components/qr/ScanModal.tsx
import React, { useEffect, useRef, useState } from "react";

type ScannerControls = { stop: () => void } | null;

export default function ScanModal({
  open, onClose, onResult,
}: { open: boolean; onClose: () => void; onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reader, setReader] = useState<any>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const controlsRef = useRef<ScannerControls>(null);

  // โหลดไลบรารีเฉพาะตอนเปิด
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const mod = await import("@zxing/browser");
      if (cancelled) return;

      const r = new mod.BrowserMultiFormatReader();
      setReader(r);

      const ds = await mod.BrowserMultiFormatReader.listVideoInputDevices();
      if (!cancelled) {
        setDevices(ds);
        setDeviceId(ds[0]?.deviceId ?? null);
      }
    })();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch {}
      setReader(null);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !reader || !videoRef.current) return;
    const id = deviceId ?? undefined;

    const controls = (reader as any).decodeFromVideoDevice(
      id,
      videoRef.current,
      (res: any) => {
        if (res) {
          try { onResult(res.getText()); } catch {}
          try { controlsRef.current?.stop(); } catch {}
          onClose();
        }
      }
    );

    // บางเวอร์ชันคืน IScannerControls, บางเวอร์ชันคืน void
    if (controls && typeof controls.stop === "function") {
      controlsRef.current = controls as ScannerControls;
    } else {
      controlsRef.current = null;
    }

    return () => { try { controlsRef.current?.stop(); } catch {} };
  }, [open, reader, deviceId, onClose, onResult]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-4 w-[90vw] max-w-xl space-y-3">
        <div className="flex items-center justify-between">
          <b>สแกน QR</b>
          <button onClick={onClose}>ปิด</button>
        </div>
        <select value={deviceId ?? ""} onChange={(e)=>setDeviceId(e.target.value || null)}>
          {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || d.deviceId}</option>)}
        </select>
        <video ref={videoRef} className="w-full rounded-lg" />
      </div>
    </div>
  );
}

