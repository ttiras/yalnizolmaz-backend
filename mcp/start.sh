#!/bin/bash

# Nhost MCP Server Start Script
set -e

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the mcp directory
cd "$DIR"

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
fi

# Build the project if dist doesn't exist or src is newer
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "Building project..."
    pnpm run build
fi

# Start the MCP server
echo "Starting Nhost MCP Server..."
exec node dist/index.js
