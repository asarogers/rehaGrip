# RehaGrip – Motorized Hand Orthotic for Stroke Rehabilitation

##  TL;DR Quick Start
The easiest way to start everything is:

```bash
cd rehaGrip/
./start.sh
```

**Created by:** Asa Rogers  
**Date:** August 13, 2025  
**GitHub:** [github.com/asarogers/rehaGrip](https://github.com/asarogers/rehaGrip)  
**CAD Model:** [Onshape Link](https://cad.onshape.com/documents/70b0fc4719f91c87f4f5c56d/w/a0b7ff8eeb91e3fab313c6a8/e/38638431a9837a5ab3d1f154)  

---



## Overview

RehaGrip is a lightweight, motor-driven orthotic for hand rehabilitation, designed to help **stroke patients** re-train finger extension movements. A **Dynamixel XL430-W250-T servo** powers a swing-arm platform that gently opens the user's fingers with adjustable angles, velocity, and presets. The system features a **FastAPI backend** and **React-based GUI** for precise, repeatable, and safe motor control with comprehensive safety features including emergency stop functionality.

---

## Core Features

### Motor Control
- **Precision Positioning**: Move to target angles (-60° to +60°) with sub-degree accuracy
- **Dual Hand Support**: Switch between **left-hand** and **right-hand** orientations with automatic position mapping
- **Variable Velocity**: Adjustable movement speed (1-100%) for patient comfort
- **Center Calibration**: Set and recenter the neutral position for optimal patient fit
- **Torque Control**: Enable/disable motor torque for free rotation or position holding
- **Software Locking**: Prevent accidental movement with software-based motor lock

### Safety Features
- **Emergency Stop**: Instant torque cutoff with single-button activation
- **Load Monitoring**: Real-time force feedback (0-50N range)
- **Movement Limits**: Software-enforced range constraints to prevent overextension
- **Status Monitoring**: Continuous tracking of motor state, position, and safety status

### Preset Management
- **Editable Presets**: Save, load, and modify position presets via GUI
- **Persistent Storage**: JSON-based preset storage in `~/.local/state/rehagrip/`
- **Default Configurations**: Built-in presets for Neutral (0°), Open (45°), and Closed (-45°)
- **Real-time Updates**: Live preset editing and saving without system restart

### React GUI Interface
- **Live Status Display**: Real-time position, load, and movement state monitoring
- **Intuitive Controls**: Slider and numeric input for precise positioning
- **Incremental Movement**: ±1° and ±5° buttons for fine motor control adjustments
- **Visual Feedback**: Color-coded status indicators and progress bars
- **Time-stamped Logging**: Complete operation history with status messages
- **Hand Mode Toggle**: Visual hand orientation switching with confirmation

---

## Hardware Requirements

- **Motor**: Dynamixel XL430-W250-T servo motor (Protocol 2.0)
- **Interface**: USB-to-serial adapter (typically `/dev/ttyUSB0`)
- **Communication**: 57600 baud rate serial connection
- **Power**: 11.1V DC supply
- **Specifications**: 1.4 N·m stall torque (~14.3 kg·cm)

---

## Installation & Setup

### Backend Dependencies

```bash
pip install fastapi uvicorn dynamixel-sdk pydantic pathlib
```

### Hardware Configuration

Update these constants in `motor_control_api.py` for your setup:

```python
PORT_NAME = '/dev/ttyUSB0'   
BAUDRATE = 57600              
DXL_ID = 1                   
PROTOCOL_VERSION = 2.0      

RIGHT_CENTER_TICK = 3046     
LEFT_CENTER_TICK = 1000      
```

### Quick Start

1. **Connect Hardware**: Ensure Dynamixel motor is connected via USB
2. **Start Backend**:
   ```bash
   python motor_control_api.py
   ```
   Server starts on `http://localhost:3001`
3. **Launch Frontend**: Deploy the React component in your preferred environment

---

# RehaGrip API Documentation

**Base URL:** `http://localhost:3001/api/motor`

## Endpoint Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/move` | Move motor to specific position |
| POST | `/status` | Get current motor status |
| POST | `/hand` | Switch hand orientation (left/right) |
| POST | `/emergency` | Emergency stop/resume |
| POST | `/torque` | Enable/disable motor torque |
| POST | `/lock` | Software lock/unlock motor |
| POST | `/center` | Set current position as center |
| POST | `/recenter` | Move to mid-range and set new center |
| GET | `/presets` | Get all saved presets |
| POST | `/presets` | Save/update presets |
| POST | `/presets/reload` | Reload presets from storage |

---

## Complete Usage Examples

### 1. Move Motor to Position

**Purpose:** Move motor to a specific angle with optional velocity control.

**Terminal (curl):**
```bash
curl -X POST http://localhost:3001/api/motor/move \
  -H "Content-Type: application/json" \
  -d '{
    "position": 30.0,
    "velocity": 75,
    "hand": "right"
  }'
```

**Python:**
```python
import requests

url = "http://localhost:3001/api/motor/move"
data = {
    "position": 30.0,
    "velocity": 75,
    "hand": "right"
}

response = requests.post(url, json=data)
result = response.json()
print(f"Motor moved to {result['position']}° (tick: {result['position_tick']})")
```

---

### 2. Get Motor Status

**Purpose:** Retrieve comprehensive motor state information.

**Terminal (curl):**
```bash
curl -X POST http://localhost:3001/api/motor/status
```

**Python:**
```python
import requests

url = "http://localhost:3001/api/motor/status"
response = requests.post(url)
status = response.json()

print(f"Position: {status['position']}°")
print(f"Load: {status['load']}N")
print(f"Moving: {status['moving']}")
print(f"Emergency: {status['emergency']}")
print(f"Locked: {status['locked']}")
print(f"Torque Enabled: {status['torque']}")
```

---

### 3. Switch Hand Orientation

**Purpose:** Configure motor for left or right hand operation.

**Terminal (curl):**
```bash
# Switch to left hand
curl -X POST http://localhost:3001/api/motor/hand \
  -H "Content-Type: application/json" \
  -d '{"hand": "left"}'

# Switch to right hand  
curl -X POST http://localhost:3001/api/motor/hand \
  -H "Content-Type: application/json" \
  -d '{"hand": "right"}'
```

**Python:**
```python
import requests

def set_hand_orientation(hand_side):
    url = "http://localhost:3001/api/motor/hand"
    data = {"hand": hand_side}
    
    response = requests.post(url, json=data)
    result = response.json()
    print(f"Hand orientation set to: {hand_side}")
    return result

# Usage
set_hand_orientation("left")
set_hand_orientation("right")
```

---

### 4. Emergency Stop/Resume

**Purpose:** Immediately disable torque and halt all movement, or resume operation.

**Terminal (curl):**
```bash
# Emergency stop
curl -X POST http://localhost:3001/api/motor/emergency \
  -H "Content-Type: application/json" \
  -d '{"stop": true, "hand": "right"}'

# Resume operation
curl -X POST http://localhost:3001/api/motor/emergency \
  -H "Content-Type: application/json" \
  -d '{"stop": false, "hand": "right"}'
```

**Python:**
```python
import requests

def emergency_control(stop=True, hand="right"):
    url = "http://localhost:3001/api/motor/emergency"
    data = {"stop": stop, "hand": hand}
    
    response = requests.post(url, json=data)
    action = "STOPPED" if stop else "RESUMED"
    print(f"Emergency {action} for {hand} hand")
    return response.json()

# Usage
emergency_control(stop=True)  
emergency_control(stop=False)  
```

---

### 5. Torque Control

**Purpose:** Enable or disable motor holding torque.

**Terminal (curl):**
```bash
# Disable torque (free rotation)
curl -X POST http://localhost:3001/api/motor/torque \
  -H "Content-Type: application/json" \
  -d '{"torque": false, "hand": "right"}'

# Enable torque (position holding)
curl -X POST http://localhost:3001/api/motor/torque \
  -H "Content-Type: application/json" \
  -d '{"torque": true, "hand": "right"}'
```

**Python:**
```python
import requests

def set_torque(enabled=True, hand="right"):
    url = "http://localhost:3001/api/motor/torque"
    data = {"torque": enabled, "hand": hand}
    
    response = requests.post(url, json=data)
    state = "enabled" if enabled else "disabled"
    print(f"Torque {state} for {hand} hand")
    return response.json()

# Usage
set_torque(False) 
set_torque(True)    
```

---

### 6. Software Lock

**Purpose:** Prevent movement through software control.

**Terminal (curl):**
```bash
# Lock motor (prevent movement)
curl -X POST http://localhost:3001/api/motor/lock \
  -H "Content-Type: application/json" \
  -d '{"locked": true, "hand": "right"}'

# Unlock motor
curl -X POST http://localhost:3001/api/motor/lock \
  -H "Content-Type: application/json" \
  -d '{"locked": false, "hand": "right"}'
```

**Python:**
```python
import requests

def set_motor_lock(locked=True, hand="right"):
    url = "http://localhost:3001/api/motor/lock"
    data = {"locked": locked, "hand": hand}
    
    response = requests.post(url, json=data)
    state = "locked" if locked else "unlocked"
    print(f"Motor {state} for {hand} hand")
    return response.json()

# Usage
set_motor_lock(True)   # Lock motor
set_motor_lock(False)  # Unlock motor
```

---

### 7. Set Center Position

**Purpose:** Define current position as the neutral (0°) reference.

**Terminal (curl):**
```bash
curl -X POST http://localhost:3001/api/motor/center
```

**Python:**
```python
import requests

def set_center_position():
    url = "http://localhost:3001/api/motor/center"
    response = requests.post(url)
    result = response.json()
    print("Current position set as new center (0°)")
    return result

# Usage
set_center_position()
```

---

### 8. Recenter Motor

**Purpose:** Move to mid-range and establish new center point.

**Terminal (curl):**
```bash
curl -X POST http://localhost:3001/api/motor/recenter
```

**Python:**
```python
import requests

def recenter_motor():
    url = "http://localhost:3001/api/motor/recenter"
    response = requests.post(url)
    result = response.json()
    
    print(f"Motor recentered at tick {result['center_tick']}")
    print(f"Available range: {result['available_range_degrees']}°")
    return result

# Usage
recenter_motor()
```

---

### 9. Get Presets

**Purpose:** Retrieve all saved position presets.

**Terminal (curl):**
```bash
curl -X GET http://localhost:3001/api/motor/presets
```

**Python:**
```python
import requests

def get_presets():
    url = "http://localhost:3001/api/motor/presets"
    response = requests.get(url)
    result = response.json()
    
    print(f"Found {result['count']} presets:")
    for preset in result['presets']:
        print(f"  - {preset['name']}: {preset['pos']}°")
    
    return result

# Usage
presets = get_presets()
```

---

### 10. Save/Update Presets

**Purpose:** Update position presets with validation and persistence.

**Terminal (curl):**
```bash
curl -X POST http://localhost:3001/api/motor/presets \
  -H "Content-Type: application/json" \
  -d '{
    "presets": [
      {"name": "Rest", "pos": 0},
      {"name": "Therapy Start", "pos": 15},
      {"name": "Full Extension", "pos": 45},
      {"name": "Gentle Flex", "pos": -20}
    ]
  }'
```

**Python:**
```python
import requests

def save_presets(preset_list):
    url = "http://localhost:3001/api/motor/presets"
    data = {"presets": preset_list}
    
    response = requests.post(url, json=data)
    result = response.json()
    print(f"Saved {len(preset_list)} presets")
    return result

# Usage
therapy_presets = [
    {"name": "Rest", "pos": 0},
    {"name": "Therapy Start", "pos": 15}, 
    {"name": "Full Extension", "pos": 45},
    {"name": "Gentle Flex", "pos": -20}
]

save_presets(therapy_presets)
```

---

### 11. Reload Presets

**Purpose:** Refresh presets from storage without restart.

**Terminal (curl):**
```bash
curl -X POST http://localhost:3001/api/motor/presets/reload
```

**Python:**
```python
import requests

def reload_presets():
    url = "http://localhost:3001/api/motor/presets/reload"
    response = requests.post(url)
    result = response.json()
    print("Presets reloaded from storage")
    return result

# Usage
reload_presets()
```

---

## Complete Python Class Example

Here's a comprehensive Python class that wraps all the API endpoints:

```python
import requests
import time
from typing import List, Dict, Optional

class RehaGripController:
    def __init__(self, base_url="http://localhost:3001/api/motor"):
        self.base_url = base_url
    
    def move_to_position(self, position: float, velocity: int = 50, hand: str = "right") -> Dict:
        """Move motor to specific angle"""
        url = f"{self.base_url}/move"
        data = {"position": position, "velocity": velocity, "hand": hand}
        response = requests.post(url, json=data)
        return response.json()
    
    def get_status(self) -> Dict:
        """Get current motor status"""
        url = f"{self.base_url}/status"
        response = requests.post(url)
        return response.json()
    
    def set_hand_orientation(self, hand: str) -> Dict:
        """Set hand orientation (left/right)"""
        url = f"{self.base_url}/hand"
        data = {"hand": hand}
        response = requests.post(url, json=data)
        return response.json()
    
    def emergency_stop(self, stop: bool = True, hand: str = "right") -> Dict:
        """Emergency stop or resume"""
        url = f"{self.base_url}/emergency"
        data = {"stop": stop, "hand": hand}
        response = requests.post(url, json=data)
        return response.json()
    
    def set_torque(self, enabled: bool, hand: str = "right") -> Dict:
        """Enable/disable torque"""
        url = f"{self.base_url}/torque"
        data = {"torque": enabled, "hand": hand}
        response = requests.post(url, json=data)
        return response.json()
    
    def set_lock(self, locked: bool, hand: str = "right") -> Dict:
        """Software lock/unlock motor"""
        url = f"{self.base_url}/lock"
        data = {"locked": locked, "hand": hand}
        response = requests.post(url, json=data)
        return response.json()
    
    def set_center(self) -> Dict:
        """Set current position as center"""
        url = f"{self.base_url}/center"
        response = requests.post(url)
        return response.json()
    
    def recenter(self) -> Dict:
        """Move to mid-range and set new center"""
        url = f"{self.base_url}/recenter"
        response = requests.post(url)
        return response.json()
    
    def get_presets(self) -> Dict:
        """Get all saved presets"""
        url = f"{self.base_url}/presets"
        response = requests.get(url)
        return response.json()
    
    def save_presets(self, presets: List[Dict]) -> Dict:
        """Save preset list"""
        url = f"{self.base_url}/presets"
        data = {"presets": presets}
        response = requests.post(url, json=data)
        return response.json()
    
    def reload_presets(self) -> Dict:
        """Reload presets from storage"""
        url = f"{self.base_url}/presets/reload"
        response = requests.post(url)
        return response.json()
    
    # Convenience methods
    def run_therapy_sequence(self, positions: List[float], velocity: int = 30, hold_time: float = 2.0):
        """Run a sequence of positions with specified hold times"""
        for pos in positions:
            print(f"Moving to {pos}°...")
            self.move_to_position(pos, velocity)
            time.sleep(hold_time)
            
            # Check status after each move
            status = self.get_status()
            print(f"Current position: {status['position']}°, Load: {status['load']}N")
    
    def safe_shutdown(self):
        """Safely return to center and disable torque"""
        print("Initiating safe shutdown...")
        self.move_to_position(0, velocity=25)  # Return to center
        time.sleep(3)
        self.set_torque(False)  # Disable torque
        print("Safe shutdown complete")

# Usage example
if __name__ == "__main__":
    # Initialize controller
    reha = RehaGripController()
    
    # Check initial status
    status = reha.get_status()
    print(f"Initial position: {status['position']}°")
    
    # Set hand orientation
    reha.set_hand_orientation("right")
    
    # Run a simple therapy sequence
    therapy_positions = [0, 15, 30, 15, 0, -15, 0]
    reha.run_therapy_sequence(therapy_positions, velocity=25, hold_time=3.0)
    
    # Safe shutdown
    reha.safe_shutdown()
```

This documentation provides both the basic endpoint list you requested and comprehensive examples for both terminal and Python usage, making it easy to integrate RehaGrip into research applications or clinical workflows.

---

## How It Works

RehaGrip uses a **Dynamixel XL430-W250-T servo** connected to a swing-arm mechanism that lifts a hand platform. The system operates in **current-based position control mode** for smooth, safe movement with precise force control.

### System Architecture
- **Hardware Layer**: Dynamixel motor with USB serial communication
- **Backend Layer**: FastAPI server handling motor control and safety monitoring
- **Frontend Layer**: React GUI providing intuitive control interface
- **Storage Layer**: JSON-based persistent configuration and preset storage

### Safety Implementation
- Multiple safety layers including software limits, emergency stop, and load monitoring
- Automatic hand orientation mapping to prevent incorrect movement directions
- Real-time status monitoring with immediate feedback on system state

---

## Configuration

### Environment Variables
- `PRESET_FILE`: Custom path for preset storage (optional)
- `XDG_STATE_HOME`: State directory for preset storage (default: `~/.local/state`)

---

## Troubleshooting

### Common Issues
1. **Motor not responding**: Verify USB connection and check `/dev/ttyUSB0` permissions
2. **Permission denied**: Add user to dialout group: `sudo usermod -a -G dialout $USER`
3. **Position drift**: Recalibrate using `/center` endpoint after patient positioning
4. **Preset not saving**: Ensure write permissions to `~/.local/state/rehagrip/`

### Debug Commands
```bash
# Test motor communication
curl -X POST http://localhost:3001/api/motor/status

# Check available range
curl -X POST http://localhost:3001/api/motor/get_range

# Verify preset storage
curl -X GET http://localhost:3001/api/motor/presets
```

---

## 🧾 Project Proposal

> **Title:** Development of a Hand Orthotic Device for Stroke Research  
> **Location:** Northwestern University, Department of Physical Therapy and Human Movement Sciences  
> **Mentors:** Ahalya Mandana & Dr. Ana Maria Acosta  
>  
> **Objectives:**  
> - Apply finger extension forces with minimal weight on the hand
> - Allow voluntary finger flexion and thumb pinch during therapy
> - Prioritize patient comfort, easy donning/doffing, and clinical modularity
> - Provide precise, repeatable movement patterns for research applications
>  
> **Deliverables:**  
> - Functional motorized prototype with safety systems
> - Complete API for research integration and data collection
> - Clinical-ready GUI for therapist operation
> - Documentation and training materials

---
