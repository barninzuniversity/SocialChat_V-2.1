#!/bin/bash
# Development server script for running with WebSocket support

echo "Starting development server with WebSocket support..."
echo "Make sure you have installed: pip install daphne channels channels-redis"

# Set the development port
PORT=${PORT:-8000}
echo "Using port: $PORT"

# Run Daphne ASGI server
daphne -b 0.0.0.0 -p $PORT chat_project.asgi:application 