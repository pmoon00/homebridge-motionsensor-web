"use strict";
var Service, Characteristic;
const http = require("http");
const url = require("url");

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerPlatform("homebridge-motionsensor-web", "motionsensor-web-platform", MotionSensorWebPlatform);
};

/*
 * Platform code
 * */
function MotionSensorWebPlatform(log, config) {
	this.log = log;
	this.config = config;
}

MotionSensorWebPlatform.prototype = {
	accessories: function (callback) {
		var config = this.config;
		var sensors = config.sensors;

		this.httpPort = config["httpPort"] || 8888;
		this.accessories = [];
		this.sensorDictionary= {};

		for (var i = 0, l = sensors.length; i < l; i++) {
			var sensor = sensors[i];
			var sensorName = sensor.name;

			if (!sensorName) {
				this.log("Could not find name in the following sensor config, so did not add.");
				this.log(JSON.stringify(sensor));
				continue;
			}

			sensorName = sensorName.toLowerCase();
			this.sensorDictionary[sensorName] = new MotionSensorWeb(this.log, sensor);
			this.accessories.push(this.sensorDictionary[sensorName]);
		}
		
		callback(this.accessories);
		this.setupWebServer();
	},
	updateSensorState: function (isStart, sensorName) {
		if (!sensorName) {
			this.log("A sensor name must be supplied to update sensor state.");
			return;
		}

		var sensor = this.sensorDictionary[sensorName.toLowerCase()];

		if (!sensor) {
			this.log(`Could not find sensor with name ${sensorName}.`);
			return;
		}

		sensor.setState(isStart);
		this.log(`Updated sensor ${sensorName} as ${isStart}.`);
	},
	//WEBS
	setupWebServer: function () {
		this._webServer = http.createServer(this.requestHandler.bind(this));
		this._webServer.listen(this.httpPort, (err) => {
			if (err) {
				return this.log(`An error occurred when setting up the web server. Error: ${err}.`);
			}
		
			this.log(`Web server is listening on ${this.httpPort}.`);
		});
	},
	requestHandler: function (request, response) {
		var rawURL = request.url.toLowerCase(); //e.g. /start?sensorName=sensorName or /stop?sensorName=sensorName
		var searchDictionary = (function (rawURL) {
			var dictionary = {};

			if (!rawURL || rawURL.indexOf("?") == -1) {
				return dictionary;
			}

			var search = rawURL.split("?")[1];
			var searchData = search.split("&");

			for (var i = 0, l = searchData.length; i < l; i++) {
				var keyValuePair = searchData[i].split("=");
				var key = decodeURIComponent(keyValuePair[0]);
				var value = decodeURIComponent(keyValuePair.length > 1 ? keyValuePair[1] : "");

				dictionary[key.toLowerCase()] = value;
			}

			return dictionary;
		})(rawURL);
		var pathname = rawURL.split("?")[0].toLowerCase();

		this.log(`Handled request URL: ${rawURL}.`);
		this.log(`Handled request pathname: ${pathname}.`);
		this.log(`Handled request search data: ${JSON.stringify(searchDictionary)}.`);

		if (searchDictionary && !searchDictionary.sensorname) {
			this.log("No sensorName parameter in URL, cannot process.");
			return;
		}

		switch (pathname) {
			case "/start":
				this.updateSensorState(true, searchDictionary.sensorname);
				break;
			case "/stop":
				this.updateSensorState(false, searchDictionary.sensorname);
				break;
		}
		
		response.end("Pong");
	}
}

/*
 * Accessory code
 * */
function MotionSensorWeb(log, config) {
	this.log = log;
	this.name = config["name"];
	this.manufacturer = config["manufacturer"];
	this.model = config["model"];
	this.serial = config["serial"] || "Non-defined serial";
	this.startAfterStopFuseMs = config["startAfterStopFuseMs"] || 750;
	this.stopDelayMs = config["stopDelayMs"] || 1500;
	this.startFuseActive = false;
	this.motionDetected = false;
	this.stopDelayTimeoutID = -1;
}

MotionSensorWeb.prototype = {
	getState: function (callback) {
		this.log(`getState called and motionDetected: ${this.motionDetected}.`);
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
		this.log(`Motion state updated to ${this.motionDetected}.`);
	}
};