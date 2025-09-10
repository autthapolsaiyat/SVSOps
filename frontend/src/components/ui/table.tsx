import * as React from "react";

export function Table(props: React.TableHTMLAttributes<HTMLTableElement>) {
  const { className = "", ...rest } = props;
  return <table className={`w-full text-sm ${className}`} {...rest} />;
}
export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  const { className = "", ...rest } = props;
  return <thead className={`text-zinc-400 ${className}`} {...rest} />;
}
export function TableHead(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const { className = "", ...rest } = props;
  return <th className={`border-b border-zinc-800 px-3 py-2 text-left ${className}`} {...rest} />;
}
export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  const { className = "", ...rest } = props;
  return <tbody className={className} {...rest} />;
}
export function TableRow(props: React.HTMLAttributes<HTMLTableRowElement>) {
  const { className = "", ...rest } = props;
  return <tr className={`border-b border-zinc-900 hover:bg-zinc-900/40 ${className}`} {...rest} />;
}
export function TableCell(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  const { className = "", ...rest } = props;
  return <td className={`px-3 py-2 ${className}`} {...rest} />;
}

