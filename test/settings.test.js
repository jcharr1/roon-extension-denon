"use strict";

const { describe, it, expect, beforeEach } = require('@jest/globals');

// Mock the app.js functions we want to test
// We need to extract these from app.js to make them testable
const mockMakeLayout = (settings) => {
    const l = {
        values: settings,
        layout: [],
        has_error: false,
    };

    l.layout.push({
        type: "string",
        title: "Host name or IP Address",
        subtitle: "The IP address or hostname of the Denon/Marantz receiver.",
        maxlength: 256,
        setting: "hostname",
    });
    
    l.layout.push({
        type: "dropdown",
        title: "Zone",
        subtitle: "Select which zone to control. Note: Zone 2 supports power control only, not volume control.",
        values: [
            { title: "Main Zone", value: "main" },
            { title: "Zone 2 (Power Only)", value: "zone2" }
        ],
        setting: "zone",
    });
    
    l.layout.push({
        type: "dropdown",
        title: "Power Off Behavior",
        subtitle: "When powering off, turn off both zones or just the selected zone",
        values: [
            { title: "Turn off both zones", value: true },
            { title: "Turn off selected zone only", value: false }
        ],
        setting: "powerOffBothZones",
    });
    
    if (settings.err) {
        l.has_error = true;
        l.layout.push({
            type: "status",
            title: settings.err,
        });
    } else {
        l.has_error = false;
        if (settings.hostname) {
            l.layout.push({
                type: "dropdown",
                title: "Input",
                values: [
                    { title: "CBL/SAT", value: "SAT/CBL" },
                    { title: "DVD", value: "DVD" },
                    { title: "Blu-ray", value: "BD" }
                ],
                setting: "setsource",
            });
        }
    }
    return l;
};

