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
# Security deposit amounts, per membership type. Each is independently configurable via env
# so amounts can be changed later without a code change/redeploy of logic.
DEPOSIT_EMPLOYEE_PAISE = int(os.environ.get('DEPOSIT_EMPLOYEE_PAISE', '100000'))  # ₹1000, lifetime
DEPOSIT_FAMILY_PAISE = int(os.environ.get('DEPOSIT_FAMILY_PAISE', '50000'))       # ₹500, lifetime
DEPOSIT_VISITOR_PAISE = int(os.environ.get('DEPOSIT_VISITOR_PAISE', '100000'))    # ₹1000, per year

USER_TYPES = {
    "employee": {"label": "Employee", "amount_paise": DEPOSIT_EMPLOYEE_PAISE, "cycle": "lifetime"},
    "family": {"label": "Family member", "amount_paise": DEPOSIT_FAMILY_PAISE, "cycle": "lifetime"},
    "visitor": {"label": "Visitor", "amount_paise": DEPOSIT_VISITOR_PAISE, "cycle": "yearly"},
}

def deposit_amount_for(user_type: str) -> int:
    return USER_TYPES.get(user_type, USER_TYPES["employee"])["amount_paise"]

def is_deposit_active(user: dict) -> bool:
    """Whether the user's deposit currently counts as paid. Lifetime deposits (employee/family)
    stay valid forever once paid; visitor deposits expire a year after payment and need renewal."""
    if not user.get("deposit_paid"):
        return False
    valid_until = user.get("deposit_valid_until")
    if valid_until:
        try:
            return datetime.fromisoformat(valid_until) > datetime.now(timezone.utc)
        except ValueError:
            return True
    return True

MONTHLY_FEE_PAISE = int(os.environ.get('MONTHLY_FEE_PAISE', '50000'))  # ₹500/month default
MAX_SLOT_CAPACITY = 8

SLOTS = [
    {"id": "0500", "label": "5:00 - 6:00 AM"},
    {"id": "0600", "label": "6:00 - 7:00 AM"},
    {"id": "0700", "label": "7:00 - 8:00 AM"},
    {"id": "0800", "label": "8:00 - 9:00 AM"},
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

async def require_gatekeeper(user=Depends(get_current_user)):
    if user.get("role") not in ("gatekeeper", "admin"):
        raise HTTPException(403, "Gatekeeper only")
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
    user_type: str

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

class GatekeeperCreate(BaseModel):
    name: str
    mobile: str
    password: str

class GatekeeperCheckin(BaseModel):
    qr_token: str

# ----------- Public -----------
@api_router.get("/")
async def root():
    return {"message": "Badminton Court API", "slots": SLOTS}

@api_router.get("/config")
async def get_config():
    return {
        "deposits": {
            key: {"amount": cfg["amount_paise"] // 100, "cycle": cfg["cycle"], "label": cfg["label"]}
            for key, cfg in USER_TYPES.items()
        },
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
    if payload.user_type not in USER_TYPES:
        raise HTTPException(400, "Invalid membership type")
    existing = await db.users.find_one({"mobile": mobile, "status": "active"})
    if existing:
        raise HTTPException(400, "Mobile already registered")
    if not rzp_client:
        raise HTTPException(500, "Payment gateway not configured. Please contact admin.")

    deposit_amount = deposit_amount_for(payload.user_type)
    pending_id = str(uuid.uuid4())
    order = rzp_client.order.create({
        "amount": deposit_amount,
        "currency": "INR",
        "receipt": f"dep_{pending_id[:20]}",
        "notes": {"type": "security_deposit", "mobile": mobile, "user_type": payload.user_type},
    })
    user_doc = {
        "id": pending_id,
        "name": payload.name.strip(),
        "mobile": mobile,
        "email": payload.email or "",
        "flat_number": payload.flat_number or "",
        "password": hash_password(payload.password),
        "role": "user",
        "user_type": payload.user_type,
        "deposit_amount": deposit_amount,
        "status": "pending_payment",
        "deposit_paid": False,
        "deposit_refunded": False,
        "deposit_valid_until": None,
        "deposit_order_id": order["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return {
        "pending_user_id": pending_id,
        "order_id": order["id"],
        "amount": deposit_amount,
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
    deposit_amount = user.get("deposit_amount", deposit_amount_for(user.get("user_type", "employee")))
    valid_until = None
    if USER_TYPES.get(user.get("user_type"), {}).get("cycle") == "yearly":
        valid_until = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "status": "active",
            "deposit_paid": True,
            "deposit_payment_id": payload.razorpay_payment_id,
            "deposit_paid_at": datetime.now(timezone.utc).isoformat(),
            "deposit_valid_until": valid_until,
        }}
    )
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "security_deposit",
        "order_id": payload.razorpay_order_id,
        "payment_id": payload.razorpay_payment_id,
        "amount": deposit_amount,
        "status": "captured",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "mobile": user["mobile"], "role": user["role"], "user_type": user.get("user_type"), "deposit_paid": True, "deposit_valid_until": valid_until}}

