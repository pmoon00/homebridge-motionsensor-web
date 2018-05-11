"use strict";
var Service, Characteristic;
const http = require("http");

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-motionsensor-web", "motionsensor-web", MotionSensorWeb);
};

function MotionSensorWeb(log, config) {
	this.log = log;
	this.name = config["name"];
	this.manufacturer = config["manufacturer"];
	this.model = config["model"];
	this.serial = config["serial"] || "Non-defined serial";
	this.httpPort = config["httpPort"] || 8888;
	this.startAfterStopFuseMs = config["startAfterStopFuseMs"] || 750;
	this.stopDelayMs = config["stopDelayMs"] || 1500;
	this.startFuseActive = false;
	this.motionDetected = false;
	this.stopDelayTimeoutID = -1;
}

MotionSensorWeb.prototype = {
	getState: function (callback) {
		this.log(`getState called and motionDetected: ${this.motionDetected}`);
		callback(null, this.motionDetected);
	},
	getServices: function () {
		var services = [];

		this.informationService = new Service.AccessoryInformation();
		this.informationService
				.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
				.setCharacteristic(Characteristic.Model, this.model)
				.setCharacteristic(Characteristic.SerialNumber, this.serial);

		services.push(this.informationService);

		this.motionService = new Service.MotionSensor(this.name);
		this.motionService
			.getCharacteristic(Characteristic.MotionDetected)
			.on("get", this.getState.bind(this));

		services.push(this.motionService);

		this.setupWebServer();
		return services;
	},
	/*
	 * Scenarios:
	 * Start and is currently stopped - trigger immediately
	 * Start and stop is queued - cancel stop if fuse has passed.  This accounts for the lights turning off and triggering the motion.
	 * Stop after delay - this is so the light can stay on for a while after the motion has finished
	*/
	updateState: function (motionDetected) {
		motionDetected = !!motionDetected;

		if (motionDetected == this.motionDetected) {
			this.log("Update state fired but hasn't changed, so didn't update.");
			return;
		}

		if (motionDetected && !this.startFuseActive && this.stopDelayTimeoutID > -1) {
			this.log("A motion start event fired while stop was queued, cleared stop queue.");
			clearTimeout(this.stopDelayTimeoutID);
			return;
		} else if (motionDetected && this.startFuseActive) {
			this.log("A motion start event fired but fuse is running, didn't send start motion event.");
			return;
		}

		if (!motionDetected) {
			this.log("A motion end event fired.  Stop event has now been queued.");
			this.stopDelayTimeoutID = setTimeout(() => {
				this.updateState(false);
				this.log("A motion end event fired.  Event sent.");
				this.stopDelayTimeoutID = -1;
			}, this.stopDelayMs);
			this.startFuseActive = true;
			this.log("Fuse started.");
			setTimeout(() => {
				this.startFuseActive = false;
				this.log("Fuse cleared.");
			}, this.startAfterStopFuseMs);
		}

		this.setState(motionDetected);
	},
	setState: function (motionDetected) {
		this.motionDetected = !!motionDetected;
		this.motionService.getCharacteristic(Characteristic.MotionDetected)
			.updateValue(this.motionDetected, null, "updateState");
		this.log(`Motion state updated to ${this.motionDetected}`);
	},
	//WEBS
	setupWebServer: function () {
		this._webServer = http.createServer(this.requestHandler.bind(this));
		this._webServer.listen(this.httpPort, (err) => {
			if (err) {
				return this.log(`An error occurred when setting up the web server. Error: ${err}`);
			}
		
			this.log(`Web server is listening on ${this.httpPort}`);
		});
	},
	requestHandler: function (request, response) {
		var url = request.url.toLowerCase(); //e.g. /start or /stop

		this.log(`Handled request URL: ${url}`);

		switch (url) {
			case "/start":
				this.updateState(true);
				break;
			case "/stop":
				this.updateState(false);
				break;
		}
		
		response.end("Pong");
	}
};