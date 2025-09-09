from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..deps import get_db
from ..models import Item

router = APIRouter(prefix="/items", tags=["items"])

@router.get("")
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).order_by(Item.item_name).all()
