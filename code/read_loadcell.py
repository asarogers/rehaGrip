import RPi.GPIO as GPIO
from hx711 import HX711

DT_PIN = 5    # GPIO5
SCK_PIN = 6   # GPIO6

hx = HX711(DT_PIN, SCK_PIN)
hx.set_reading_format("MSB", "MSB")
hx.set_reference_unit(1)  # calibrate this value later

hx.reset()
hx.tare()  # zero the scale

print("Place weight now...")
while True:
    try:
        weight = hx.get_weight(5)
        print(f"Weight: {weight} g")
        hx.power_down()
        hx.power_up()
    except (KeyboardInterrupt, SystemExit):
        GPIO.cleanup()
        break
