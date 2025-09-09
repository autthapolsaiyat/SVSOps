import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <Card className="bg-card dark:bg-[#0f172a] border border-border dark:border-[#1f2937]">
        <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Export CSV</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Export PDF</Button>
        </CardContent>
      </Card>
    </div>
  );
}

