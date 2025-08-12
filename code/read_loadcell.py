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
    
    def get_force_analysis(self, times=5):
        """
        Get comprehensive force analysis with compression/tension breakdown
        Returns: dict with force measurements and analysis
        """
        weight_kg = self.get_weight(times)
        force_n = weight_kg * 9.81
        
        # Determine force type and magnitude
        if weight_kg > 0.05:  # Threshold to avoid noise
            force_type = "COMPRESSION"
            force_magnitude = abs(weight_kg)
            force_magnitude_n = abs(force_n)
        elif weight_kg < -0.05:  # Threshold to avoid noise
            force_type = "TENSION" 
            force_magnitude = abs(weight_kg)
            force_magnitude_n = abs(force_n)
        else:
            force_type = "NEUTRAL"
            force_magnitude = 0.0
            force_magnitude_n = 0.0
        
        return {
            'raw_weight_kg': weight_kg,
            'raw_force_n': force_n,
            'force_type': force_type,
            'magnitude_kg': force_magnitude,
            'magnitude_n': force_magnitude_n,
            'compression_kg': weight_kg if weight_kg > 0 else 0.0,
            'tension_kg': abs(weight_kg) if weight_kg < 0 else 0.0,
            'compression_n': force_n if force_n > 0 else 0.0,
            'tension_n': abs(force_n) if force_n < 0 else 0.0
        }
    
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
        print("Note: This load cell can measure both compression (pushing) and tension (pulling)")
        
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
        
        print("\nCalibration type:")
        print("1. Compression calibration (weight pushing down)")
        print("2. Tension calibration (weight pulling down)")
        
        while True:
            cal_type = input("Select calibration type (1 or 2): ").strip()
            if cal_type in ['1', '2']:
                break
            print("Please enter 1 or 2")
        
        # Perform calibration based on type
        print("\nRemove all weight and press Enter to tare...")
        input()
        self.hx711.tare()
        
        if cal_type == '1':
            print(f"Place {cal_weight}kg weight ON TOP (compression) and press Enter...")
            input()
            reading = self.hx711.read_average(20)
            self.hx711.scale = cal_weight / (reading - self.hx711.offset)
        else:
            print(f"Hang {cal_weight}kg weight BELOW (tension) and press Enter...")
            input()
            reading = self.hx711.read_average(20)
            # For tension, the reading should be negative, so we make scale negative
            self.hx711.scale = -cal_weight / (reading - self.hx711.offset)
        
        print(f"Calibrated with scale factor: {self.hx711.scale}")
        print("Calibration complete!")
        
        # Test both compression and tension
        print("\n=== Testing Calibration ===")
        print("Test the calibration:")
        print("1. Apply compression force (push down)")
        print("2. Apply tension force (pull down)")  
        print("3. Remove all force")
        input("Press Enter when ready to see readings...")
        
        for i in range(5):
            analysis = self.hx711.get_force_analysis(3)
            print(f"Test {i+1}: {analysis['force_type']} - {analysis['magnitude_kg']:.3f}kg / {analysis['magnitude_n']:.2f}N")
            time.sleep(1)
    
    def monitor_continuous(self):
        """Continuously monitor load cell readings with compression/tension analysis"""
        print("\n=== Continuous Force Monitoring ===")
        print("Press Ctrl+C to stop")
        print("DYMH-103 Load Cell - Compression (+) / Tension (-)")
        print("-" * 80)
        print(f"{'Time':<8} | {'Type':<11} | {'Magnitude':<12} | {'Compression':<12} | {'Tension':<12} | {'Raw':<8}")
        print(f"{'(s)':<8} | {'':<11} | {'kg / N':<12} | {'kg / N':<12} | {'kg / N':<12} | {'Value':<8}")
        print("-" * 80)
        
        start_time = time.time()
        try:
            while True:
                analysis = self.hx711.get_force_analysis(3)
                current_time = time.time() - start_time
                
                # Format the display
                magnitude_str = f"{analysis['magnitude_kg']:.3f} / {analysis['magnitude_n']:.1f}"
                compression_str = f"{analysis['compression_kg']:.3f} / {analysis['compression_n']:.1f}"
                tension_str = f"{analysis['tension_kg']:.3f} / {analysis['tension_n']:.1f}"
                raw_reading = self.hx711.read()
                
                print(f"{current_time:8.1f} | {analysis['force_type']:<11} | {magnitude_str:<12} | {compression_str:<12} | {tension_str:<12} | {raw_reading:<8d}")
                time.sleep(0.5)
                
        except KeyboardInterrupt:
            print("\nStopping monitor...")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            pass  # Cleanup handled by main
    
    def single_reading(self):
        """Take a single comprehensive reading with compression/tension analysis"""
        print("\n=== Single Force Reading ===")
        print("Taking measurement...")
        
        analysis = self.hx711.get_force_analysis(times=10)
        raw = self.hx711.read_average(10)
        
        print(f"\nDetailed Force Analysis:")
        print(f"{'='*40}")
        print(f"Raw sensor value: {raw:.0f}")
        print(f"Raw weight: {analysis['raw_weight_kg']:+.3f} kg")
        print(f"Raw force:  {analysis['raw_force_n']:+.2f} N")
        print(f"")
        print(f"Force Type: {analysis['force_type']}")
        print(f"Magnitude:  {analysis['magnitude_kg']:.3f} kg / {analysis['magnitude_n']:.2f} N")
        print(f"")
        print(f"Breakdown:")
        print(f"  Compression: {analysis['compression_kg']:.3f} kg / {analysis['compression_n']:.2f} N")
        print(f"  Tension:     {analysis['tension_kg']:.3f} kg / {analysis['tension_n']:.2f} N")
        
        # Interpretation
        print(f"\nInterpretation:")
        if analysis['force_type'] == 'COMPRESSION':
            print(f"  → Load cell is being COMPRESSED (pushed/squeezed)")
            print(f"  → Force magnitude: {analysis['magnitude_kg']:.3f} kg")
        elif analysis['force_type'] == 'TENSION':
            print(f"  → Load cell is being stretched in TENSION (pulled)")
            print(f"  → Force magnitude: {analysis['magnitude_kg']:.3f} kg")
        else:
            print(f"  → No significant force detected (within noise threshold)")
        
        return analysis


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
            analysis = self.hx711.get_force_analysis(3)
            print(f"Current reading: {analysis['force_type']} - {analysis['magnitude_kg']:.3f}kg")
            print(f"Raw value: {self.hx711.read()}")
        except Exception as e:
            print(f"Reading error: {e}")
        
        print(f"\nForce Analysis:")
        print(f"  Compression threshold: >0.05 kg")
        print(f"  Tension threshold: <-0.05 kg")
        print(f"  Neutral zone: ±0.05 kg")

if __name__ == "__main__":
    import os
    main()