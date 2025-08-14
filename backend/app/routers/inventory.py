from fastapi import APIRouter, Depends
from ..deps import require_perm

router = APIRouter(prefix="/inventory", tags=["inventory"])

@router.post("/receive", dependencies=[Depends(require_perm("stock:receive"))])
async def receive_stock():
    # mock endpoint for permission testing
    return {"ok": True}

