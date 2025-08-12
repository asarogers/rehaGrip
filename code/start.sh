#!/bin/bash
set -Eeuo pipefail

VENV_DIR="myenv"
REQ_FILE="requirements.txt"

# -------- helpers --------
info()  { echo -e "🔹 $*"; }
ok()    { echo -e "✅ $*"; }
warn()  { echo -e "⚠️  $*"; }
err()   { echo -e "❌ $*" >&2; }
trap 'err "Setup failed on line $LINENO"; exit 1' ERR

is_pi() {
  # Detect Raspberry Pi by device tree or CPU model
  if [[ -f /proc/device-tree/model ]] && grep -qi "raspberry pi" /proc/device-tree/model; then
    return 0
  fi
  uname -a | grep -qi "raspberry" && return 0 || return 1
}

# -------- prechecks --------
info "Checking Python 3..."
command -v python3 >/dev/null 2>&1 || { err "Python 3 not found. Install Python 3 and retry."; exit 1; }

info "Checking pip..."
if ! command -v pip3 >/dev/null 2>&1; then
  warn "pip3 not found. Attempting to install python3-pip (sudo may be required)."
  if is_pi; then
    sudo apt update && sudo apt install -y python3-pip
  else
    err "pip3 missing and not on a Pi. Please install pip for Python 3."
    exit 1
  fi
fi

info "Checking venv module..."
if ! python3 -m venv --help >/dev/null 2>&1; then
  warn "python3-venv not available. Installing (sudo may be required)."
  if is_pi; then
    sudo apt update && sudo apt install -y python3-venv
  else
    err "python3-venv missing. Please install it for your OS."
    exit 1
  fi
fi

# -------- Pi-specific OS deps --------
if is_pi; then
  info "Raspberry Pi detected. Installing OS-level GPIO dependency..."
  sudo apt update
  sudo apt install -y python3-rpi.gpio
  ok "OS-level GPIO deps installed."
else
  warn "Not a Raspberry Pi. Will skip installing RPi.GPIO (Python) later."
fi

# -------- create/activate venv --------
if [[ ! -d "$VENV_DIR" ]]; then
  info "Creating virtual environment '$VENV_DIR'..."
  python3 -m venv "$VENV_DIR"
  ok "Virtual environment created."
else
  ok "Virtual environment '$VENV_DIR' already exists."
fi

info "Activating virtual environment..."
# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

info "Upgrading pip..."
python -m pip install --upgrade pip wheel setuptools

# -------- install requirements --------
if [[ ! -f "$REQ_FILE" ]]; then
  err "$REQ_FILE not found in $(pwd)."
  deactivate || true
  exit 1
fi

# Build a temp requirements file that skips Pi-only packages on non-Pi
TMP_REQ="$(mktemp)"
if is_pi; then
  cp "$REQ_FILE" "$TMP_REQ"
else
  # strip RPi.GPIO on non-Pi
  grep -v -E '^RPi\.GPIO(\s|$)' "$REQ_FILE" > "$TMP_REQ"
fi

info "Installing Python dependencies from $REQ_FILE ..."
pip install -r "$TMP_REQ"
rm -f "$TMP_REQ"
ok "Dependencies installed."

# -------- verify key imports --------
info "Verifying critical imports..."
python - <<'PY'
import sys
def check(mod):
    try:
        __import__(mod)
        print(f"[OK] import {mod}")
    except Exception as e:
        print(f"[FAIL] import {mod}: {e}", file=sys.stderr); raise

check("fastapi")
check("uvicorn")
check("dynamixel_sdk")
check("serial")
check("hx711")
try:
    import RPi.GPIO as _  # may fail on non-Pi; that's OK if you're not on a Pi
    print("[OK] import RPi.GPIO")
except Exception as e:
    print(f"[WARN] import RPi.GPIO failed (likely not on a Pi): {e}")
PY
ok "Import check complete."

echo
ok "Environment setup complete!"
echo "Next steps:"
echo "  1) Wire HX711 to Pi: VCC→3.3V, GND→GND, DT→GPIO5, SCK→GPIO6"
echo "  2) Wire DYMH-103: Red→E+, Black→E-, Green→A+, White→A-"
echo "  3) Run your reader:  python3 loadcell_run.py"
