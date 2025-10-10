"use strict";

const debug = require("debug")("roon-extension-denon:zone");

/**
 * Zone-specific helper functions for Denon/Marantz receiver control
 */
class ZoneFunctions {
    constructor(denonClient, settings) {
        this.denonClient = denonClient;
        this.settings = settings;
    }

    /**
     * Get power status for the configured zone
     * @returns {Promise<string>} "ON" or "STANDBY"
     */
    getPowerForZone() {
        if (this.settings.zone === "zone2") {
            return this.denonClient.getZone2().then(status => {
                const Denon = require("denon-client");
                return (status === Denon.Options.Zone2Options.On) ? "ON" : "STANDBY";
            });
        } else {
            return this.denonClient.getPower();
        }
    }

    /**
     * Set power state for the configured zone
     * @param {string} powerState - "ON" or "STANDBY"
     * @returns {Promise}
     */
    setPowerForZone(powerState) {
        if (this.settings.zone === "zone2") {
            const Denon = require("denon-client");
            const zone2State = (powerState === "ON") ? 
                Denon.Options.Zone2Options.On : 
                Denon.Options.Zone2Options.Off;
            return this.denonClient.setZone2(zone2State);
        } else {
            return this.denonClient.setPower(powerState);
        }
    }

    /**
     * Set power state with option to control both zones
     * @param {string} powerState - "ON" or "STANDBY"
     * @returns {Promise}
     */
    setPowerBothZones(powerState) {
        debug("setPowerBothZones: powerState=%s", powerState);
        
        if (this.settings.powerOffBothZones && powerState === "STANDBY") {
            // Turn off both zones when powering off
            const Denon = require("denon-client");
            const mainZonePromise = this.denonClient.setPower("STANDBY");
            const zone2Promise = this.denonClient.setZone2(Denon.Options.Zone2Options.Off);
            
            return Promise.all([mainZonePromise, zone2Promise]).then(() => {
                debug("Both zones powered off successfully");
            }).catch(error => {
                debug("Error powering off both zones: %O", error);
                throw error;
            });
        } else {
            // Use zone-specific power control
            return this.setPowerForZone(powerState);
        }
    }

    /**
     * Check status based on power and input state
     * @param {string} power - Power state ("ON" or "STANDBY")
     * @param {string} input - Current input
     * @returns {string} Status ("selected", "deselected", or "standby")
     */
    checkStatus(power, input) {
        let stat = "";
        if (power === "ON") {
            if (input === this.settings.setsource) {
                stat = "selected";
            } else {
                stat = "deselected";
            }
        } else {
            stat = "standby";
        }
        debug("Receiver Status: %s", stat);
        return stat;
    }

    /**
     * Get display name for the configured zone
     * @returns {string} Display name
     */
    getDisplayName() {
        return this.settings.zone === "zone2" ? "Zone 2" : "Main Zone";
    }

    /**
     * Check if volume control should be enabled for the current zone
     * @returns {boolean} True if volume control is supported
     */
    isVolumeControlSupported() {
        return this.settings.zone === "main";
    }

    /**
     * Update settings (used when settings change)
     * @param {object} newSettings - New settings object
     */
    updateSettings(newSettings) {
        this.settings = newSettings;
    }
}

module.exports = ZoneFunctions;