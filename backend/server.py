from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import hmac
import hashlib
import secrets
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
import razorpay
 
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
 
# Mongo
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
 
# Razorpay
RZP_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RZP_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
rzp_client = razorpay.Client(auth=(RZP_KEY_ID, RZP_KEY_SECRET)) if RZP_KEY_ID and RZP_KEY_SECRET else None
 
# JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me-in-prod')
JWT_ALG = 'HS256'
 
# Domain config
SECURITY_DEPOSIT_PAISE = int(os.environ.get('SECURITY_DEPOSIT_PAISE', '200000'))  # ₹2000
MONTHLY_FEE_PAISE = int(os.environ.get('MONTHLY_FEE_PAISE', '50000'))  # ₹500/month default
MAX_SLOT_CAPACITY = 8
 
SLOTS = [
    {"id": "0500", "label": "5:00 - 6:00 AM"},
    {"id": "0600", "label": "6:00 - 7:00 AM"},
    {"id": "0700", "label": "7:00 - 8:00 AM"},
    {"id": "0800", "label": "8:00 - 9:00 AM"},
    {"id": "1600", "label": "4:00 - 5:00 PM"},
    {"id": "1700", "label": "5:00 - 6:00 PM"},
    {"id": "1800", "label": "6:00 - 7:00 PM"},
    {"id": "1900", "label": "7:00 - 8:00 PM"},
    {"id": "2000", "label": "8:00 - 9:00 PM"},
]
 
app = FastAPI()
api_router = APIRouter(prefix="/api")
 
# ----------- Helpers -----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
 
def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False
 
def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
 
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user
 
async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user
 
def verify_rzp_signature(order_id: str, payment_id: str, signature: str) -> bool:
    body = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(RZP_KEY_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
 
# ----------- Schemas -----------
class RegisterInit(BaseModel):
    name: str
    mobile: str
    email: Optional[str] = None
    flat_number: Optional[str] = None
    password: str
 
class RegisterVerify(BaseModel):
    pending_user_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
 
class LoginRequest(BaseModel):
    mobile: str
    password: str
 
class BookingInit(BaseModel):
    slot_id: str
    month: str  # YYYY-MM
 
class BookingVerify(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
 
class HolidayCreate(BaseModel):
    date: str  # YYYY-MM-DD
    reason: Optional[str] = ""
 
class ResetPwd(BaseModel):
    new_password: str
 
# ----------- Public -----------
@api_router.get("/")
async def root():
    return {"message": "Badminton Court API", "slots": SLOTS}
 
@api_router.get("/config")
async def get_config():
    return {
        "security_deposit": SECURITY_DEPOSIT_PAISE // 100,
        "monthly_fee": MONTHLY_FEE_PAISE // 100,
        "razorpay_key_id": RZP_KEY_ID,
        "slots": SLOTS,
        "max_capacity": MAX_SLOT_CAPACITY,
    }
 
@api_router.get("/slots/public-availability")
async def public_slot_availability(month: str):
    bookings = await db.bookings.find({"month": month, "status": "confirmed"}, {"_id": 0}).to_list(1000)
    counts = {s["id"]: 0 for s in SLOTS}
    for b in bookings:
        counts[b["slot_id"]] = counts.get(b["slot_id"], 0) + 1
    result = []
    for s in SLOTS:
        result.append({
            "id": s["id"],
            "label": s["label"],
            "booked": counts[s["id"]],
            "available": max(0, MAX_SLOT_CAPACITY - counts[s["id"]]),
            "capacity": MAX_SLOT_CAPACITY,
        })
    return {"month": month, "slots": result}
 
# ----------- Auth -----------
@api_router.post("/auth/register/init")
async def register_init(payload: RegisterInit):
    mobile = payload.mobile.strip()
    if len(mobile) != 10 or not mobile.isdigit():
        raise HTTPException(400, "Mobile must be 10 digits")
    if len(payload.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    existing = await db.users.find_one({"mobile": mobile, "status": "active"})
    if existing:
        raise HTTPException(400, "Mobile already registered")
    if not rzp_client:
        raise HTTPException(500, "Payment gateway not configured. Please contact admin.")
 
    pending_id = str(uuid.uuid4())
    order = rzp_client.order.create({
        "amount": SECURITY_DEPOSIT_PAISE,
        "currency": "INR",
        "receipt": f"dep_{pending_id[:20]}",
        "notes": {"type": "security_deposit", "mobile": mobile},
    })
    user_doc = {
        "id": pending_id,
        "name": payload.name.strip(),
        "mobile": mobile,
        "email": payload.email or "",
        "flat_number": payload.flat_number or "",
        "password": hash_password(payload.password),
        "role": "user",
        "status": "pending_payment",
        "deposit_paid": False,
        "deposit_refunded": False,
        "deposit_order_id": order["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return {
        "pending_user_id": pending_id,
        "order_id": order["id"],
        "amount": SECURITY_DEPOSIT_PAISE,
        "currency": "INR",
        "key_id": RZP_KEY_ID,
        "name": payload.name,
        "mobile": mobile,
    }
 
@api_router.post("/auth/register/verify")
async def register_verify(payload: RegisterVerify):
    user = await db.users.find_one({"id": payload.pending_user_id})
    if not user:
        raise HTTPException(404, "Registration not found")
    if not verify_rzp_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "status": "active",
            "deposit_paid": True,
            "deposit_payment_id": payload.razorpay_payment_id,
            "deposit_paid_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "security_deposit",
        "order_id": payload.razorpay_order_id,
        "payment_id": payload.razorpay_payment_id,
        "amount": SECURITY_DEPOSIT_PAISE,
        "status": "captured",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "mobile": user["mobile"], "role": user["role"]}}
 
@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    mobile = payload.mobile.strip()
    user = await db.users.find_one({"mobile": mobile, "status": "active"})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(401, "Invalid mobile or password")
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "mobile": user["mobile"], "role": user["role"], "email": user.get("email", ""), "flat_number": user.get("flat_number", "")}}
 
