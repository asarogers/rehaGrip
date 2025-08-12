#!/bin/bash

# Exit on any error
set -e

# Path to venv
VENV_DIR="myenv"

echo "Checking for Python 3..."
if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 is not installed. Please install it first."
    exit 1
fi

# Create virtual environment if missing
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment '$VENV_DIR'..."
    python3 -m venv "$VENV_DIR"
else
    echo "Virtual environment '$VENV_DIR' already exists."
fi

# Activate venv
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
if [ ! -f "requirements.txt" ]; then
    echo "requirements.txt not found in current directory."
    deactivate
    exit 1
fi

echo "Installing dependencies from requirements.txt..."
pip install -r requirements.txt

echo "Environment setup complete!"
