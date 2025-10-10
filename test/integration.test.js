"use strict";

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const ZoneFunctions = require('../src/zone-functions');

// Mock denon-client
jest.mock('denon-client', () => ({
    Options: {
        Zone2Options: {
            On: 'Z2ON',
            Off: 'Z2OFF'
        }
    }
}));

describe('Zone Integration Tests', () => {
    let mockDenonClient;
    let zoneFunctions;

    beforeEach(() => {
        mockDenonClient = {
            getPower: jest.fn(),
            setPower: jest.fn(),
            getZone2: jest.fn(),
            setZone2: jest.fn(),
            getInput: jest.fn(),
            setInput: jest.fn()
        };
    });

    describe('Main Zone Control Scenarios', () => {
        beforeEach(() => {
            const settings = {
                zone: "main",
                setsource: "CBL/SAT",
                powerOffBothZones: false
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);
        });

        it('should handle main zone power on sequence', async () => {
            // Initial state: receiver is off
            mockDenonClient.getPower.mockResolvedValue("STANDBY");
            mockDenonClient.setPower.mockResolvedValue();

            // Check initial state
            const initialPower = await zoneFunctions.getPowerForZone();
            expect(initialPower).toBe("STANDBY");

            // Power on
            await zoneFunctions.setPowerBothZones("ON");
            expect(mockDenonClient.setPower).toHaveBeenCalledWith("ON");

            // Verify status calculation
            const status = zoneFunctions.checkStatus("ON", "CBL/SAT");
            expect(status).toBe("selected");
        });

        it('should handle main zone input switching when powered on', async () => {
            mockDenonClient.getPower.mockResolvedValue("ON");

            const currentPower = await zoneFunctions.getPowerForZone();
            expect(currentPower).toBe("ON");

            // Test different input scenarios
            expect(zoneFunctions.checkStatus("ON", "CBL/SAT")).toBe("selected");
            expect(zoneFunctions.checkStatus("ON", "DVD")).toBe("deselected");
        });

        it('should handle main zone standby correctly', async () => {
            mockDenonClient.getPower.mockResolvedValue("ON");
            mockDenonClient.setPower.mockResolvedValue();

            await zoneFunctions.setPowerBothZones("STANDBY");
            expect(mockDenonClient.setPower).toHaveBeenCalledWith("STANDBY");
            expect(mockDenonClient.setZone2).not.toHaveBeenCalled();
        });
    });

    describe('Zone 2 Control Scenarios', () => {
        beforeEach(() => {
            const settings = {
                zone: "zone2",
                setsource: "GAME",
                powerOffBothZones: false
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);
        });

        it('should handle zone2 power on sequence', async () => {
            // Initial state: zone2 is off
            mockDenonClient.getZone2.mockResolvedValue("Z2OFF");
            mockDenonClient.setZone2.mockResolvedValue();

            // Check initial state
            const initialPower = await zoneFunctions.getPowerForZone();
            expect(initialPower).toBe("STANDBY");

            // Power on zone2
            await zoneFunctions.setPowerBothZones("ON");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2ON");

            // Verify status calculation works for zone2
            const status = zoneFunctions.checkStatus("ON", "GAME");
            expect(status).toBe("selected");
        });

        it('should handle zone2 power cycle', async () => {
            // Start with zone2 on
            mockDenonClient.getZone2.mockResolvedValue("Z2ON");
            mockDenonClient.setZone2.mockResolvedValue();

            const currentPower = await zoneFunctions.getPowerForZone();
            expect(currentPower).toBe("ON");

            // Power off zone2
            await zoneFunctions.setPowerBothZones("STANDBY");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
        });

        it('should indicate volume control is not supported for zone2', () => {
            expect(zoneFunctions.isVolumeControlSupported()).toBe(false);
            expect(zoneFunctions.getDisplayName()).toBe("Zone 2");
        });
    });

    describe('Dual Zone Power Off Scenarios', () => {
        it('should power off both zones when powerOffBothZones is enabled', async () => {
            const settings = {
                zone: "main",
                setsource: "CBL/SAT",
                powerOffBothZones: true
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);

            mockDenonClient.setPower.mockResolvedValue();
            mockDenonClient.setZone2.mockResolvedValue();

            await zoneFunctions.setPowerBothZones("STANDBY");

            expect(mockDenonClient.setPower).toHaveBeenCalledWith("STANDBY");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
        });

        it('should power off both zones even when zone2 is selected', async () => {
            const settings = {
                zone: "zone2",
                setsource: "GAME",
                powerOffBothZones: true
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);

            mockDenonClient.setPower.mockResolvedValue();
            mockDenonClient.setZone2.mockResolvedValue();

            await zoneFunctions.setPowerBothZones("STANDBY");

            // Both zones should be powered off regardless of selected zone
            expect(mockDenonClient.setPower).toHaveBeenCalledWith("STANDBY");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
        });

        it('should handle partial failures when powering off both zones', async () => {
            const settings = {
                zone: "main",
                setsource: "CBL/SAT",
                powerOffBothZones: true
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);

            // Main zone fails, zone2 succeeds
            mockDenonClient.setPower.mockRejectedValue(new Error("Main zone communication error"));
            mockDenonClient.setZone2.mockResolvedValue();

            await expect(zoneFunctions.setPowerBothZones("STANDBY"))
                .rejects
                .toThrow("Main zone communication error");
        });
    });

    describe('Settings Update Scenarios', () => {
        it('should handle zone switching at runtime', async () => {
            const initialSettings = {
                zone: "main",
                setsource: "CBL/SAT",
                powerOffBothZones: true
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, initialSettings);

            // Initially configured for main zone
            expect(zoneFunctions.getDisplayName()).toBe("Main Zone");
            expect(zoneFunctions.isVolumeControlSupported()).toBe(true);

            // Switch to zone2
            const newSettings = {
                zone: "zone2",
                setsource: "GAME",
                powerOffBothZones: false
            };
            zoneFunctions.updateSettings(newSettings);

            // Verify zone2 configuration
            expect(zoneFunctions.getDisplayName()).toBe("Zone 2");
            expect(zoneFunctions.isVolumeControlSupported()).toBe(false);

            // Test power control with new settings
            mockDenonClient.getZone2.mockResolvedValue("Z2OFF");
            const power = await zoneFunctions.getPowerForZone();
            expect(power).toBe("STANDBY");
        });

        it('should handle powerOffBothZones setting changes', async () => {
            const settings = {
                zone: "main",
                setsource: "CBL/SAT",
                powerOffBothZones: false
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);

            mockDenonClient.setPower.mockResolvedValue();

            // Initially only affects selected zone
            await zoneFunctions.setPowerBothZones("STANDBY");
            expect(mockDenonClient.setPower).toHaveBeenCalledWith("STANDBY");
            expect(mockDenonClient.setZone2).not.toHaveBeenCalled();

            // Enable dual zone power off
            settings.powerOffBothZones = true;
            mockDenonClient.setZone2.mockResolvedValue();

            await zoneFunctions.setPowerBothZones("STANDBY");
            expect(mockDenonClient.setPower).toHaveBeenCalledTimes(2);
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
        });
    });

    describe('Error Handling Scenarios', () => {
        beforeEach(() => {
            const settings = {
                zone: "main",
                setsource: "CBL/SAT",
                powerOffBothZones: true
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);
        });

        it('should handle denon client connection errors', async () => {
            mockDenonClient.getPower.mockRejectedValue(new Error("Connection timeout"));

            await expect(zoneFunctions.getPowerForZone())
                .rejects
                .toThrow("Connection timeout");
        });

        it('should handle power control errors', async () => {
            mockDenonClient.setPower.mockRejectedValue(new Error("Command rejected"));

            await expect(zoneFunctions.setPowerForZone("ON"))
                .rejects
                .toThrow("Command rejected");
        });

        it('should handle zone2 communication errors', async () => {
            const settings = {
                zone: "zone2",
                setsource: "GAME",
                powerOffBothZones: false
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);

            mockDenonClient.getZone2.mockRejectedValue(new Error("Zone2 not available"));

            await expect(zoneFunctions.getPowerForZone())
                .rejects
                .toThrow("Zone2 not available");
        });
    });

    describe('Real-world Usage Scenarios', () => {
        it('should simulate typical user workflow - main zone with dual power off', async () => {
            const settings = {
                zone: "main",
                setsource: "CBL/SAT",
                powerOffBothZones: true
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);

            // 1. Check initial state
            mockDenonClient.getPower.mockResolvedValue("STANDBY");
            const initialState = await zoneFunctions.getPowerForZone();
            expect(initialState).toBe("STANDBY");

            // 2. Power on for listening
            mockDenonClient.setPower.mockResolvedValue();
            await zoneFunctions.setPowerForZone("ON");
            expect(mockDenonClient.setPower).toHaveBeenCalledWith("ON");

            // 3. Check status with correct input
            const selectedStatus = zoneFunctions.checkStatus("ON", "CBL/SAT");
            expect(selectedStatus).toBe("selected");

            // 4. Power off - should turn off both zones
            mockDenonClient.setZone2.mockResolvedValue();
            await zoneFunctions.setPowerBothZones("STANDBY");
            expect(mockDenonClient.setPower).toHaveBeenCalledWith("STANDBY");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
        });

        it('should simulate zone2 control scenario', async () => {
            const settings = {
                zone: "zone2",
                setsource: "NET/USB",
                powerOffBothZones: false
            };
            zoneFunctions = new ZoneFunctions(mockDenonClient, settings);

            // 1. Verify zone2 configuration
            expect(zoneFunctions.getDisplayName()).toBe("Zone 2");
            expect(zoneFunctions.isVolumeControlSupported()).toBe(false);

            // 2. Check zone2 state
            mockDenonClient.getZone2.mockResolvedValue("Z2OFF");
            const state = await zoneFunctions.getPowerForZone();
            expect(state).toBe("STANDBY");

            // 3. Power on zone2
            mockDenonClient.setZone2.mockResolvedValue();
            await zoneFunctions.setPowerForZone("ON");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2ON");

            // 4. Power off only affects zone2
            await zoneFunctions.setPowerBothZones("STANDBY");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
            expect(mockDenonClient.setPower).not.toHaveBeenCalled();
        });
    });
});