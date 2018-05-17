# Homebridge Motion Sensor Web
This is a Homebridge plugin that allows you to create motion sensor accessories in HomeKit for devices that can fire a web request when motion starts and ends.

I built this for my Ubiquiti UniFi Video cameras.  They have motion detection built in and they write to a log file (`/var/log/unifi-video/motion.log`) when they detect motion.  I have built a bash script that you can install as a service to send web requests when logs are written to that file.  You can find this in the project `/UniFi Video Service/unifi-video-motion-logwatch.sh`.  I've used `systemd` to run it as a daemon on my Ubuntu UniFi Video NVR machine.  I understand that the official Ubiquiti NVR may run Debian 7 (Wheezy) so `systemd` may not be available.  You will have to use `initd`.  You will also need to change the permission on `/var/log/unifi-video/motion.log` so that anyone can read the file (`chmod a+r /var/log/unifi-video/motion.log`).

## Installation
You must have Homebridge already installed, then just install the plugin by running `npm install -g homebridge-motionsensor-web`

## How It Works
This Homebridge plugin listens for web requests (on the configured port) with two different pathnames, `/start` and `/stop`.  It also requires a search parameter on the end that specifies the configured `sensorName`.

#### Example Start
`http://{IP_OF_HOMEBRIDGE_SERVER}:{CONFIGURED_PORT}/start?sensorName=MyConfiguredSensorName`

#### Example Stop
`http://{IP_OF_HOMEBRIDGE_SERVER}:{CONFIGURED_PORT}/stop?sensorName=MyConfiguredSensorName`

## Configuration
I have included an example config of the platform in `example.config.json`.

### Required Platform Option
* `httpPort` - You must provide the port that the plugin will bind to, to listen to web requests

### Required Sensor Options
* `name` - Friendly name for the sensor
* `sensorName` - The parameter value for parameter `sensorName` in the web request
* `manufacturer` - Manufacturer
* `model` - Model

### Optional Sensor Option
* `serial` - Serial
* `stopDelayMs` - Set this to the millisecond value you want to delay the stop event from firing after it has fired. (Now that I look at this, I don't really use this, probably can take it out.) DEFAULT: 1500
* `startAfterStopFuseMs` - Set this to a millisecond value.  This will prevent any new start motion events from firing (for the given time) after the last start motion event.  I created this as my cameras would trigger a motion start, then I will turn on a light, and then leave them on for 5 minutes, and then turn off the light.  When the light turns off it triggers another motion start event, so would get stuck in a loop.  I resolved it by using this and setting it to 5 minutes plus 10 seconds.  DEFAULT: 750