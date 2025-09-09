// FILE: src/components/inputs/SuggestInput.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils"; // ถ้าโปรเจ็กต์ไม่มีฟังก์ชัน cn ให้ลบทิ้ง/ไม่ใช้ก็ได้

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPick?: (v: string) => void;
  fetcher: (q: string) => Promise<string[]>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export default function SuggestInput({
  value, onChange, onPick, fetcher, placeholder, className, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [idx, setIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = async (q: string) => {
    try {
      if (!q.trim()) { setItems([]); setOpen(false); return; }
      const res = await fetcher(q.trim());
      setItems(res || []);
      setOpen((res || []).length > 0);
      setIdx(-1);
    } catch { /* ignore */ }
  };

  // debounce
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(value), 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // click outside
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (v: string) => {
    onChange(v);
    onPick?.(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && idx >= 0) { e.preventDefault(); pick(items[idx]); }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={disabled}
        className={cn?.("bg-background/60", className) || `bg-background/60 ${className||""}`}
        onFocus={()=> value && doSearch(value)}
      />
      {open && items.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-lg max-h-64 overflow-auto">
          {items.map((s, i) => (
            <div
              key={`${s}-${i}`}
              className={cn?.(
                "px-2 py-1.5 text-sm cursor-pointer hover:bg-muted",
                i === idx ? "bg-muted" : ""
              ) || `px-2 py-1.5 text-sm cursor-pointer hover:bg-muted ${i===idx?"bg-muted":""}`}
              onMouseDown={(e)=>{ e.preventDefault(); pick(s); }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

