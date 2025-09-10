// FILE: src/components/ui/select.tsx  (lightweight shim for shadcn Select)
//------------------------------------------------------------
import * as React from 'react';

type SelectRootProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children?: React.ReactNode;
};

export function Select({ value, defaultValue, onValueChange, className = '', children }: SelectRootProps) {
  // Collect SelectItem children (possibly nested in SelectContent)
  const items: Array<{ value: string; label: React.ReactNode }> = [];
  let placeholder: string | undefined;

  function walk(node: any) {
    if (!node) return;
    const t = node.type?.displayName || node.type?.name;
    if (t === 'SelectItem') {
      items.push({ value: String(node.props.value ?? ''), label: node.props.children });
    } else if (t === 'SelectValue' && node.props?.placeholder) {
      placeholder = node.props.placeholder;
    } else if (node.props?.children) {
      React.Children.forEach(node.props.children, walk);
    }
  }
  React.Children.forEach(children as any, walk);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onValueChange?.(e.target.value);
  };

  return (
    <select className={`border rounded-md px-2 py-2 bg-transparent ${className}`} value={value} defaultValue={defaultValue} onChange={handleChange}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {items.map((it, idx) => (
        <option key={idx} value={it.value}>{it.label}</option>
      ))}
    </select>
  );
}

export function SelectTrigger({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  // no-op wrapper for compatibility
  return <div className={className}>{children}</div>;
}
export function SelectValue({ placeholder }: { placeholder?: string }) {
  return null; // handled by <Select/>
}
export function SelectContent({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
export function SelectItem({ value, children }: { value: string; children?: React.ReactNode }) {
  // This is only used as a marker for the shim; actual rendering happens in <Select/>
  return <>{children}</>;
}
SelectItem.displayName = 'SelectItem';
SelectContent.displayName = 'SelectContent';
SelectTrigger.displayName = 'SelectTrigger';
SelectValue.displayName = 'SelectValue';


