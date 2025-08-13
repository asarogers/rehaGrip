from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import uvicorn
import json
import os
from typing import List, Dict
from dynamixel_sdk import *

app = FastAPI()
PORT = 3001

# ----- Hardware constants -----
PORT_NAME = '/dev/ttyUSB0'
BAUDRATE = 57600
DXL_ID = 1
PROTOCOL_VERSION = 2.0

ADDR_TORQUE_ENABLE = 64
ADDR_OPERATING_MODE = 11
ADDR_GOAL_POSITION = 116
ADDR_PRESENT_POSITION = 132
ADDR_PROFILE_ACCELERATION = 108
ADDR_PROFILE_VELOCITY = 112

# ----- Preset storage constants -----
PRESET_FILE = "/home/pi/motor_presets.json"
DEFAULT_PRESETS = [
    {"name": "Neutral", "pos": 0},
    {"name": "Open", "pos": 45},
    {"name": "Closed", "pos": -45}
]

# ----- Motor state class -----
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

# ----- Preset management functions -----
def load_presets_from_file():
    """Load presets from nonvolatile storage, or return defaults if file doesn't exist."""
    try:
        if os.path.exists(PRESET_FILE):
            with open(PRESET_FILE, 'r') as f:
                data = json.load(f)
                presets = data.get('presets', DEFAULT_PRESETS)
                print(f"✓ Loaded {len(presets)} presets from {PRESET_FILE}")
                return presets
        else:
            print(f"⚠ Preset file {PRESET_FILE} not found, using defaults")
            return DEFAULT_PRESETS.copy()
    except Exception as e:
        print(f"❌ Error loading presets: {e}, using defaults")
        return DEFAULT_PRESETS.copy()

def save_presets_to_file(presets):
    """Save presets to nonvolatile storage."""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(PRESET_FILE), exist_ok=True)
        
        # Validate and clamp preset values
        validated_presets = []
        for preset in presets:
            validated_preset = {
                "name": str(preset.get("name", "Unnamed")).strip(),
                "pos": max(-60, min(60, float(preset.get("pos", 0))))  # Clamp to valid range
            }
            validated_presets.append(validated_preset)
        
        # Save to file
        data = {
            "presets": validated_presets,
            "last_updated": time.time(),
            "version": "1.0"
        }
        
        with open(PRESET_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"✓ Saved {len(validated_presets)} presets to {PRESET_FILE}")
        return True
    except Exception as e:
        print(f"❌ Error saving presets: {e}")
        return False

# Load presets on startup
current_presets = load_presets_from_file()

# ----- Connect to hardware -----
portHandler = PortHandler(PORT_NAME)
packetHandler = PacketHandler(PROTOCOL_VERSION)

if not portHandler.openPort():
    print(" Failed to open port")
    exit()

if not portHandler.setBaudRate(BAUDRATE):
    print(" Failed to set baudrate")
    exit()

def move_to_tick_if_needed(target_tick, velocity=50, threshold=10):
    """Move the motor to target_tick if not already close, and wait for it."""
    current_tick, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)
    if abs(current_tick - target_tick) > threshold:
        print(f"Moving to default tick: {target_tick} (from {current_tick})")
        packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_VELOCITY, velocity)
        packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_GOAL_POSITION, target_tick)
        time.sleep(2)
        new_tick, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)
        print(f"Moved. Actual tick now {new_tick}")
        return new_tick
    else:
        print(f"Already at default tick: {current_tick}")
        return current_tick

# ----- Motor startup and center setup -----
packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)
packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_OPERATING_MODE, 5)
packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_ACCELERATION, 50)
packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_VELOCITY, 100)
packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 1)
print(" Torque Enabled in Current-based Position Control Mode")

RIGHT_CENTER_TICK = 3046
LEFT_CENTER_TICK  = 1000

print("Setting up default startup position (right hand, centered)...")
center_tick = move_to_tick_if_needed(RIGHT_CENTER_TICK, velocity=50)
state.hand = "right"
print(f"Startup: hand={state.hand}, center_tick={center_tick}")
print(f"Loaded presets: {current_presets}")

# ----- CORS -----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

class PresetData(BaseModel):
    name: str
    pos: float

class PresetsRequest(BaseModel):
    presets: List[PresetData]

# ----- Helper functions -----
def get_current_tick():
    tick, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)
    return tick

# ----- API Endpoints -----
@app.post("/api/motor/center")
async def set_center():
    global center_tick
    center_tick = get_current_tick()
    print(f"Center reset to current position: {center_tick}")
    return {"ok": True, "center_tick": center_tick}

@app.post("/api/motor/status")
async def motor_status():
    current_tick = get_current_tick()
    current_degrees = ((current_tick - center_tick) / 4095) * 360
    state.position = current_degrees
    return {
        "position": state.position,
        "position_tick": current_tick,
        "center_tick": center_tick,
        "load": state.load,
        "moving": state.moving,
        "locked": state.locked,
        "torque": state.torque,
        "emergency": state.emergency
    }

@app.get("/api/motor/presets")
async def get_presets():
    """Get current presets from memory."""
    return {
        "ok": True,
        "presets": current_presets,
        "preset_file": PRESET_FILE,
        "count": len(current_presets)
    }

