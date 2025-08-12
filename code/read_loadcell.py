#!/usr/bin/env python3
# Minimal HX711 reader (tatobari/hx711py) for Raspberry Pi
# Wiring (BCM): HX711 DT -> GPIO5, SCK -> GPIO6, VCC -> 3.3V, GND -> GND

import time
import sys
import traceback

try:
    import RPi.GPIO as GPIO
    from hx711 import HX711
except Exception:
    traceback.print_exc()
    sys.exit("Missing deps. On the Pi run:\n"
             "  sudo apt update && sudo apt install -y python3-rpi.gpio\n"
             "  pip install git+https://github.com/tatobari/hx711py.git")

DT_PIN  = 5   # GPIO5  (pin 29)
SCK_PIN = 6   # GPIO6  (pin 31)
AVG_SAMPLES = 10   # average N samples per print
PRINT_HZ    = 10   # prints per second

def wait_ready(hx, timeout_s=5.0, poll_s=0.01):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        if hx.is_ready():
            return True
        time.sleep(poll_s)
    return False

def main():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    # IMPORTANT: tatobari hx711 expects positional args (no keywords)
    hx = HX711(DT_PIN, SCK_PIN)

    # Optional but typical for this lib
    try:
        hx.set_reading_format("MSB", "MSB")
    except Exception:
        pass

    # Reference unit is not used here (we just read tared raw units)
    try:
        hx.set_reference_unit(1)
    except Exception:
        pass

    # Reset & tare
    hx.reset()
    if not wait_ready(hx, 5.0):
        sys.exit("HX711 not ready. Check wiring/power.")
    print("Taring… make sure no load is on the sensor.")
    hx.tare()
    print("Tare complete. Reading… (Ctrl+C to stop)\n")

    period = 1.0 / max(1.0, PRINT_HZ)

    try:
        while True:
            if not wait_ready(hx, 1.0):
                # Skip this cycle if chip isn't ready
                time.sleep(period)
                continue

            # get_weight(N) returns average over N samples
            val = hx.get_weight(AVG_SAMPLES)
            # Positive increases with load. If reversed, swap A+ and A- on HX711.
            print(f"{val:+.2f} units")
            time.sleep(period)

    except KeyboardInterrupt:
        print("\nStopping…")
    finally:
        try:
            GPIO.cleanup()
        except Exception:
            pass

if __name__ == "__main__":
    main()
