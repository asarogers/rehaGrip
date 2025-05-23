import time
from dynamixel_sdk import *

# ==================== Configuration ====================
PORT_NAME = '/dev/ttyUSB0'
BAUDRATE = 57600
DXL_ID = 1
PROTOCOL_VERSION = 2.0

MIN_POS = 2800
MAX_POS = 3500

# Control table addresses
ADDR_TORQUE_ENABLE = 64
ADDR_OPERATING_MODE = 11
ADDR_GOAL_POSITION = 116
ADDR_PRESENT_POSITION = 132
ADDR_PROFILE_ACCELERATION = 108
ADDR_PROFILE_VELOCITY = 112

# ==================== Setup ====================
portHandler = PortHandler(PORT_NAME)
packetHandler = PacketHandler(PROTOCOL_VERSION)

if not portHandler.openPort():
    print("❌ Failed to open port")
    exit()

if not portHandler.setBaudRate(BAUDRATE):
    print("❌ Failed to set baudrate")
    exit()

# Disable torque before changing mode
packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)

# Set Position Control Mode (3)
packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_OPERATING_MODE, 3)

# Enable torque
packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 1)
print("✅ Torque Enabled")

# Set profile parameters
packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_ACCELERATION, 50)
packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_VELOCITY, 100)

# ==================== Motion Loop ====================
try:
    while True:
        for goal_pos in [MIN_POS, MAX_POS]:
            print(f"➡️ Moving to {goal_pos}")
            packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_GOAL_POSITION, goal_pos)

            time.sleep(2.0)  # Wait for motion to complete

            pos, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)
            print(f"📍 Current Position: {pos}")

except KeyboardInterrupt:
    print("\n🛑 Interrupted. Disabling torque.")
    packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)
    portHandler.closePort()
