"use strict";

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const ZoneFunctions = require('../src/zone-functions');

// Mock denon-client
const mockDenonClient = {
    getPower: jest.fn(),
    setPower: jest.fn(),
    getZone2: jest.fn(),
    setZone2: jest.fn()
};

// Mock denon-client module
jest.mock('denon-client', () => ({
    Options: {
        Zone2Options: {
            On: 'Z2ON',
            Off: 'Z2OFF'
        }
    }
}));

describe('ZoneFunctions', () => {
    let zoneFunctions;
    let mockSettings;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Default mock settings
        mockSettings = {
            zone: "main",
            setsource: "CBL/SAT",
            powerOffBothZones: true
        };

        zoneFunctions = new ZoneFunctions(mockDenonClient, mockSettings);
    });

    describe('getPowerForZone', () => {
        it('should get power from main zone when zone is "main"', async () => {
            mockSettings.zone = "main";
            mockDenonClient.getPower.mockResolvedValue("ON");

            const result = await zoneFunctions.getPowerForZone();

            expect(mockDenonClient.getPower).toHaveBeenCalledTimes(1);
            expect(mockDenonClient.getZone2).not.toHaveBeenCalled();
            expect(result).toBe("ON");
        });

        it('should get power from zone2 when zone is "zone2"', async () => {
            mockSettings.zone = "zone2";
            mockDenonClient.getZone2.mockResolvedValue("Z2ON");

            const result = await zoneFunctions.getPowerForZone();

            expect(mockDenonClient.getZone2).toHaveBeenCalledTimes(1);
            expect(mockDenonClient.getPower).not.toHaveBeenCalled();
            expect(result).toBe("ON");
        });

        it('should return "STANDBY" when zone2 is off', async () => {
            mockSettings.zone = "zone2";
            mockDenonClient.getZone2.mockResolvedValue("Z2OFF");

            const result = await zoneFunctions.getPowerForZone();

            expect(result).toBe("STANDBY");
        });

        it('should handle main zone standby state', async () => {
            mockSettings.zone = "main";
            mockDenonClient.getPower.mockResolvedValue("STANDBY");

            const result = await zoneFunctions.getPowerForZone();

            expect(result).toBe("STANDBY");
        });
    });

    describe('setPowerForZone', () => {
        it('should set main zone power when zone is "main"', async () => {
            mockSettings.zone = "main";
            mockDenonClient.setPower.mockResolvedValue();

            await zoneFunctions.setPowerForZone("ON");

            expect(mockDenonClient.setPower).toHaveBeenCalledWith("ON");
            expect(mockDenonClient.setZone2).not.toHaveBeenCalled();
        });

        it('should set zone2 power when zone is "zone2"', async () => {
            mockSettings.zone = "zone2";
            mockDenonClient.setZone2.mockResolvedValue();

            await zoneFunctions.setPowerForZone("ON");

            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2ON");
            expect(mockDenonClient.setPower).not.toHaveBeenCalled();
        });

        it('should set zone2 to off when powering off zone2', async () => {
            mockSettings.zone = "zone2";
            mockDenonClient.setZone2.mockResolvedValue();

            await zoneFunctions.setPowerForZone("STANDBY");

            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
        });

        it('should handle main zone standby', async () => {
            mockSettings.zone = "main";
            mockDenonClient.setPower.mockResolvedValue();

            await zoneFunctions.setPowerForZone("STANDBY");

            expect(mockDenonClient.setPower).toHaveBeenCalledWith("STANDBY");
        });
    });

    describe('setPowerBothZones', () => {
        it('should power off both zones when powerOffBothZones is true and powering off', async () => {
            mockSettings.powerOffBothZones = true;
            mockDenonClient.setPower.mockResolvedValue();
            mockDenonClient.setZone2.mockResolvedValue();

            await zoneFunctions.setPowerBothZones("STANDBY");

            expect(mockDenonClient.setPower).toHaveBeenCalledWith("STANDBY");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
        });

        it('should use zone-specific power when powerOffBothZones is false', async () => {
            mockSettings.powerOffBothZones = false;
            mockSettings.zone = "zone2";
            mockDenonClient.setZone2.mockResolvedValue();

            await zoneFunctions.setPowerBothZones("STANDBY");

            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
            expect(mockDenonClient.setPower).not.toHaveBeenCalled();
        });

        it('should use zone-specific power when powering on', async () => {
            mockSettings.powerOffBothZones = true;
            mockSettings.zone = "main";
            mockDenonClient.setPower.mockResolvedValue();

            await zoneFunctions.setPowerBothZones("ON");

            expect(mockDenonClient.setPower).toHaveBeenCalledWith("ON");
            expect(mockDenonClient.setZone2).not.toHaveBeenCalled();
        });

        it('should handle errors when powering off both zones', async () => {
            mockSettings.powerOffBothZones = true;
            mockDenonClient.setPower.mockRejectedValue(new Error("Main zone error"));
            mockDenonClient.setZone2.mockResolvedValue();

            await expect(zoneFunctions.setPowerBothZones("STANDBY")).rejects.toThrow("Main zone error");
        });

        it('should handle partial failures when powering off both zones', async () => {
            mockSettings.powerOffBothZones = true;
            mockDenonClient.setPower.mockResolvedValue();
            mockDenonClient.setZone2.mockRejectedValue(new Error("Zone2 error"));

            await expect(zoneFunctions.setPowerBothZones("STANDBY")).rejects.toThrow("Zone2 error");
        });
    });

    describe('checkStatus', () => {
        it('should return "selected" when power is ON and input matches', () => {
            const result = zoneFunctions.checkStatus("ON", "CBL/SAT");
            expect(result).toBe("selected");
        });

        it('should return "deselected" when power is ON but input does not match', () => {
            const result = zoneFunctions.checkStatus("ON", "DVD");
            expect(result).toBe("deselected");
        });

        it('should return "standby" when power is STANDBY', () => {
            const result = zoneFunctions.checkStatus("STANDBY", "CBL/SAT");
            expect(result).toBe("standby");
        });

        it('should return "standby" when power is STANDBY regardless of input', () => {
            const result = zoneFunctions.checkStatus("STANDBY", "DVD");
            expect(result).toBe("standby");
        });

        it('should handle case sensitivity', () => {
            const result = zoneFunctions.checkStatus("on", "CBL/SAT");
            expect(result).toBe("standby"); // "on" !== "ON", so power is considered off
        });
    });

    describe('getDisplayName', () => {
        it('should return "Main Zone" for main zone', () => {
            mockSettings.zone = "main";
            const result = zoneFunctions.getDisplayName();
            expect(result).toBe("Main Zone");
        });

        it('should return "Zone 2" for zone2', () => {
            mockSettings.zone = "zone2";
            const result = zoneFunctions.getDisplayName();
            expect(result).toBe("Zone 2");
        });

        it('should default to "Main Zone" for unknown zones', () => {
            mockSettings.zone = "unknown";
            const result = zoneFunctions.getDisplayName();
            expect(result).toBe("Main Zone");
        });
    });

    describe('isVolumeControlSupported', () => {
        it('should return true for main zone', () => {
            mockSettings.zone = "main";
            const result = zoneFunctions.isVolumeControlSupported();
            expect(result).toBe(true);
        });

        it('should return false for zone2', () => {
            mockSettings.zone = "zone2";
            const result = zoneFunctions.isVolumeControlSupported();
            expect(result).toBe(false);
        });

        it('should return false for unknown zones', () => {
            mockSettings.zone = "unknown";
            const result = zoneFunctions.isVolumeControlSupported();
            expect(result).toBe(false);
        });
    });

    describe('updateSettings', () => {
        it('should update settings correctly', () => {
            const newSettings = {
                zone: "zone2",
                setsource: "GAME",
                powerOffBothZones: false
            };

            zoneFunctions.updateSettings(newSettings);

            expect(zoneFunctions.settings).toEqual(newSettings);
            expect(zoneFunctions.getDisplayName()).toBe("Zone 2");
            expect(zoneFunctions.isVolumeControlSupported()).toBe(false);
        });

        it('should maintain reference to new settings object', () => {
            const newSettings = {
                zone: "main",
                setsource: "CD",
                powerOffBothZones: true
            };

            zoneFunctions.updateSettings(newSettings);
            newSettings.zone = "zone2"; // Modify original object

            expect(zoneFunctions.settings.zone).toBe("zone2");
        });
    });

    describe('integration scenarios', () => {
        it('should handle main zone power cycle correctly', async () => {
            mockSettings.zone = "main";
            mockSettings.powerOffBothZones = false;
            
            mockDenonClient.getPower.mockResolvedValue("STANDBY");
            mockDenonClient.setPower.mockResolvedValue();

            const powerState = await zoneFunctions.getPowerForZone();
            expect(powerState).toBe("STANDBY");

            await zoneFunctions.setPowerBothZones("ON");
            expect(mockDenonClient.setPower).toHaveBeenCalledWith("ON");
        });

        it('should handle zone2 power cycle correctly', async () => {
            mockSettings.zone = "zone2";
            mockSettings.powerOffBothZones = false;
            
            mockDenonClient.getZone2.mockResolvedValue("Z2OFF");
            mockDenonClient.setZone2.mockResolvedValue();

            const powerState = await zoneFunctions.getPowerForZone();
            expect(powerState).toBe("STANDBY");

            await zoneFunctions.setPowerBothZones("ON");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2ON");
        });

        it('should handle dual zone power off scenario', async () => {
            mockSettings.zone = "main";
            mockSettings.powerOffBothZones = true;
            
            mockDenonClient.setPower.mockResolvedValue();
            mockDenonClient.setZone2.mockResolvedValue();

            await zoneFunctions.setPowerBothZones("STANDBY");

            expect(mockDenonClient.setPower).toHaveBeenCalledWith("STANDBY");
            expect(mockDenonClient.setZone2).toHaveBeenCalledWith("Z2OFF");
        });
    });
});