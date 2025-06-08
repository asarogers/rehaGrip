# RehaGrip – Motorized Hand Orthotic for Stroke Rehabilitation

**Created by:** Asa Rogers  
**GitHub:** [github.com/asarogers/rehaGrip](https://github.com/asarogers/rehaGrip)  
**CAD Model:** [Onshape Link](https://cad.onshape.com/documents/70b0fc4719f91c87f4f5c56d/w/a0b7ff8eeb91e3fab313c6a8/e/38638431a9837a5ab3d1f154)  


---

## Overview

**RehaGrip** is a lightweight, motor-driven orthotic device for hand rehabilitation, specifically designed to help **stroke patients** re-train finger extension movements. The system uses a swing-arm platform actuated by a Dynamixel servo motor to gently and precisely open the user's fingers using adjustable extension angles.

Unlike earlier versions of this device, **RehaGrip no longer uses inflatable bladders**—it has transitioned to a more robust, motorized mechanical design.

---

## Core Features

- **Dynamic finger extension** using a high-torque servo motor  
- **Open-source API** to adjust motor position and extension levels  
- **Swing-arm linkage** designed for consistent and safe finger movement  
- **Customizable CAD parts** for different hand sizes and setups  
- **Ergonomic platform** that is easy to wear and remove, even with a clenched hand  

---

## Current Prototype

![RehaGrip CAD Model](https://cad.onshape.com/documents/70b0fc4719f91c87f4f5c56d/w/a0b7ff8eeb91e3fab313c6a8/e/38638431a9837a5ab3d1f154)

*CAD model showing swing-arm actuation directly linked to the motor horn*

---

## How It Works

RehaGrip uses a Dynamixel XL430-W250-T servo motor to control a **mechanical swing arm**. This arm rotates to lift a lightweight platform, gently extending the fingers of a user whose hand rests on top.

The motor is controlled via USB serial communication using a Python-based API. You can send position commands to increase or decrease the rotation angle based on therapy requirements.

---

## 🧾 Project Proposal

> **Title:** Development of a Hand Orthotic Device for Stroke Research  
> **Location:** Northwestern University, Department of Physical Therapy and Human Movement Sciences  
> **Mentors:** Ahalya Mandana & Dr. Ana Maria Acosta  
>  
> **Objectives:**  
> - Create a lightweight orthotic that applies finger extension forces via actuators  
> - Ensure actuators are mounted away from the hand for reduced weight  
> - Allow voluntary finger flexion and thumb pinch  
> - Design for comfort, easy donning/doffing, and customizability  
>  
> **Deliverables:**  
> - Fully functional prototype  
> - Optional Python-based API for future research use

---

## Roadmap

- [x] Validate swing-arm mechanism with CAD  
- [x] Integrate Dynamixel motor  
- [x] Create open/close API  
- [ ] Finalize thumb holster  
- [ ] Conduct user-centered testing with therapists  
- [ ] Add sensor feedback (optional future milestone)

---

## Acknowledgements

Special thanks to Ana Maria Acosta and Ahalya Mandana at NUPTHMS for guiding this project and enabling its clinical relevance.
