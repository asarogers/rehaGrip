"""
Motor Control API for RehaGrip Device.

This module implements a FastAPI-based backend for controlling a Dynamixel servo motor
used in the RehaGrip rehabilitation device. It exposes REST API endpoints for motor control,
state monitoring, preset management, and emergency handling, enabling integration with
frontends or other applications.

Key Features:
------------
- **Motor Control:**
  - Move motor to a specified angular position (degrees) with adjustable velocity.
  - Recenter motor to a default midpoint or custom user-defined center.
  - Switch motor orientation between left-hand and right-hand configurations.
  - Enable or disable motor torque for free rotation or fixed position holding.
  - Apply software locking to prevent unintended movement.

- **State Management:**
  - Track motor position (ticks & degrees), load, motion status, and lock/torque states.
  - Retrieve movement range limits based on current center position.
  - Maintain state persistence for presets and motor configuration.

- **Preset Management:**
  - Load presets from JSON storage or defaults.
  - Save updated presets to persistent storage with value clamping and validation.
  - Reload presets dynamically without restarting the server.

- **Emergency Handling:**
  - Emergency stop to instantly disable torque and halt motion.
  - Resume normal operation by clearing the emergency state.

- **API Endpoints:**
  - `/api/motor/move` — Move to a specific position with optional velocity override.
  - `/api/motor/status` — Get live motor state data.
  - `/api/motor/center` — Set the current position as the center.
  - `/api/motor/presets` — Get or save position presets.
  - `/api/motor/recenter` — Move motor to mid-range and redefine center.
  - `/api/motor/hand` — Switch motor orientation for left or right hand.
  - `/api/motor/lock` — Lock or unlock motor control.
  - `/api/motor/torque` — Enable or disable torque.
  - `/api/motor/emergency` — Engage or disengage emergency stop.

Hardware & Protocols:
---------------------
- Motor: Dynamixel servo motor connected via USB serial interface.
- Communication: Dynamixel SDK with current-based position control mode.
- Preset Storage: JSON file stored in `$XDG_STATE_HOME/rehagrip/` or `~/.local/state/rehagrip/`.
- ROS not required — this module runs standalone with FastAPI.

Authors:
--------
    Asa Rogers
    Date: 2025-08-13
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import uvicorn
import json
import os
from typing import List, Dict
from dynamixel_sdk import *
from pathlib import Path

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

DEFAULT_PRESETS = [
    {"name": "Neutral", "pos": 0},
    {"name": "Open", "pos": 45},
    {"name": "Closed", "pos": -45}
]


def resolve_preset_path() -> Path:
    env = os.getenv("PRESET_FILE")
    if env:
        p = Path(env).expanduser()
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    
    xdg_state = os.getenv("XDG_STATE_HOME")
    if not xdg_state:
        xdg_state = str(Path.home() / ".local" / "state")
    app_dir = Path(xdg_state) / "rehagrip"
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir / "motor_presets.json"

center_offset = 0
PRESET_FILE = resolve_preset_path()
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
    try:
        p = Path(PRESET_FILE)
        if p.exists():
            with p.open('r') as f:
                data = json.load(f)
                presets = data.get('presets', DEFAULT_PRESETS)
                print(f"✓ Loaded {len(presets)} presets from {p}")
                return presets
        else:
            print(f"⚠ Preset file {p} not found, using defaults")
            return DEFAULT_PRESETS.copy()
    except Exception as e:
        print(f"Error loading presets: {e}, using defaults")
        return DEFAULT_PRESETS.copy()

def save_presets_to_file(presets):
    try:
        p = Path(PRESET_FILE)
        p.parent.mkdir(parents=True, exist_ok=True)

        validated_presets = []
        for preset in presets:
            validated_presets.append({
                "name": str(preset.get("name", "Unnamed")).strip(),
                "pos": max(-60, min(60, float(preset.get("pos", 0))))
            })

        data = {"presets": validated_presets, "last_updated": time.time(), "version": "1.0"}

        with p.open('w') as f:
            json.dump(data, f, indent=2)

        print(f"✓ Saved {len(validated_presets)} presets to {p}")
        return True
    except Exception as e:
        print(f"Error saving presets: {e}")
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
        "preset_file": str(PRESET_FILE),
        "count": len(current_presets)
    }

@app.post("/api/motor/presets")
async def save_presets(req: PresetsRequest):
    """Save presets to nonvolatile storage and update memory."""
    global current_presets
    
    try:
        new_presets = [{"name": p.name, "pos": p.pos} for p in req.presets]
        
        for preset in new_presets:
            if not isinstance(preset.get("name"), str) or not preset["name"].strip():
                raise HTTPException(status_code=422, detail="Each preset must have a non-empty name")
            if not isinstance(preset.get("pos"), (int, float)):
                raise HTTPException(status_code=422, detail="Each preset must have a numeric position")
        
        # save to file
        success = save_presets_to_file(new_presets)
        
        if success:
            # update memory only if file save succeeded
            current_presets = load_presets_from_file()  # Reload to get clamped values
            print(f"✓ Presets updated in memory and saved to disk")
            return {
                "ok": True, 
                "message": "Presets saved successfully",
                "presets": current_presets,
                "saved_to_file": True
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save presets to file")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in save_presets endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

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
        print(f"Error reloading presets: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reload presets: {str(e)}")

@app.post("/api/motor/move")
async def motor_move(req: MoveRequest):
    global center_tick, center_offset
    if state.emergency or state.locked or not state.torque:
        raise HTTPException(status_code=400, detail="Cannot move: locked/torque/emergency")
    if center_tick is None:
        center_tick = get_current_tick()

    degrees = float(req.position)
    if state.hand == "left":
        degrees = -degrees

    desired_tick = int(center_tick + (degrees * (4095 / 360)))
    # print(f"\n\n center_tick = {center_tick} center_offset = {center_offset} degrees = {degrees} desired_tick={desired_tick} \n\n")

    # Clamp to valid range
    if desired_tick < 0:
        desired_tick = 0
    elif desired_tick > 4095:
        desired_tick = 4095

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
        "requested_degrees": degrees
    }


@app.post("/api/motor/get_range")
async def get_movement_range():
    if center_tick is None:
        raise HTTPException(status_code=400, detail="Center not set")
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
    return pos


@app.post("/api/motor/hand")
async def set_hand(req: HandRequest):
    global center_tick
    new_hand = req.hand
    if new_hand not in ("left", "right"):
        raise HTTPException(status_code=400, detail="hand must be 'left' or 'right'")

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
    global center_offset
    print(f"Setting torque: {req.torque}")

    if req.torque:
        # Torque ON — just enable, keep center_offset from torque-off
        packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 1)
        state.torque = True
    else:
        # Torque OFF — snapshot offset from fixed center immediately
        current_tick = get_current_tick()
        center_offset = current_tick - center_tick
        print(f"Torque disabled — current position is {current_tick}, "
              f"offset from center = {center_offset} ticks")
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