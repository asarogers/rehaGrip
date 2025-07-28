from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import asyncio
import threading
import time
import uvicorn
import time
from dynamixel_sdk import *
app = FastAPI()
PORT = 3001

# ==================== Configuration ====================
PORT_NAME = '/dev/ttyUSB0'
BAUDRATE = 57600
DXL_ID = 1
PROTOCOL_VERSION = 2.0

MIN_POS = 0
MAX_POS = 150

# Control table addresses (RAM area)
ADDR_TORQUE_ENABLE = 64
ADDR_OPERATING_MODE = 11
ADDR_GOAL_POSITION = 116
ADDR_PRESENT_POSITION = 132
ADDR_PROFILE_ACCELERATION = 108
ADDR_PROFILE_VELOCITY = 112
ADDR_PRESENT_CURRENT = 126  # 2 bytes

# XM430-W210-R constants
CURRENT_CONVERSION = 2.69   # 1 raw unit = 2.69 mA
TORQUE_CONSTANT = 1.30      # Nm per Amp (from datasheet)

# ==================== Setup ====================
portHandler = PortHandler(PORT_NAME)
packetHandler = PacketHandler(PROTOCOL_VERSION)


if not portHandler.openPort():
    print(" Failed to open port")
    exit()

if not portHandler.setBaudRate(BAUDRATE):
    print(" Failed to set baudrate")
    exit()

packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)


packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_OPERATING_MODE, 5)

# Enable torque
packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 1)
print(" Torque Enabled in Current-based Position Control Mode")


packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_ACCELERATION, 50)
packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_VELOCITY, 100)


# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust in prod!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- In-memory motor state -----
class State:
    def __init__(self):
        self.position = 0.0
        self.target = 0.0
        self.velocity = 50.0
        self.load = 0.0
        self.moving = False
        self.locked = False
        self.torque = True
        self.emergency = False
        self.hand = "right"

state = State()

# ----- Simulation loop (100ms) -----
def sim_loop():
    while True:
        if state.moving and not state.emergency:
            diff = state.target - state.position
            step = (diff/abs(diff) if diff != 0 else 0) * min(abs(diff), state.velocity / 10)
            state.position += step
            if abs(state.target - state.position) < 0.1:
                state.position = state.target
                state.moving = False
        # Random load sim
        state.load = random.uniform(10, 30) if state.moving else random.uniform(0.5, 5.5)
        time.sleep(0.1)  # Use time.sleep instead of asyncio.sleep in thread

threading.Thread(target=sim_loop, daemon=True).start()

# ----- API Models -----
class MoveRequest(BaseModel):
    position: float
    velocity: float = None
    hand: str = None

class LockRequest(BaseModel):
    locked: bool
    hand: str = None

class TorqueRequest(BaseModel):
    torque: bool
    hand: str = None

class EmergencyRequest(BaseModel):
    stop: bool
    hand: str = None

class HandRequest(BaseModel):
    hand: str

# ----- Endpoints -----
@app.post("/api/motor/status")
async def motor_status():
    return {
        "position": state.position,
        "load": state.load,
        "moving": state.moving,
        "locked": state.locked,
        "torque": state.torque,
        "emergency": state.emergency
    }

@app.post("/api/motor/move")
async def motor_move(req: MoveRequest):
    state.target = req.position
    if req.velocity is not None:
        state.velocity = req.velocity
    if req.hand is not None:
        state.hand = req.hand
    try:
        while True:
            for goal_pos in [MIN_POS, MAX_POS]:
                print(f"➡️ Moving to position: {goal_pos}")
                packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_GOAL_POSITION, goal_pos)

                time.sleep(2.0)  # Allow time for motion

                # Read current position
                pos, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)


                raw_current, _, _ = packetHandler.read2ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_CURRENT)
                if raw_current > 32767:  
                    raw_current -= 65536

                current_mA = raw_current * CURRENT_CONVERSION
                current_A = current_mA / 1000.0
                estimated_torque = current_A * TORQUE_CONSTANT

                print(f" Position: {pos}")
                print(f"⚡ Current Draw: {current_mA:.2f} mA")
                print(f" Estimated Torque: {estimated_torque:.3f} Nm\n")

    except KeyboardInterrupt:
        print("\n Interrupted by user. Disabling torque.")
        packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)
        portHandler.closePort()

   
    if not (state.emergency or state.locked or not state.torque):
        state.moving = True
        return {"ok": True}
    else:
        return {"error": "Cannot move: locked/torque/emergency"}, 400

@app.post("/api/motor/lock")
async def motor_lock(req: LockRequest):
    state.locked = bool(req.locked)
    if req.hand:
        state.hand = req.hand
    return {"ok": True}

@app.post("/api/motor/torque")
async def motor_torque(req: TorqueRequest):
    state.torque = bool(req.torque)
    if req.hand:
        state.hand = req.hand
    return {"ok": True}

@app.post("/api/motor/emergency")
async def motor_emergency(req: EmergencyRequest):
    state.emergency = bool(req.stop)
    if state.emergency:
        state.moving = False
    if req.hand:
        state.hand = req.hand
    return {"ok": True}

@app.post("/api/motor/hand")
async def motor_hand(req: HandRequest):
    if req.hand in ("left", "right"):
        state.hand = req.hand
        state.position = 0
        state.target = 0
        state.moving = False
        return {"ok": True}
    return {"error": "Invalid hand value"}, 400

# Add this to actually run the server
if __name__ == "__main__":
    print(f"Starting server on port {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)