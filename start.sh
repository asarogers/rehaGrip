#!/bin/bash

# escape on error
set -e

# create venv if it doesn't exist
if [ ! -d "code/myenv" ]; then
  python3 -m venv code/myenv
fi

# activate Python virtual environment
source code/myenv/bin/activate

# install/confirm Python dependencies
pip install --upgrade pip
pip install -r code/requirements.txt

# get local IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')

# move into frontend folder
cd code/frontend

# start frontend + backend
npm start
