#!/bin/bash

# Exit on error
set -e

# Activate Python virtual environment
source code/myenv/bin/activate

# Move into frontend folder
cd code/frontend

# Start frontend
npm start
