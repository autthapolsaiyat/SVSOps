const BASE = "/api";
function authHeaders(){ const t = localStorage.getItem("access_token")||localStorage.getItem("token")||""; return t?{Authorization:`Bearer ${t}`}:{};
}
async function j(url:string){ const r=await fetch(url,{headers:{...authHeaders(),Accept:"application/json"}}); if(!r.ok) throw new Error(await r.text()); return r.json(); }

export async function listPO(params:{q?:string; limit?:number; offset?:number}) {
  const u = new URL(`${BASE}/purchases`, window.location.origin);
  if (params.q) u.searchParams.set("q", params.q);
  u.searchParams.set("limit", String(params.limit ?? 20));
  u.searchParams.set("offset", String(params.offset ?? 0));
  return j(u.toString());
}
export async function getPO(id:string){ return j(`${BASE}/purchases/${id}`); }
export async function receivePO(id:string, payload:any){
  const r = await fetch(`${BASE}/purchases/${id}/receive`, {
    method:"POST", headers:{...authHeaders(),"Content-Type":"application/json"}, body:JSON.stringify(payload)
  });
  if(!r.ok) throw new Error(await r.text()); return r.json();
}

