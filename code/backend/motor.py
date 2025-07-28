import time
from dynamixel_sdk import *  # Uses Dynamixel SDK library

# === Configuration ===
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
ADDR_PRESENT_CURRENT = 126

# XM430-W210-R constants
CURRENT_CONVERSION = 2.69   # 1 raw unit = 2.69 mA
TORQUE_CONSTANT = 1.30      # Nm per Amp

def main():
    # Create port and packet handlers
    portHandler = PortHandler(PORT_NAME)
    packetHandler = PacketHandler(PROTOCOL_VERSION)

    # Open port
    if not portHandler.openPort():
        print("Failed to open port")
        return

    if not portHandler.setBaudRate(BAUDRATE):
        print("Failed to set baudrate")
        return

    # Disable torque
    packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)

    # Set current-based position mode (Operating Mode 5)
    packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_OPERATING_MODE, 5)

    # Enable torque
    packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 1)
    print("Torque Enabled in Current-based Position Control Mode")

    # Set acceleration and velocity
    packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_ACCELERATION, 50)
    packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_PROFILE_VELOCITY, 100)

    try:
        while True:
            for goal_pos in [MIN_POS, MAX_POS]:
                print(f"➡️ Moving to position: {goal_pos}")
                packetHandler.write4ByteTxRx(portHandler, DXL_ID, ADDR_GOAL_POSITION, goal_pos)
                time.sleep(2.0)

                # Read current position
                pos, _, _ = packetHandler.read4ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_POSITION)

                # Read present current
                raw_current, _, _ = packetHandler.read2ByteTxRx(portHandler, DXL_ID, ADDR_PRESENT_CURRENT)
                # Convert unsigned to signed (16 bit)
                if raw_current > 32767:
                    raw_current -= 65536

                current_mA = raw_current * CURRENT_CONVERSION
                current_A = current_mA / 1000.0
                estimated_torque = current_A * TORQUE_CONSTANT

                print(f" Position: {pos}")
                print(f"⚡ Current Draw: {current_mA:.2f} mA")
                print(f" Estimated Torque: {estimated_torque:.3f} Nm\n")

    except KeyboardInterrupt:
        print("\nInterrupted by user. Disabling torque.")
        packetHandler.write1ByteTxRx(portHandler, DXL_ID, ADDR_TORQUE_ENABLE, 0)
        portHandler.closePort()

if __name__ == "__main__":
    main()
