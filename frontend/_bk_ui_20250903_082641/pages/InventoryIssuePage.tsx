import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function InventoryIssuePage() {
  const [sku,setSku]=useState(""); const [qty,setQty]=useState<number>(1);
  function submit(e:React.FormEvent){e.preventDefault(); alert("Issued (stub)");}
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card className="bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937]">
        <CardHeader><CardTitle>Inventory → Issue</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6"><Label className="text-muted-foreground">SKU</Label>
              <Input value={sku} onChange={(e)=>setSku(e.target.value)}
                     className="bg-background dark:bg-[#0b1220] border border-input text-foreground" />
            </div>
            <div className="md:col-span-3"><Label className="text-muted-foreground">Qty</Label>
              <Input type="number" value={qty} onChange={(e)=>setQty(Number(e.target.value||1))}
                     className="bg-background dark:bg-[#0b1220] border border-input text-foreground" />
            </div>
            <div className="md:col-span-3 flex items-end">
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

