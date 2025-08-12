#!/usr/bin/env python3
"""
loadcell_run.py
DYMH-103 (4-wire full bridge) + HX711 on Raspberry Pi 4

- Uses BCM pins (default: DT=GPIO5, SCK=GPIO6)
- Tares on start
- Loads calibration from JSON if present, otherwise guides you through a quick 2-point calibration
- Streams mass (kg) and force (N)
"""

import sys, time, json, os, argparse, platform, traceback

PRINT_PREFIX = "[HX711]"
DEFAULT_DOUT = 5     # GPIO5  (pin 29)
DEFAULT_SCK  = 6     # GPIO6  (pin 31)
DEFAULT_SAMPLES = 10
DEFAULT_CALFILE = "hx711_cal.json"
G_STD = 9.80665

def log(msg):
    print(f"{PRINT_PREFIX} {msg}", flush=True)

def die(msg, code=1):
    print(f"{PRINT_PREFIX} ERROR: {msg}", flush=True)
    sys.exit(code)

def import_libs():
    try:
        import RPi.GPIO as GPIO
    except Exception:
        traceback.print_exc()
        die("Failed to import RPi.GPIO. Are you on a Raspberry Pi?")

    try:
        from hx711 import HX711
    except Exception:
        traceback.print_exc()
        die("Failed to import hx711. Install with: pip install git+https://github.com/tatobari/hx711py.git")

    return GPIO, HX711

def wait_ready_timeout(hx, timeout_s=5.0, poll_s=0.01, label=""):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        try:
            if hx.is_ready():
                if label:
                    log(f"Ready ({label}) in {time.time()-t0:.3f}s")
                return True
        except Exception:
            traceback.print_exc()
            break
        time.sleep(poll_s)
    log(f"TIMEOUT: Not ready after {timeout_s:.1f}s {label}")
    return False

def load_calibration(path):
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r") as f:
            data = json.load(f)
        # expected keys: no_load, counts_per_kg, timestamp
        if "no_load" in data and "counts_per_kg" in data:
            return data
        return None
    except Exception:
        traceback.print_exc()
        return None

def save_calibration(path, no_load, counts_per_kg):
    data = {
        "no_load": float(no_load),
        "counts_per_kg": float(counts_per_kg),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    log(f"Saved calibration to {path}")

def do_calibration(hx, samples, calfile):
    log("Starting calibration.")
    input(">> Ensure NO load on the sensor. Press ENTER to capture zero… ")
    no_load = hx.get_weight(samples)
    log(f"Zero captured (avg {samples}): {no_load:.2f}")

    while True:
        try:
            known = float(input(">> Place a known mass (kg) and enter its value (e.g., 2.000): ").strip())
            if known <= 0:
                print("Please enter a positive number.")
                continue
            break
        except ValueError:
            print("Invalid number. Try again.")

    time.sleep(0.5)
    known_load = hx.get_weight(samples)
    counts_per_kg = (known_load - no_load) / known
    if abs(counts_per_kg) < 1e-6:
        die("Calibration failed: counts_per_kg ~ 0")

    log(f"Calibration complete: counts_per_kg={counts_per_kg:.2f}")
    save_calibration(calfile, no_load, counts_per_kg)
    return no_load, counts_per_kg

def main():
    parser = argparse.ArgumentParser(description="DYMH-103 + HX711 reader for Raspberry Pi 4")
    parser.add_argument("--dout", type=int, default=DEFAULT_DOUT, help=f"HX711 DOUT pin (BCM), default {DEFAULT_DOUT}")
    parser.add_argument("--sck",  type=int, default=DEFAULT_SCK,  help=f"HX711 SCK  pin (BCM), default {DEFAULT_SCK}")
    parser.add_argument("--samples", type=int, default=DEFAULT_SAMPLES, help=f"Samples to average per reading, default {DEFAULT_SAMPLES}")
    parser.add_argument("--calfile", type=str, default=DEFAULT_CALFILE, help=f"Calibration file path, default {DEFAULT_CALFILE}")
    parser.add_argument("--rate", type=float, default=10.0, help="Update rate Hz (prints per second), default 10.0")
    parser.add_argument("--skipcal", action="store_true", help="Skip calibration even if calfile missing (reads raw units)")
    args = parser.parse_args()

    print("=== HX711 Load Cell Reader ===")
    print(f"Python:   {sys.version.split()[0]}")
    print(f"Platform: {platform.platform()}")
    print(f"Pins:     DOUT(BCM)={args.dout}, SCK(BCM)={args.sck}")
    print(f"Samples:  {args.samples}  |  Rate: {args.rate} Hz")
    print(f"Calfile:  {args.calfile}")
    print("================================\n")

    GPIO, HX711 = import_libs()

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(True)

    try:
        hx = HX711(dout_pin=args.dout, args.sck)
        log("HX711 instance created.")
        try:
            hx.set_reading_format("MSB", "MSB")
            log("Reading format set: MSB/MSB")
        except Exception:
            log("Reading format set not supported by this lib (ok).")

        # Reference unit (tatobari lib keeps it for legacy; we'll compute scale ourselves)
        try:
            hx.set_reference_unit(1)
        except Exception:
            pass

        log("Resetting HX711…")
        hx.reset()

        log("Waiting ready before tare…")
        if not wait_ready_timeout(hx, timeout_s=5.0, label="pre-tare"):
            die("HX711 not ready. Check wiring and power.")

        log("Taring (ensure NO load)…")
        hx.tare()
        log("Tare complete.")

        cal = load_calibration(args.calfile)
        if cal:
            no_load = float(cal["no_load"])
            counts_per_kg = float(cal["counts_per_kg"])
            log(f"Loaded calibration: no_load={no_load:.2f}, counts_per_kg={counts_per_kg:.2f}")
        else:
            if args.skipcal:
                log("No calibration file found and --skipcal set. Reporting raw ‘units’.")
                no_load, counts_per_kg = 0.0, None
            else:
                no_load, counts_per_kg = do_calibration(hx, args.samples, args.calfile)

        period = 1.0 / max(0.1, args.rate)
        log("Reading loop started. Ctrl+C to exit.\n")

        while True:
            if not wait_ready_timeout(hx, timeout_s=1.5, label="read"):
                # Not ready: likely wiring/power noise; skip this cycle
                time.sleep(period)
                continue

            val = hx.get_weight(args.samples)
            ts = time.strftime("%H:%M:%S")

            if counts_per_kg is None or abs(counts_per_kg) < 1e-9:
                # Raw units (uncalibrated)
                print(f"{ts}  RAW: {val:.2f}")
            else:
                mass_kg = (val - no_load) / counts_per_kg
                force_N = mass_kg * G_STD
                print(f"{ts}  Mass: {mass_kg:+.3f} kg   Force: {force_N:+.2f} N")

            # Optional small power cycle to keep HX711 stable on some boards
            try:
                hx.power_down()
                time.sleep(0.02)
                hx.power_up()
            except Exception:
                pass

            time.sleep(period)

    except KeyboardInterrupt:
        log("KeyboardInterrupt. Exiting.")
    except Exception:
        traceback.print_exc()
        die("Unhandled exception.")
    finally:
        try:
            GPIO.cleanup()
            log("GPIO cleaned up.")
        except Exception:
            pass

if __name__ == "__main__":
    main()
