#!/usr/bin/env python3
"""
Load Cell Reader for DYMH-103 with HX711 Amplifier
Optimized for Raspberry Pi 4 Model B
Reads force measurements from a 20kg load cell
"""

import RPi.GPIO as GPIO
import time
import statistics
import sys
import signal

class HX711:
    def __init__(self, dout_pin, pd_sck_pin, gain=128):
        """
        Initialize HX711 load cell amplifier for Raspberry Pi 4
        
        Args:
            dout_pin (int): GPIO pin connected to HX711 DOUT (BCM numbering)
            pd_sck_pin (int): GPIO pin connected to HX711 PD_SCK (BCM numbering)
            gain (int): Amplification gain (128, 64, or 32)
        """
        self.PD_SCK = pd_sck_pin
        self.DOUT = dout_pin
        self.gain = gain
        
        # Setup GPIO with Pi 4 optimizations
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)  # Suppress warnings for Pi 4
        GPIO.setup(self.PD_SCK, GPIO.OUT, initial=GPIO.LOW)
        GPIO.setup(self.DOUT, GPIO.IN, pull_up_down=GPIO.PUD_OFF)
        
        # Power up and stabilize
        time.sleep(0.1)
        GPIO.output(self.PD_SCK, False)
        
        # Initial read to set gain and stabilize
        for _ in range(3):
            try:
                self.read()
                break
            except:
                time.sleep(0.1)
        
        # Calibration values (you'll need to determine these)
        self.offset = 0  # Zero offset (tare value)
        self.scale = 1   # Scale factor (kg per unit)
        
        print(f"HX711 initialized on Pi 4 - DOUT: GPIO{dout_pin}, SCK: GPIO{pd_sck_pin}")
        
    def is_ready(self):
        """Check if HX711 is ready for reading (optimized for Pi 4)"""
        return GPIO.input(self.DOUT) == GPIO.LOW
    
    def read(self):
        """Read raw value from HX711 (optimized timing for Pi 4)"""
        # Wait for HX711 to be ready with timeout
        timeout = time.time() + 1.0  # 1 second timeout
        while not self.is_ready():
            if time.time() > timeout:
                raise Exception("HX711 timeout - check connections")
            time.sleep(0.001)  # Reduced sleep for Pi 4's faster CPU
        
        # Read 24-bit value with precise timing for Pi 4
        count = 0
        for i in range(24):
            GPIO.output(self.PD_SCK, GPIO.HIGH)
            count = count << 1
            GPIO.output(self.PD_SCK, GPIO.LOW)
            if GPIO.input(self.DOUT) == GPIO.HIGH:
                count += 1
        
        # Set gain for next reading
        for i in range(self.gain_pulses()):
            GPIO.output(self.PD_SCK, GPIO.HIGH)
            GPIO.output(self.PD_SCK, GPIO.LOW)
        
        # Convert to signed 24-bit value
        if count & 0x800000:
            count -= 0x1000000
            
        return count
    
    def gain_pulses(self):
        """Get number of pulses needed for gain setting"""
        if self.gain == 128:
            return 1
        elif self.gain == 64:
            return 3
        elif self.gain == 32:
            return 2
        else:
            return 1
    
    def read_average(self, times=10):
        """Read average of multiple readings"""
        values = []
        for _ in range(times):
            values.append(self.read())
            time.sleep(0.01)
        return sum(values) / len(values)
    
    def tare(self, times=10):
        """Set the current reading as zero offset"""
        self.offset = self.read_average(times)
        print(f"Tared with offset: {self.offset}")
    
    def calibrate(self, known_weight_kg):
        """
        Calibrate the scale with a known weight
        
        Args:
            known_weight_kg (float): Weight of calibration object in kg
        """
        print("Remove all weight and press Enter to tare...")
        input()
        self.tare()
        
        print(f"Place {known_weight_kg}kg weight and press Enter...")
        input()
        reading = self.read_average(20)
        
        self.scale = known_weight_kg / (reading - self.offset)
        print(f"Calibrated with scale factor: {self.scale}")
    
    def get_weight(self, times=5):
        """Get calibrated weight reading in kg"""
        raw_value = self.read_average(times)
        weight = (raw_value - self.offset) * self.scale
        return weight
    
    def get_force_newtons(self, times=5):
        """Get force reading in Newtons (weight * 9.81)"""
        weight_kg = self.get_weight(times)
        return weight_kg * 9.81
    
    def cleanup(self):
        """Clean up GPIO"""
        GPIO.cleanup()


