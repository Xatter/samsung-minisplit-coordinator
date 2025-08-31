#!/bin/bash
# Install systemd service for auto-start on boot

echo "Installing Matter Server systemd service..."

# Copy service file to systemd directory
sudo cp matter-server.service /etc/systemd/system/

# Reload systemd to recognize new service
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable matter-server.service

# Start the service now
sudo systemctl start matter-server.service

# Check status
sudo systemctl status matter-server.service

echo ""
echo "Service installed and started!"
echo "The Matter Server will now automatically start on boot."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status matter-server   # Check status"
echo "  sudo systemctl stop matter-server     # Stop service"
echo "  sudo systemctl start matter-server    # Start service"
echo "  sudo systemctl restart matter-server  # Restart service"
echo "  sudo journalctl -u matter-server -f   # View logs"