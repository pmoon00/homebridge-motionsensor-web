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
	this.timeoutDurationMs = config["timeoutDurationMs"] || 10000;
	this.motionDetected = false;
	this.timeoutID = -1;
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
	updateState: function (motionDetected) {
		this.motionDetected = !!motionDetected;
		this.motionService.getCharacteristic(Characteristic.MotionDetected)
			.updateValue(this.motionDetected, null, "updateState");
		this.log(`Motion state updated to ${this.motionDetected}`);
	},
	//WEBS
	setupWebServer: function () {
		this._webServer = http.createServer(this.requestHandler);
		this._webServer.listen(this.httpPort, (err) => {
			if (err) {
				return this.log(`An error occurred when setting up the web server. Error: ${err}`);
			}
		
			this.log(`Web server is listening on ${this.httpPort}`);
		});
	},
	requestHandler: function (request, response) {
		this.log(request.url);
		
		this.updateState(true);
		
		if (this.timeoutID > -1) {
			clearTimeout(this.timeoutID);
		}

		this.timeoutID = setTimeout(() => {
			this.timeoutID = -1;
			this.updateState(false);
		}, this.timeoutDurationMs);
		response.end("Pong");
	}
};