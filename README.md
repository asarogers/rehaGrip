# RehaGrip – Motorized Hand Orthotic for Stroke Rehabilitation

**Created by:** Asa Rogers  
**GitHub:** [github.com/asarogers/rehaGrip](https://github.com/asarogers/rehaGrip)  
**CAD Model:** [Onshape Link](https://cad.onshape.com/documents/70b0fc4719f91c87f4f5c56d/w/a0b7ff8eeb91e3fab313c6a8/e/38638431a9837a5ab3d1f154)  

---

## Overview

RehaGrip is a lightweight, motor-driven orthotic for hand rehabilitation, designed to help **stroke patients** re-train finger extension movements.  
A **Dynamixel servo** powers a swing-arm platform that gently opens the user’s fingers with adjustable angles, velocity, and presets.  
The system features a **FastAPI backend** and **React-based GUI** for precise, repeatable, and safe motor control.

---

## Core Features

- **Motor Control**
  - Move to a target angle in degrees with optional velocity control.
  - Set and recenter the middle position.
  - Switch between **left-hand** and **right-hand** mode.
  - Enable/disable torque for free rotation.
  - Lock motor via software to prevent accidental movement.
- **State Tracking**
  - Get position (ticks & degrees), load, movement state, torque, and emergency status.
  - Display movement limits based on current center.
- **Presets**
  - Save, load, and reload position presets from JSON.
  - Built-in default presets for quick setup.
- **Emergency Handling**
  - Emergency stop for instant torque cutoff.
  - Resume operation after clearing emergency state.
- **React GUI**
  - Live motor status updates.
  - Preset editing and saving.
  - Incremental position control buttons.
  - Velocity slider.
  - Emergency stop toggle.
  - Hand mode switching.

---

## Backend API Endpoints & Examples

**Base URL:** `http://<host>:3001/api/motor`

| Endpoint                   | Method | Description | Example Call |
|----------------------------|--------|-------------|--------------|
| `/move`                    | POST   | Move motor to a target position (degrees) with optional velocity. | ```bash\ncurl -X POST http://localhost:3001/api/motor/move -H "Content-Type: application/json" -d '{"position": 30, "velocity": 50}'\n``` |
| `/status`                  | GET    | Get current motor state (position, load, movement, torque, etc.). | ```bash\ncurl http://localhost:3001/api/motor/status\n``` |
| `/center`                  | POST   | Set current position as the center. | ```bash\ncurl -X POST http://localhost:3001/api/motor/center\n``` |
| `/recenter`                | POST   | Move to middle of range and set as center. | ```bash\ncurl -X POST http://localhost:3001/api/motor/recenter\n``` |
| `/hand`                    | POST   | Switch between left or right hand mode. | ```bash\ncurl -X POST http://localhost:3001/api/motor/hand -H "Content-Type: application/json" -d '{"hand": "left"}'\n``` |
| `/lock`                    | POST   | Lock or unlock motor movement. | ```bash\ncurl -X POST http://localhost:3001/api/motor/lock -H "Content-Type: application/json" -d '{"lock": true}'\n``` |
| `/torque`                  | POST   | Enable or disable motor torque. | ```bash\ncurl -X POST http://localhost:3001/api/motor/torque -H "Content-Type: application/json" -d '{"enable": false}'\n``` |
| `/emergency`               | POST   | Engage or disengage emergency stop. | ```bash\ncurl -X POST http://localhost:3001/api/motor/emergency -H "Content-Type: application/json" -d '{"stop": true}'\n``` |
| `/presets`                 | GET    | Get saved position presets. | ```bash\ncurl http://localhost:3001/api/motor/presets\n``` |
| `/presets`                 | POST   | Save updated position presets. | ```bash\ncurl -X POST http://localhost:3001/api/motor/presets -H "Content-Type: application/json" -d '[{"name": "Neutral", "pos": 0}]'\n``` |
| `/presets/reload`          | POST   | Reload presets from file. | ```bash\ncurl -X POST http://localhost:3001/api/motor/presets/reload\n``` |

---

## How It Works

RehaGrip uses a **Dynamixel XL430-W250-T servo** to control a swing arm that lifts the hand platform.  
All motion is handled in **current-based position control mode** for smooth, safe operation.  
The Python backend communicates with the motor over USB serial, while the React GUI interacts with the backend via REST API calls.

---

## 🧾 Project Proposal

> **Title:** Development of a Hand Orthotic Device for Stroke Research  
> **Location:** Northwestern University, Department of Physical Therapy and Human Movement Sciences  
> **Mentors:** Ahalya Mandana & Dr. Ana Maria Acosta  
>  
> **Objectives:**  
> - Apply finger extension forces with minimal weight on the hand.  
> - Allow voluntary finger flexion and thumb pinch.  
> - Prioritize comfort, easy donning/doffing, and modularity.  
>  
> **Deliverables:**  
> - Functional motorized prototype.  
> - API for research integration.  

---

## Roadmap

- [x] CAD design & swing-arm mechanism.  
- [x] Dynamixel motor integration.  
- [x] Backend API for open/close control.  
- [x] GUI for live control & presets.  
- [ ] Finalize thumb holster.  
- [ ] User testing with therapists.  
- [ ] Add sensor feedback (future).

---

## Acknowledgements

Thanks to **Ana Maria Acosta** and **Ahalya Mandana** for mentorship and clinical guidance.