@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"id": user["id"], "name": user["name"], "mobile": user["mobile"], "role": user["role"], "email": user.get("email", ""), "flat_number": user.get("flat_number", ""), "deposit_paid": user.get("deposit_paid", False)}
 
# ----------- Slot availability -----------
@api_router.get("/slots/availability")
async def slot_availability(month: str, user=Depends(get_current_user)):
    bookings = await db.bookings.find({"month": month, "status": "confirmed"}, {"_id": 0}).to_list(1000)
    counts = {s["id"]: 0 for s in SLOTS}
    user_slot = None
    for b in bookings:
        counts[b["slot_id"]] = counts.get(b["slot_id"], 0) + 1
        if b["user_id"] == user["id"]:
            user_slot = b["slot_id"]
    result = []
    for s in SLOTS:
        result.append({
            "id": s["id"],
            "label": s["label"],
            "booked": counts[s["id"]],
            "available": max(0, MAX_SLOT_CAPACITY - counts[s["id"]]),
            "capacity": MAX_SLOT_CAPACITY,
            "is_yours": user_slot == s["id"],
        })
    return {"month": month, "slots": result, "user_has_booking": user_slot is not None}
 
# ----------- Bookings -----------
@api_router.post("/bookings/init")
async def booking_init(payload: BookingInit, user=Depends(get_current_user)):
    # Validate slot
    if not any(s["id"] == payload.slot_id for s in SLOTS):
        raise HTTPException(400, "Invalid slot")
    # Validate month format
    try:
        datetime.strptime(payload.month, "%Y-%m")
    except ValueError:
        raise HTTPException(400, "Invalid month (YYYY-MM)")
    # Check existing booking by user in same month
    existing = await db.bookings.find_one({"user_id": user["id"], "month": payload.month, "status": "confirmed"})
    if existing:
        raise HTTPException(400, "You already have a booking for this month")
    # Check capacity
    count = await db.bookings.count_documents({"slot_id": payload.slot_id, "month": payload.month, "status": "confirmed"})
    if count >= MAX_SLOT_CAPACITY:
        raise HTTPException(400, "Slot is full for this month")
    if not rzp_client:
        raise HTTPException(500, "Payment gateway not configured")
 
    booking_id = str(uuid.uuid4())
    order = rzp_client.order.create({
        "amount": MONTHLY_FEE_PAISE,
        "currency": "INR",
        "receipt": f"bk_{booking_id[:20]}",
        "notes": {"type": "monthly_booking", "user_id": user["id"], "slot": payload.slot_id, "month": payload.month},
    })
    await db.bookings.insert_one({
        "id": booking_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "user_mobile": user["mobile"],
        "slot_id": payload.slot_id,
        "slot_label": next(s["label"] for s in SLOTS if s["id"] == payload.slot_id),
        "month": payload.month,
        "status": "pending_payment",
        "order_id": order["id"],
        "amount": MONTHLY_FEE_PAISE,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "booking_id": booking_id,
        "order_id": order["id"],
        "amount": MONTHLY_FEE_PAISE,
        "currency": "INR",
        "key_id": RZP_KEY_ID,
    }
 
@api_router.post("/bookings/verify")
async def booking_verify(payload: BookingVerify, user=Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": payload.booking_id, "user_id": user["id"]})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if not verify_rzp_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")
    # Final capacity check
    count = await db.bookings.count_documents({"slot_id": booking["slot_id"], "month": booking["month"], "status": "confirmed"})
    if count >= MAX_SLOT_CAPACITY:
        raise HTTPException(400, "Slot just filled up. Refund will be processed.")
    await db.bookings.update_one(
        {"id": payload.booking_id},
        {"$set": {
            "status": "confirmed",
            "payment_id": payload.razorpay_payment_id,
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "monthly_booking",
        "booking_id": payload.booking_id,
        "order_id": payload.razorpay_order_id,
        "payment_id": payload.razorpay_payment_id,
        "amount": booking["amount"],
        "status": "captured",
        "month": booking["month"],
        "slot_id": booking["slot_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "booking_id": payload.booking_id}
 
@api_router.get("/bookings/me")
async def my_bookings(user=Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items
 
# ----------- Holidays -----------
@api_router.get("/holidays")
async def list_holidays(user=Depends(get_current_user)):
    items = await db.holidays.find({}, {"_id": 0}).sort("date", 1).to_list(500)
    return items
 
# ----------- Admin -----------
@api_router.get("/admin/users")
async def admin_users(_=Depends(require_admin)):
    items = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(2000)
    return items
 
@api_router.get("/admin/bookings")
async def admin_bookings(_=Depends(require_admin)):
    items = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items
 
@api_router.get("/admin/payments")
async def admin_payments(_=Depends(require_admin)):
    items = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return items
 
@api_router.post("/admin/holiday")
async def add_holiday(payload: HolidayCreate, _=Depends(require_admin)):
    try:
        datetime.strptime(payload.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Invalid date (YYYY-MM-DD)")
    holiday = {
        "id": str(uuid.uuid4()),
        "date": payload.date,
        "reason": payload.reason or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.holidays.insert_one(dict(holiday))
    return holiday
 
@api_router.delete("/admin/holiday/{hid}")
async def remove_holiday(hid: str, _=Depends(require_admin)):
    res = await db.holidays.delete_one({"id": hid})
    return {"deleted": res.deleted_count}
 
@api_router.post("/admin/refund-deposit/{user_id}")
async def refund_deposit(user_id: str, _=Depends(require_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("role") == "admin":
        raise HTTPException(400, "Cannot refund admin account")
    if not user.get("deposit_paid") or user.get("deposit_refunded"):
        raise HTTPException(400, "Deposit not eligible for refund")
    payment_id = user.get("deposit_payment_id")
    if not payment_id:
        raise HTTPException(400, "No deposit payment on record")
    if not rzp_client:
        raise HTTPException(500, "Payment gateway not configured")
    try:
        refund = rzp_client.payment.refund(payment_id, {"amount": SECURITY_DEPOSIT_PAISE, "speed": "normal"})
    except Exception as e:
        raise HTTPException(400, f"Refund failed: {e}")
    await db.users.update_one({"id": user_id}, {"$set": {
        "deposit_refunded": True,
        "deposit_refund_id": refund.get("id"),
        "deposit_refunded_at": datetime.now(timezone.utc).isoformat(),
    }})
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "deposit_refund",
        "payment_id": payment_id,
        "refund_id": refund.get("id"),
        "amount": -SECURITY_DEPOSIT_PAISE,
        "status": "refunded",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "refund_id": refund.get("id")}
 
@api_router.post("/admin/reset-password/{user_id}")
async def admin_reset_password(user_id: str, payload: ResetPwd, _=Depends(require_admin)):
    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"password": hash_password(payload.new_password)}})
    return {"success": True}
 
# ----------- Bootstrap admin -----------
@app.on_event("startup")
async def seed_admin():
    admin_mobile = os.environ.get('ADMIN_MOBILE', '9999999999')
    admin_pw = os.environ.get('ADMIN_PASSWORD', 'Admin@1234')
    existing = await db.users.find_one({"mobile": admin_mobile})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Court Admin",
            "mobile": admin_mobile,
            "email": "",
            "flat_number": "ADMIN",
            "password": hash_password(admin_pw),
            "role": "admin",
            "status": "active",
            "deposit_paid": False,
            "deposit_refunded": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logging.info(f"Seeded admin user with mobile={admin_mobile}")
 
app.include_router(api_router)
 
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
 
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
 
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