@api_router.post("/deposit/init")
async def deposit_init(user=Depends(get_current_user)):
    if is_deposit_active(user):
        raise HTTPException(400, "Deposit already paid")
    if not rzp_client:
        raise HTTPException(500, "Payment gateway not configured.")
    deposit_amount = user.get("deposit_amount") or deposit_amount_for(user.get("user_type", "employee"))
    order = rzp_client.order.create({
        "amount": deposit_amount,
        "currency": "INR",
        "receipt": f"dep_{user['id'][:20]}",
        "notes": {"type": "security_deposit", "user_id": user["id"]},
    })
    await db.users.update_one({"id": user["id"]}, {"$set": {"deposit_order_id": order["id"], "deposit_amount": deposit_amount}})
    return {
        "order_id": order["id"],
        "amount": deposit_amount,
        "currency": "INR",
        "key_id": RZP_KEY_ID,
        "name": user["name"],
        "mobile": user["mobile"],
    }

@api_router.post("/deposit/verify")
async def deposit_verify(payload: RegisterVerify, user=Depends(get_current_user)):
    if is_deposit_active(user):
        raise HTTPException(400, "Deposit already paid")
    if not verify_rzp_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")
    deposit_amount = user.get("deposit_amount") or deposit_amount_for(user.get("user_type", "employee"))
    valid_until = None
    if USER_TYPES.get(user.get("user_type"), {}).get("cycle") == "yearly":
        valid_until = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "deposit_paid": True,
            "deposit_payment_id": payload.razorpay_payment_id,
            "deposit_paid_at": datetime.now(timezone.utc).isoformat(),
            "deposit_valid_until": valid_until,
        }}
    )
    await db.payments.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "security_deposit",
        "order_id": payload.razorpay_order_id,
        "payment_id": payload.razorpay_payment_id,
        "amount": deposit_amount,
        "status": "captured",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "mobile": user["mobile"], "role": user["role"], "user_type": user.get("user_type"), "deposit_paid": True, "deposit_valid_until": valid_until}}

@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    mobile = payload.mobile.strip()
    user = await db.users.find_one({"mobile": mobile, "status": "active"})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(401, "Invalid mobile or password")
    token = make_token(user["id"], user["role"])
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "mobile": user["mobile"], "role": user["role"], "email": user.get("email", ""), "flat_number": user.get("flat_number", ""), "user_type": user.get("user_type"), "deposit_paid": is_deposit_active(user), "deposit_valid_until": user.get("deposit_valid_until")}}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"id": user["id"], "name": user["name"], "mobile": user["mobile"], "role": user["role"], "email": user.get("email", ""), "flat_number": user.get("flat_number", ""), "user_type": user.get("user_type"), "deposit_paid": is_deposit_active(user), "deposit_valid_until": user.get("deposit_valid_until")}

@api_router.get("/me/qr-token")
async def get_my_qr_token(user=Depends(get_current_user)):
    """Each member has a stable, opaque QR token (separate from their login session) that the
    gatekeeper scans at the gate to look them up. Generated lazily on first request."""
    token = user.get("qr_token")
    if not token:
        token = uuid.uuid4().hex
        await db.users.update_one({"id": user["id"]}, {"$set": {"qr_token": token}})
    return {"qr_token": token}

@api_router.post("/me/qr-token/regenerate")
async def regenerate_my_qr_token(user=Depends(get_current_user)):
    """Invalidates the old QR code (e.g. if it was lost or shared) and issues a new one."""
    token = uuid.uuid4().hex
    await db.users.update_one({"id": user["id"]}, {"$set": {"qr_token": token}})
    return {"qr_token": token}

@api_router.get("/me/attendance")
async def my_attendance(month: Optional[str] = None, user=Depends(get_current_user)):
    """GitHub-style attendance: which days this month the user was actually scanned in at the
    gate (from the checkins log, not just their booking), plus current/longest day streaks."""
    if not month:
        now = _ist_now()
        month = f"{now.year}-{now.month:02d}"
    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(400, "Invalid month (YYYY-MM)")

    checkins = await db.checkins.find({"user_id": user["id"]}, {"_id": 0, "created_at": 1}).to_list(5000)
    all_dates = {_to_ist_date(c["created_at"]) for c in checkins}
    month_days = sorted(d.day for d in all_dates if d.strftime("%Y-%m") == month)

    today = _ist_now().date()
    check_from = today if today in all_dates else today - timedelta(days=1)
    current_streak = 0
    d = check_from
    while d in all_dates:
        current_streak += 1
        d -= timedelta(days=1)

    longest_streak = 0
    if all_dates:
        ordered = sorted(all_dates)
        run = 1
        longest_streak = 1
        for i in range(1, len(ordered)):
            if (ordered[i] - ordered[i - 1]).days == 1:
                run += 1
                longest_streak = max(longest_streak, run)
            else:
                run = 1

    return {
        "month": month,
        "days_attended": month_days,
        "total_days_this_month": len(month_days),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
    }

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
    for item in items:
        item["deposit_active"] = is_deposit_active(item)
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

