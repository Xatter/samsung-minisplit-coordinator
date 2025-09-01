import express from 'express';
import cors from 'cors';
import { SmartThingsOAuth } from '../smartthings/oauth';
import { SmartThingsDeviceManager } from '../smartthings/device-manager';

const app = express();
const PORT = 3001; // Different port for API

// Enable CORS for React frontend
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.json());

// Initialize SmartThings
const oauth = new SmartThingsOAuth();
const deviceManager = new SmartThingsDeviceManager(oauth);

// API Routes
app.get('/api/devices', async (req, res) => {
    try {
        console.log('GET /api/devices called');
        const devices = await deviceManager.getDevices();
        res.json(devices);
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

app.get('/api/device/:deviceId/status', async (req, res) => {
    try {
        const { deviceId } = req.params;
        console.log('GET /api/device/' + deviceId + '/status called');
        const status = await deviceManager.getDeviceStatus(deviceId);
        res.json(status);
    } catch (error) {
        console.error('Error fetching device status:', error);
        res.status(500).json({ error: 'Failed to fetch device status' });
    }
});

app.post('/api/device/:deviceId/control/power', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { state } = req.body;
        console.log('POST /api/device/' + deviceId + '/control/power called with state:', state);
        await deviceManager.switchDevice(deviceId, state);
        res.json({ success: true });
    } catch (error) {
        console.error('Error controlling device power:', error);
        res.status(500).json({ error: 'Failed to control device power' });
    }
});

app.post('/api/device/:deviceId/control/mode', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { mode } = req.body;
        console.log('POST /api/device/' + deviceId + '/control/mode called with mode:', mode);
        
        const devices = await deviceManager.getDevices();
        const device = devices.find(d => d.deviceId === deviceId);
        
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        const hasAirConditioner = device.capabilities.some(c => c.id === 'airConditionerMode');
        
        if (hasAirConditioner) {
            await deviceManager.executeDeviceCommand(deviceId, 'airConditionerMode', 'setAirConditionerMode', [mode]);
        } else {
            await deviceManager.setThermostatMode(deviceId, mode);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error setting device mode:', error);
        res.status(500).json({ error: 'Failed to set device mode' });
    }
});

app.post('/api/device/:deviceId/control/temperature', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { temperature } = req.body;
        console.log('POST /api/device/' + deviceId + '/control/temperature called with temp:', temperature);
        await deviceManager.setThermostatTemperature(deviceId, temperature);
        res.json({ success: true });
    } catch (error) {
        console.error('Error setting temperature:', error);
        res.status(500).json({ error: 'Failed to set temperature' });
    }
});

app.post('/api/device/:deviceId/control/command', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { capability, command, arguments: args } = req.body;
        console.log('POST /api/device/' + deviceId + '/control/command called');
        await deviceManager.executeDeviceCommand(deviceId, capability, command, args || []);
        res.json({ success: true });
    } catch (error) {
        console.error('Error executing command:', error);
        res.status(500).json({ error: 'Failed to execute command' });
    }
});

// Start server
export async function startApiServer() {
    try {
        // Check if authenticated
        if (oauth.isAuthenticated()) {
            console.log('SmartThings authentication available');
        } else {
            console.log('Warning: SmartThings not authenticated - API may not work');
        }
        
        app.listen(PORT, () => {
            console.log(`API server running on http://localhost:${PORT}`);
            console.log('API endpoints:');
            console.log('  GET  /api/devices');
            console.log('  GET  /api/device/:deviceId/status');
            console.log('  POST /api/device/:deviceId/control/power');
            console.log('  POST /api/device/:deviceId/control/mode');
            console.log('  POST /api/device/:deviceId/control/temperature');
            console.log('  POST /api/device/:deviceId/control/command');
        });
    } catch (error) {
        console.error('Failed to start API server:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    startApiServer();
}