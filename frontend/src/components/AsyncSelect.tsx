import React, { useEffect, useMemo, useRef, useState } from "react";
export type Option = { value: string; label: string; meta?: any };
type Props = { loadOptions: (q: string) => Promise<Option[]>; value?: Option|null; onChange?: (opt: Option|null)=>void; placeholder?: string; disabled?: boolean; };
export function AsyncSelect({ loadOptions, value, onChange, placeholder, disabled }: Props) {
  const [q, setQ] = useState(""); const [opts, setOpts] = useState<Option[]>([]); const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const debouncedLoad = useMemo(() => (text: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => { setOpts(await loadOptions(text)); setOpen(true); }, 250);
  }, [loadOptions]);
  useEffect(() => { if (!q) { setOpts([]); return; } debouncedLoad(q); }, [q, debouncedLoad]);
  return (
    <div className="relative">
      <input className="w-full border rounded px-3 py-2 bg-transparent" placeholder={placeholder||"Search..."}
        value={value ? value.label : q}
        onChange={(e)=>{ onChange?.(null); setQ(e.target.value); }} onFocus={()=> q && setOpen(true)} disabled={disabled}/>
      {open && opts.length>0 && (
        <div className="absolute z-10 mt-1 w-full rounded border bg-white text-black shadow">
          {opts.map(o=>(
            <div key={o.value} className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              onMouseDown={()=>{ onChange?.(o); setQ(""); setOpen(false); }}>{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}