class LoadCellMonitor:
    def __init__(self, dout_pin=5, pd_sck_pin=6):
        """
        Initialize load cell monitor for Raspberry Pi 4
        
        Default GPIO pins (BCM numbering):
        - GPIO 5 (Pin 29) for DOUT
        - GPIO 6 (Pin 31) for PD_SCK
        
        These pins are reliable on Pi 4 and don't conflict with I2C, SPI, or UART
        """
        print("Initializing Load Cell Monitor for Raspberry Pi 4...")
        print(f"Using GPIO pins: DOUT={dout_pin} (Pin {self.gpio_to_pin(dout_pin)}), SCK={pd_sck_pin} (Pin {self.gpio_to_pin(pd_sck_pin)})")
        
        self.hx711 = HX711(dout_pin, pd_sck_pin)
        
        # Setup signal handler for clean shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def gpio_to_pin(self, gpio_num):
        """Convert BCM GPIO number to physical pin number"""
        gpio_to_pin_map = {
            2: 3, 3: 5, 4: 7, 5: 29, 6: 31, 7: 26, 8: 24, 9: 21, 10: 19, 11: 23,
            12: 32, 13: 33, 14: 8, 15: 10, 16: 36, 17: 11, 18: 12, 19: 35, 20: 38,
            21: 40, 22: 15, 23: 16, 24: 18, 25: 22, 26: 37, 27: 13
        }
        return gpio_to_pin_map.get(gpio_num, "?")
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        print(f"\nReceived signal {signum}, shutting down...")
        self.hx711.cleanup()
        sys.exit(0)
        
    def calibrate_system(self):
        """Interactive calibration process"""
        print("=== Load Cell Calibration ===")
        print("This will calibrate your DYMH-103 20kg load cell")
        
        # Get known weight for calibration
        while True:
            try:
                cal_weight = float(input("Enter calibration weight in kg (e.g., 1.0, 5.0): "))
                if 0 < cal_weight <= 20:
                    break
                else:
                    print("Weight must be between 0 and 20kg")
            except ValueError:
                print("Please enter a valid number")
        
        self.hx711.calibrate(cal_weight)
        print("Calibration complete!")
    
    def monitor_continuous(self):
        """Continuously monitor load cell readings"""
        print("\n=== Continuous Monitoring ===")
        print("Press Ctrl+C to stop")
        print("Weight (kg) | Force (N) | Raw Value")
        print("-" * 35)
        
        try:
            while True:
                weight = self.hx711.get_weight()
                force = self.hx711.get_force_newtons()
                raw = self.hx711.read()
                
                print(f"{weight:8.3f}   | {force:7.2f} | {raw:8d}")
                time.sleep(0.5)
                
        except KeyboardInterrupt:
            print("\nStopping monitor...")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            self.hx711.cleanup()
    
    def single_reading(self):
        """Take a single reading"""
        weight = self.hx711.get_weight(times=10)
        force = self.hx711.get_force_newtons(times=10)
        raw = self.hx711.read_average(10)
        
        print(f"\nSingle Reading:")
        print(f"Weight: {weight:.3f} kg")
        print(f"Force:  {force:.2f} N")
        print(f"Raw:    {raw:.0f}")
        
        return weight, force, raw


def main():
    """Main program optimized for Raspberry Pi 4"""
    print("DYMH-103 Load Cell Reader for Raspberry Pi 4")
    print("=" * 45)
    print("\nHardware Setup:")
    print("HX711 -> Raspberry Pi 4 connections:")
    print("  VDD  -> 3.3V (Pin 1 or 17)")
    print("  VCC  -> 5V   (Pin 2 or 4)")
    print("  GND  -> GND  (Pin 6, 9, 14, 20, 25, 30, 34, or 39)")
    print("  DOUT -> GPIO 5 (Pin 29)")
    print("  SCK  -> GPIO 6 (Pin 31)")
    print("\nLoad Cell -> HX711 connections:")
    print("  Red   -> E+   (Excitation +)")
    print("  Black -> E-   (Excitation -)")
    print("  White -> A+   (Signal +)")
    print("  Green -> A-   (Signal -)")
    print("\n" + "=" * 45)
    
    # Check if running as root (required for GPIO access)
    if os.geteuid() != 0:
        print("Warning: Not running as root. You may need to run with 'sudo'")
    
    try:
        # Initialize with recommended GPIO pins for Pi 4
        monitor = LoadCellMonitor(dout_pin=5, pd_sck_pin=6)
        
        while True:
            print("\nOptions:")
            print("1. Calibrate load cell")
            print("2. Take single reading")
            print("3. Continuous monitoring")
            print("4. Tare (zero) the scale")
            print("5. System info")
            print("6. Exit")
            
            choice = input("\nEnter choice (1-6): ").strip()
            
            try:
                if choice == '1':
                    monitor.calibrate_system()
                elif choice == '2':
                    monitor.single_reading()
                elif choice == '3':
                    monitor.monitor_continuous()
                elif choice == '4':
                    monitor.hx711.tare()
                elif choice == '5':
                    monitor.show_system_info()
                elif choice == '6':
                    print("Goodbye!")
                    break
                else:
                    print("Invalid choice. Please enter 1-6.")
                    
            except KeyboardInterrupt:
                print("\nOperation interrupted")
                continue
            except Exception as e:
                print(f"Error: {e}")
                continue
    
    except Exception as e:
        print(f"Failed to initialize: {e}")
        print("Check your wiring and try running with 'sudo'")
    
    finally:
        # Cleanup
        try:
            monitor.hx711.cleanup()
        except:
            pass


    def show_system_info(self):
        """Display system information for debugging"""
        print("\n=== System Information ===")
        try:
            with open('/proc/cpuinfo', 'r') as f:
                for line in f:
                    if 'Model' in line:
                        print(f"Pi Model: {line.split(':')[1].strip()}")
                        break
        except:
            print("Pi Model: Unknown")
        
        print(f"Python version: {sys.version.split()[0]}")
        print(f"GPIO mode: {GPIO.getmode()}")
        print(f"Current offset: {self.hx711.offset}")
        print(f"Current scale: {self.hx711.scale}")
        
        # Test GPIO pins
        print(f"\nGPIO Pin Status:")
        print(f"DOUT (GPIO {self.hx711.DOUT}): {'Ready' if self.hx711.is_ready() else 'Not Ready'}")
        
        # Raw reading test
        try:
            raw = self.hx711.read()
            print(f"Raw reading: {raw}")
        except Exception as e:
            print(f"Raw reading error: {e}")

if __name__ == "__main__":
    import os
    main()