// FILE: src/components/qr/QRButton.tsx
import React from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";

export default function QRButton({
  value, label = "QR", size = 160, print = false, className = "",
}: {
  value: string;
  label?: string;
  size?: number;
  print?: boolean;
  className?: string;
}) {
  async function handleClick() {
    const dataUrl = await QRCode.toDataURL(value, { width: size, margin: 1 });
    if (print) {
      const w = window.open("", "_blank", "width=360,height=420");
      if (!w) return;
      w.document.write(`
        <html><head><title>QR</title></head>
        <body style="display:grid;place-items:center;height:100vh;margin:0">
          <img src="${dataUrl}" style="width:${size}px;height:${size}px"/><div style="margin-top:8px;font:14px monospace">${label}</div>
          <script>window.onload=()=>window.print();</script>
        </body></html>`);
      w.document.close();
    } else {
      const a = document.createElement("a");
      a.href = dataUrl; a.download = `qr.png`; a.click();
    }
  }
  return (
    <button onClick={handleClick}
      className={"px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 "+className}
      title="สร้าง/พิมพ์ QR">
      <QrCode className="h-4 w-4 inline mr-1"/>{label}
    </button>
  );
}

