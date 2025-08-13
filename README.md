# RehaGrip – Motorized Hand Orthotic for Stroke Rehabilitation

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
PORT_NAME = '/dev/ttyUSB0'    # Serial port device
BAUDRATE = 57600              # Communication speed
DXL_ID = 1                    # Motor ID (default: 1)
PROTOCOL_VERSION = 2.0        # Dynamixel protocol version

RIGHT_CENTER_TICK = 3046      # Right hand center position
LEFT_CENTER_TICK = 1000       # Left hand center position
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

## Backend API Endpoints & Examples

**Base URL:** `http://localhost:3001/api/motor`

### Motor Movement

#### Move to Position
Move motor to a specific angle with optional velocity control.

**POST** `/move`

```bash
curl -X POST http://localhost:3001/api/motor/move \
  -H "Content-Type: application/json" \
  -d '{
    "position": 30.0,
    "velocity": 75,
    "hand": "right"
  }'
```

**Request Parameters:**
- `position`: Target angle in degrees (-60 to 60)
- `velocity`: Optional movement speed (1-100, default: 50)
- `hand`: Optional hand orientation ("left" or "right")

**Response:**
```json
{
  "ok": true,
  "position": 29.8,
  "position_tick": 3180,
  "target_tick": 3184,
  "requested_degrees": 30.0
}
```

### Motor Status

#### Get Current Status
Retrieve comprehensive motor state information.

**POST** `/status`

```bash
curl -X POST http://localhost:3001/api/motor/status
```

**Response:**
```json
{
  "position": 29.8,
  "position_tick": 3180,
  "center_tick": 3046,
  "load": 0.25,
  "moving": false,
  "locked": false,
  "torque": true,
  "emergency": false
}
```

### Hand Orientation

#### Switch Hand Mode
Configure motor for left or right hand operation.

**POST** `/hand`

```bash
curl -X POST http://localhost:3001/api/motor/hand \
  -H "Content-Type: application/json" \
  -d '{"hand": "left"}'
```

### Safety Controls

#### Emergency Stop
Immediately disable torque and halt all movement.

**POST** `/emergency`

```bash
# Engage emergency stop
curl -X POST http://localhost:3001/api/motor/emergency \
  -H "Content-Type: application/json" \
  -d '{"stop": true, "hand": "right"}'

# Resume operation
curl -X POST http://localhost:3001/api/motor/emergency \
  -H "Content-Type: application/json" \
  -d '{"stop": false, "hand": "right"}'
```

#### Torque Control
Enable or disable motor holding torque.

**POST** `/torque`

```bash
curl -X POST http://localhost:3001/api/motor/torque \
  -H "Content-Type: application/json" \
  -d '{"torque": false, "hand": "right"}'
```

#### Software Lock
Prevent movement through software control.

**POST** `/lock`

```bash
curl -X POST http://localhost:3001/api/motor/lock \
  -H "Content-Type: application/json" \
  -d '{"locked": true, "hand": "right"}'
```

### Position Calibration

#### Set Center Position
Define current position as the neutral (0°) reference.

**POST** `/center`

```bash
curl -X POST http://localhost:3001/api/motor/center
```

#### Recenter Motor
Move to mid-range and establish new center point.

**POST** `/recenter`

```bash
curl -X POST http://localhost:3001/api/motor/recenter
```

**Response:**
```json
{
  "ok": true,
  "center_tick": 2048,
  "available_range_degrees": 360
}
```

### Preset Management

#### Get Presets
Retrieve all saved position presets.

**GET** `/presets`

```bash
curl -X GET http://localhost:3001/api/motor/presets
```

**Response:**
```json
{
  "ok": true,
  "presets": [
    {"name": "Neutral", "pos": 0},
    {"name": "Open", "pos": 45},
    {"name": "Closed", "pos": -45}
  ],
  "preset_file": "/home/user/.local/state/rehagrip/motor_presets.json",
  "count": 3
}
```

#### Save Presets
Update position presets with validation and persistence.

**POST** `/presets`

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

#### Reload Presets
Refresh presets from storage without restart.

**POST** `/presets/reload`

```bash
curl -X POST http://localhost:3001/api/motor/presets/reload
```

---

## Usage Examples

### Basic Rehabilitation Session

```bash
# 1. Check system status
curl -X POST http://localhost:3001/api/motor/status

# 2. Ensure proper hand configuration
curl -X POST http://localhost:3001/api/motor/hand \
  -H "Content-Type: application/json" \
  -d '{"hand": "right"}'

# 3. Start with neutral position
curl -X POST http://localhost:3001/api/motor/move \
  -H "Content-Type: application/json" \
  -d '{"position": 0, "velocity": 30}'

# 4. Gentle extension movement
curl -X POST http://localhost:3001/api/motor/move \
  -H "Content-Type: application/json" \
  -d '{"position": 25, "velocity": 20}'

# 5. Return to neutral
curl -X POST http://localhost:3001/api/motor/move \
  -H "Content-Type: application/json" \
  -d '{"position": 0, "velocity": 25}'
```

### Emergency Procedures

```bash
# Immediate stop (use in emergency)
curl -X POST http://localhost:3001/api/motor/emergency \
  -H "Content-Type: application/json" \
  -d '{"stop": true}'

# System recovery
curl -X POST http://localhost:3001/api/motor/emergency \
  -H "Content-Type: application/json" \
  -d '{"stop": false}'

# Verify safe operation
curl -X POST http://localhost:3001/api/motor/status
```

### Preset-Based Therapy

```bash
# Create therapy-specific presets
curl -X POST http://localhost:3001/api/motor/presets \
  -H "Content-Type: application/json" \
  -d '{
    "presets": [
      {"name": "Patient Rest", "pos": -5},
      {"name": "Gentle Stretch", "pos": 20},
      {"name": "Active Extension", "pos": 40},
      {"name": "Return Position", "pos": 0}
    ]
  }'

# Use preset for consistent therapy
curl -X POST http://localhost:3001/api/motor/move \
  -H "Content-Type: application/json" \
  -d '{"position": 20, "velocity": 15}'  # Gentle Stretch position
```

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

### File Structure
```
rehagrip/
├── motor_control_api.py          # FastAPI backend server
├── motor_control_gui.jsx         # React frontend component  
├── README.md                     # This documentation
└── ~/.local/state/rehagrip/
    └── motor_presets.json        # Persistent preset storage
```

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