@app.post("/api/motor/presets")
async def save_presets(req: PresetsRequest):
    """Save presets to nonvolatile storage and update memory."""
    global current_presets
    
    try:
        # Convert Pydantic models to dicts
        new_presets = [{"name": p.name, "pos": p.pos} for p in req.presets]
        
        # Save to file
        success = save_presets_to_file(new_presets)
        
        if success:
            # Update memory only if file save succeeded
            current_presets = new_presets
            print(f"✓ Presets updated in memory and saved to disk")
            return {
                "ok": True, 
                "message": "Presets saved successfully",
                "presets": current_presets,
                "saved_to_file": True
            }
        else:
            return {
                "ok": False, 
                "error": "Failed to save presets to file",
                "saved_to_file": False
            }
    except Exception as e:
        print(f"❌ Error in save_presets endpoint: {e}")
        return {
            "ok": False, 
            "error": f"Server error: {str(e)}",
            "saved_to_file": False
        }

@app.post("/api/motor/presets/reload")
async def reload_presets():
    """Reload presets from nonvolatile storage."""
    global current_presets
    
    try:
        current_presets = load_presets_from_file()
        return {
            "ok": True,
            "message": "Presets reloaded from file",
            "presets": current_presets,
            "count": len(current_presets)
        }
    except Exception as e:
        print(f"❌ Error reloading presets: {e}")
        return {
            "ok": False,
            "error": f"Failed to reload presets: {str(e)}"
        }

@app.post("/api/motor/move")
async def motor_move(req: MoveRequest):
    global center_tick
    if state.emergency or state.locked or not state.torque:
        return {"error": "Cannot move: locked/torque/emergency"}, 400
    if center_tick is None:
        center_tick = get_current_tick()
    degrees = float(req.position)
    desired_tick = int(center_tick + (degrees * (4095 / 360)))
    if desired_tick < 0:
        desired_tick = 0
        actual_degrees = -(center_tick / 4095) * 360
        print(f"Clamped to minimum position (0) - actual degrees: {actual_degrees:.1f}°")
    elif desired_tick > 4095:
        desired_tick = 4095
        actual_degrees = ((4095 - center_tick) / 4095) * 360
        print(f"Clamped to maximum position (4095) - actual degrees: {actual_degrees:.1f}°")
    else:
        actual_degrees = degrees
    print(f"Move {degrees}° -> {actual_degrees}° (center={center_tick}) -> tick {desired_tick}")
    if req.velocity is not None:
        packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_VELOCITY, int(req.velocity))
    packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_GOAL_POSITION, desired_tick)
    time.sleep(0.2)
    pos, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)
    actual_position_degrees = ((pos - center_tick) / 4095) * 360
    state.position = actual_position_degrees
    state.moving = False
    return {
        "ok": True, 
        "position": actual_position_degrees,
        "position_tick": pos,
        "target_tick": desired_tick,
        "requested_degrees": degrees,
        "actual_degrees": actual_degrees
    }

@app.post("/api/motor/get_range")
async def get_movement_range():
    if center_tick is None:
        return {"error": "Center not set"}
    degrees_to_min = -(center_tick / 4095) * 360
    degrees_to_max = ((4095 - center_tick) / 4095) * 360
    return {
        "center_tick": center_tick,
        "min_degrees": degrees_to_min,
        "max_degrees": degrees_to_max,
        "total_range": degrees_to_max - degrees_to_min
    }

@app.post("/api/motor/recenter")
async def recenter_motor():
    global center_tick
    print("Moving to middle of range and setting as new center...")
    middle_tick = 2048
    packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_GOAL_POSITION, middle_tick)
    time.sleep(2)
    actual_pos, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)
    center_tick = actual_pos
    print(f"Recentered at tick: {center_tick}")
    return {
        "ok": True,
        "center_tick": center_tick,
        "available_range_degrees": 360 
    }

def wait_until_arrived(target_tick, pos_threshold=8, stable_ms=120, timeout_s=3.0):
    start = time.time()
    stable_start = None
    while time.time() - start < timeout_s:
        pos, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)
        if abs(pos - target_tick) <= pos_threshold:
            if stable_start is None:
                stable_start = time.time()
            elif (time.time() - stable_start) * 1000 >= stable_ms:
                return pos
        else:
            stable_start = None
        time.sleep(0.01)
    return pos  # best effort


@app.post("/api/motor/hand")
async def set_hand(req: HandRequest):
    global center_tick
    new_hand = req.hand
    if new_hand not in ("left", "right"):
        return {"error": "hand must be 'left' or 'right'"}, 400

    print(f"Switching hand to {new_hand}")

    if new_hand == "right":
        center_tick = RIGHT_CENTER_TICK
    else:
        center_tick = LEFT_CENTER_TICK

    packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_GOAL_POSITION, center_tick)
    wait_until_arrived(center_tick)  

    state.hand = new_hand
    return {"ok": True, "hand": new_hand, "center_tick": center_tick}

@app.post("/api/motor/lock")
async def set_lock(req: LockRequest):
    print(f"Setting lock: {req.locked}")
    state.locked = req.locked
    return {"ok": True, "locked": state.locked}

@app.post("/api/motor/torque")
async def set_torque(req: TorqueRequest):
    print(f"Setting torque: {req.torque}")
    if req.torque:
        packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 1)
        state.torque = True
    else:
        packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)
        state.torque = False
    return {"ok": True, "torque": state.torque}

@app.post("/api/motor/emergency")
async def emergency_stop(req: EmergencyRequest):
    state.emergency = req.stop
    print(f"Emergency STOP set to {state.emergency}")
    if state.emergency:
        packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)
        state.torque = False
    else:
        packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 1)
        state.torque = True
    return {"ok": True, "emergency": state.emergency}

if __name__ == "__main__":
    print(f"Starting server on port {PORT}")
    print(f"Motor center position: {center_tick}")
    print(f"Preset storage file: {PRESET_FILE}")
    print(f"Loaded {len(current_presets)} presets from storage")
    uvicorn.run(app, host="0.0.0.0", port=PORT)