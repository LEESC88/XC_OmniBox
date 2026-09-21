import argparse
import multiprocessing
import os
import sys
from pathlib import Path

# 确保 backend 目录在 sys.path 中
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from app.main import app
import uvicorn

def main():
    multiprocessing.freeze_support()

    parser = argparse.ArgumentParser(description="XC_OmniBox Desktop Backend Service")
    parser.add_argument("--port", type=int, default=18520, help="Port to bind (default: 18520)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    args = parser.parse_args()

    print(f"[XC_OmniBox Backend] Starting on http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")

if __name__ == "__main__":
    main()