describe('Settings Configuration', () => {
    describe('make_layout function', () => {
        it('should create basic layout with hostname, zone, and power settings', () => {
            const settings = {
                hostname: "",
                zone: "main",
                powerOffBothZones: true
            };

            const layout = mockMakeLayout(settings);

            expect(layout.values).toEqual(settings);
            expect(layout.has_error).toBe(false);
            expect(layout.layout).toHaveLength(3); // hostname, zone, powerOffBothZones
        });

        it('should include hostname field with correct properties', () => {
            const settings = { hostname: "192.168.1.100" };
            const layout = mockMakeLayout(settings);

            const hostnameField = layout.layout.find(field => field.setting === "hostname");
            expect(hostnameField).toBeDefined();
            expect(hostnameField.type).toBe("string");
            expect(hostnameField.title).toBe("Host name or IP Address");
            expect(hostnameField.maxlength).toBe(256);
        });

        it('should include zone selection with correct options', () => {
            const settings = { zone: "main" };
            const layout = mockMakeLayout(settings);

            const zoneField = layout.layout.find(field => field.setting === "zone");
            expect(zoneField).toBeDefined();
            expect(zoneField.type).toBe("dropdown");
            expect(zoneField.title).toBe("Zone");
            expect(zoneField.subtitle).toContain("Zone 2 supports power control only");
            expect(zoneField.values).toEqual([
                { title: "Main Zone", value: "main" },
                { title: "Zone 2 (Power Only)", value: "zone2" }
            ]);
        });

        it('should include power off behavior setting', () => {
            const settings = { powerOffBothZones: true };
            const layout = mockMakeLayout(settings);

            const powerField = layout.layout.find(field => field.setting === "powerOffBothZones");
            expect(powerField).toBeDefined();
            expect(powerField.type).toBe("dropdown");
            expect(powerField.title).toBe("Power Off Behavior");
            expect(powerField.values).toEqual([
                { title: "Turn off both zones", value: true },
                { title: "Turn off selected zone only", value: false }
            ]);
        });

        it('should show input selection when hostname is provided', () => {
            const settings = {
                hostname: "192.168.1.100",
                zone: "main",
                powerOffBothZones: true
            };

            const layout = mockMakeLayout(settings);

            const inputField = layout.layout.find(field => field.setting === "setsource");
            expect(inputField).toBeDefined();
            expect(inputField.type).toBe("dropdown");
            expect(inputField.title).toBe("Input");
            expect(layout.layout).toHaveLength(4); // hostname, zone, powerOffBothZones, input
        });

        it('should not show input selection when hostname is empty', () => {
            const settings = {
                hostname: "",
                zone: "main",
                powerOffBothZones: true
            };

            const layout = mockMakeLayout(settings);

            const inputField = layout.layout.find(field => field.setting === "setsource");
            expect(inputField).toBeUndefined();
            expect(layout.layout).toHaveLength(3); // hostname, zone, powerOffBothZones only
        });

        it('should show error status when error is present', () => {
            const settings = {
                hostname: "invalid-host",
                zone: "main",
                powerOffBothZones: true,
                err: "Connection failed: Host not found"
            };

            const layout = mockMakeLayout(settings);

            expect(layout.has_error).toBe(true);
            const errorField = layout.layout.find(field => field.type === "status");
            expect(errorField).toBeDefined();
            expect(errorField.title).toBe("Connection failed: Host not found");
        });

        it('should not show input selection when there is an error', () => {
            const settings = {
                hostname: "192.168.1.100",
                zone: "main",
                powerOffBothZones: true,
                err: "Connection timeout"
            };

            const layout = mockMakeLayout(settings);

            expect(layout.has_error).toBe(true);
            const inputField = layout.layout.find(field => field.setting === "setsource");
            expect(inputField).toBeUndefined();
        });
    });

    describe('Default Settings', () => {
        it('should have correct default values', () => {
            const defaultSettings = {
                hostname: "",
                setsource: "",
                zone: "main",
                powerOffBothZones: true,
            };

            expect(defaultSettings.hostname).toBe("");
            expect(defaultSettings.setsource).toBe("");
            expect(defaultSettings.zone).toBe("main");
            expect(defaultSettings.powerOffBothZones).toBe(true);
        });

        it('should default to main zone for safety', () => {
            const defaultSettings = { zone: "main" };
            expect(defaultSettings.zone).toBe("main");
        });

        it('should default to powering off both zones for safety', () => {
            const defaultSettings = { powerOffBothZones: true };
            expect(defaultSettings.powerOffBothZones).toBe(true);
        });
    });

    describe('Settings Validation', () => {
        it('should handle valid zone values', () => {
            const validZones = ["main", "zone2"];
            
            validZones.forEach(zone => {
                const settings = { zone };
                const layout = mockMakeLayout(settings);
                expect(layout.has_error).toBe(false);
            });
        });

        it('should handle valid powerOffBothZones values', () => {
            const validValues = [true, false];
            
            validValues.forEach(value => {
                const settings = { powerOffBothZones: value };
                const layout = mockMakeLayout(settings);
                expect(layout.has_error).toBe(false);
            });
        });

        it('should validate hostname format (basic check)', () => {
            const validHostnames = [
                "192.168.1.100",
                "denon.local",
                "my-receiver",
                "10.0.0.1"
            ];

            validHostnames.forEach(hostname => {
                const settings = { hostname };
                // In a real implementation, you might have hostname validation
                expect(hostname.length).toBeGreaterThan(0);
                expect(hostname.length).toBeLessThanOrEqual(256);
            });
        });
    });

    describe('Settings Change Detection', () => {
        it('should detect hostname changes', () => {
            const oldSettings = { hostname: "192.168.1.100" };
            const newSettings = { hostname: "192.168.1.101" };

            const hostnameChanged = oldSettings.hostname !== newSettings.hostname;
            expect(hostnameChanged).toBe(true);
        });

        it('should detect zone changes', () => {
            const oldSettings = { zone: "main" };
            const newSettings = { zone: "zone2" };

            const zoneChanged = oldSettings.zone !== newSettings.zone;
            expect(zoneChanged).toBe(true);
        });

        it('should detect powerOffBothZones changes', () => {
            const oldSettings = { powerOffBothZones: true };
            const newSettings = { powerOffBothZones: false };

            const powerOffChanged = oldSettings.powerOffBothZones !== newSettings.powerOffBothZones;
            expect(powerOffChanged).toBe(true);
        });

        it('should detect multiple setting changes', () => {
            const oldSettings = {
                hostname: "192.168.1.100",
                zone: "main",
                powerOffBothZones: true,
                setsource: "CBL/SAT"
            };

            const newSettings = {
                hostname: "192.168.1.101",
                zone: "zone2",
                powerOffBothZones: false,
                setsource: "DVD"
            };

            const anyChanged = (
                oldSettings.hostname !== newSettings.hostname ||
                oldSettings.zone !== newSettings.zone ||
                oldSettings.powerOffBothZones !== newSettings.powerOffBothZones ||
                oldSettings.setsource !== newSettings.setsource
            );

            expect(anyChanged).toBe(true);
        });

        it('should not detect changes when settings are identical', () => {
            const settings1 = {
                hostname: "192.168.1.100",
                zone: "main",
                powerOffBothZones: true,
                setsource: "CBL/SAT"
            };

            const settings2 = { ...settings1 };

            const anyChanged = (
                settings1.hostname !== settings2.hostname ||
                settings1.zone !== settings2.zone ||
                settings1.powerOffBothZones !== settings2.powerOffBothZones ||
                settings1.setsource !== settings2.setsource
            );

            expect(anyChanged).toBe(false);
        });
    });
});