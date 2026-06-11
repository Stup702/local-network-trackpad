import os
import sys
import socket
import argparse
import random
import string
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import qrcode

# Setup argument parser
parser = argparse.ArgumentParser(description="NetTrackpad: Secure Local Mouse Controller")
parser.add_argument("--host", default="0.0.0.0", help="Host IP to bind the server (default: 0.0.0.0)")
parser.add_argument("--port", type=int, default=8000, help="Port to run the server (default: 8000)")
parser.add_argument("--password", default=None, help="Password for clients to connect (default: random 4-digit code)")
args = parser.parse_args()

# Generate password if not provided
if args.password is None:
    EXPECTED_PASSWORD = "".join(random.choices(string.digits, k=4))
else:
    EXPECTED_PASSWORD = args.password

# Initialize evdev virtual mouse
try:
    import evdev
    from evdev import UInput, ecodes as e
    
    capabilities = {
        e.EV_KEY: [e.BTN_LEFT, e.BTN_RIGHT, e.BTN_MIDDLE],
        e.EV_REL: [e.REL_X, e.REL_Y, e.REL_WHEEL]
    }
    ui = UInput(capabilities, name="NetTrackpad-Virtual-Mouse")
    uinput_available = True
except PermissionError:
    print("\n" + "="*80)
    print(" ERROR: Permission Denied to /dev/uinput.")
    print("Please grant permissions to /dev/uinput to run without root:")
    print("  1. Create a group: sudo groupadd -f uinput")
    print("  2. Add user:       sudo usermod -aG uinput $USER")
    print("  3. Create rule:    echo 'KERNEL==\"uinput\", MODE=\"0660\", GROUP=\"uinput\", OPTIONS+=\"static_node=uinput\"' | sudo tee /etc/udev/rules.d/99-uinput.rules")
    print("  4. Load module:    echo 'uinput' | sudo tee /etc/modules-load.d/uinput.conf && sudo modprobe uinput")
    print("  5. Reload rules:   sudo udevadm control --reload-rules && sudo udevadm trigger")
    print("  6. Log out and log back in to apply group changes.")
    print("="*80 + "\n")
    sys.exit(1)
except Exception as err:
    print(f" Error initializing virtual input device: {err}")
    sys.exit(1)

# Helper function to get local IP address
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to an external address (doesn't send packets)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

# Initialize FastAPI App
app = FastAPI(title="NetTrackpad Server")

# Serve index.html at root
@app.get("/")
async def read_root():
    index_path = os.path.join(os.path.dirname(__file__), "static", "index.html")
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="static/index.html not found")
    return FileResponse(index_path)

# Mount the static directory to serve other assets (style.css, app.js)
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, password: str = Query(...)):
    if password != EXPECTED_PASSWORD:
        # Close connection with custom code 4001 (Unauthorized)
        await websocket.close(code=4001)
        return
        
    await websocket.accept()
    print(f"Client connected from {websocket.client.host}")
    
    scroll_accumulator = 0.0
    
    try:
        while True:
            # Receive message
            data_str = await websocket.receive_text()
            try:
                data = json.loads(data_str)
            except json.JSONDecodeError:
                continue
                
            event_type = data.get("type")
            
            if event_type == "move":
                dx = int(float(data.get("dx", 0)))
                dy = int(float(data.get("dy", 0)))
                if dx != 0 or dy != 0:
                    ui.write(e.EV_REL, e.REL_X, dx)
                    ui.write(e.EV_REL, e.REL_Y, dy)
                    ui.syn()
                    
            elif event_type == "click":
                button = data.get("button")
                action = data.get("action")
                
                btn_code = None
                if button == "left":
                    btn_code = e.BTN_LEFT
                elif button == "right":
                    btn_code = e.BTN_RIGHT
                elif button == "middle":
                    btn_code = e.BTN_MIDDLE
                    
                if btn_code is not None:
                    if action == "down":
                        ui.write(e.EV_KEY, btn_code, 1)
                        ui.syn()
                    elif action == "up":
                        ui.write(e.EV_KEY, btn_code, 0)
                        ui.syn()
                    elif action == "click":
                        ui.write(e.EV_KEY, btn_code, 1)
                        ui.syn()
                        ui.write(e.EV_KEY, btn_code, 0)
                        ui.syn()
                        
            elif event_type == "scroll":
                dy = float(data.get("dy", 0))
                scroll_accumulator += dy
                threshold = 12.0  # pixels per scroll tick
                if abs(scroll_accumulator) >= threshold:
                    ticks = int(scroll_accumulator / threshold)
                    ui.write(e.EV_REL, e.REL_WHEEL, ticks)
                    ui.syn()
                    scroll_accumulator -= ticks * threshold
                    
    except WebSocketDisconnect:
        print(f"Client disconnected from {websocket.client.host}")
    except Exception as e_err:
        print(f"Error in connection handler: {e_err}")

# Print startup information
def print_startup_banner(ip, port, pwd):
    url = f"http://{ip}:{port}"
    print("\n" + "═"*60)
    print(" NetTrackpad - Local Network Mouse Server  🚀".center(60))
    print("═"*60)
    print(f" Local Link:    \033[1;36m{url}\033[0m")
    print(f" Access Password: \033[1;33m{pwd}\033[0m")
    print("═"*60)
    print("  Scan the QR code below to open on your phone:")
    print("="*60)
    
    # Generate compact ASCII QR Code
    qr = qrcode.QRCode(version=1, box_size=1, border=1)
    qr.add_data(url)
    qr.make(fit=True)
    qr.print_ascii(invert=True)
    print("="*60)
    print("  Press Ctrl+C to stop the server\n")

if __name__ == "__main__":
    local_ip = get_local_ip()
    print_startup_banner(local_ip, args.port, EXPECTED_PASSWORD)
    
    # Run the Uvicorn server
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