@api_router.post("/admin/reset-password/{user_id}")
async def admin_reset_password(user_id: str, payload: ResetPwd, _=Depends(require_admin)):
    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"password": hash_password(payload.new_password)}})
    return {"success": True}

@api_router.post("/admin/create-gatekeeper")
async def create_gatekeeper(payload: GatekeeperCreate, _=Depends(require_admin)):
    mobile = payload.mobile.strip()
    if len(mobile) != 10 or not mobile.isdigit():
        raise HTTPException(400, "Mobile must be 10 digits")
    if len(payload.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    existing = await db.users.find_one({"mobile": mobile, "status": "active"})
    if existing:
        raise HTTPException(400, "Mobile already registered")
    user_doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "mobile": mobile,
        "email": "",
        "flat_number": "",
        "password": hash_password(payload.password),
        "role": "gatekeeper",
        "user_type": "gatekeeper",
        "status": "active",
        # Gatekeepers don't pay a deposit — mark permanently "paid" so no part of the app
        # (nav links, route guards) ever prompts them for one.
        "deposit_amount": 0,
        "deposit_paid": True,
        "deposit_refunded": False,
        "deposit_valid_until": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return {"id": user_doc["id"], "name": user_doc["name"], "mobile": user_doc["mobile"]}

# ----------- Gatekeeper -----------
@api_router.get("/gatekeeper/roster")
async def gatekeeper_roster(month: str, slot_id: Optional[str] = None, user=Depends(require_gatekeeper)):
    try:
        datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise HTTPException(400, "Invalid month (YYYY-MM)")
    query = {"month": month, "status": "confirmed"}
    if slot_id:
        query["slot_id"] = slot_id
    bookings = await db.bookings.find(query, {"_id": 0}).sort("slot_id", 1).to_list(2000)
    user_ids = list({b["user_id"] for b in bookings})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "flat_number": 1, "user_type": 1}).to_list(2000)
    by_id = {u["id"]: u for u in users}
    for b in bookings:
        extra = by_id.get(b["user_id"], {})
        b["flat_number"] = extra.get("flat_number", "")
        b["user_type"] = extra.get("user_type", "")
    return {"month": month, "slots": SLOTS, "bookings": bookings}

def _slot_label(slot_id: str) -> str:
    return next((s["label"] for s in SLOTS if s["id"] == slot_id), slot_id)

def _ist_now() -> datetime:
    # Court is in India; wall-clock check-in time is IST regardless of server timezone.
    return datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)

def _to_ist_date(iso_str: str):
    dt = datetime.fromisoformat(iso_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (dt.astimezone(timezone.utc) + timedelta(hours=5, minutes=30)).date()

@api_router.post("/gatekeeper/checkin")
async def gatekeeper_checkin(payload: GatekeeperCheckin, gk=Depends(require_gatekeeper)):
    target = await db.users.find_one({"qr_token": payload.qr_token}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(404, "QR code not recognized")
    if target.get("status") != "active":
        raise HTTPException(400, "This account is not active")

    now = _ist_now()
    month = f"{now.year}-{now.month:02d}"
    booking = await db.bookings.find_one({"user_id": target["id"], "month": month, "status": "confirmed"}, {"_id": 0})

    on_time = False
    slot_label = None
    if booking:
        slot_label = _slot_label(booking["slot_id"])
        try:
            start_hour = int(booking["slot_id"][:2])
            on_time = start_hour <= now.hour < start_hour + 1
        except (ValueError, IndexError):
            on_time = False

    result = {
        "name": target["name"],
        "mobile": target["mobile"],
        "flat_number": target.get("flat_number", ""),
        "user_type": target.get("user_type", ""),
        "has_booking": booking is not None,
        "slot_label": slot_label,
        "month": month,
        "on_time": on_time,
    }
    await db.checkins.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": target["id"],
        "user_name": target["name"],
        "scanned_by": gk["id"],
        "has_booking": booking is not None,
        "slot_label": slot_label,
        "on_time": on_time,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return result

@api_router.get("/gatekeeper/checkins")
async def gatekeeper_checkins(user=Depends(require_gatekeeper)):
    items = await db.checkins.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items

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
            "user_type": "employee",
            "deposit_amount": 0,
            "deposit_paid": False,
            "deposit_refunded": False,
            "deposit_valid_until": None,
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
