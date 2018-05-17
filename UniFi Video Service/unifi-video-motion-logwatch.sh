#!/bin/bash
echo "$(date): unifi-video-motion-logwatch started" >>~/unifi-video-motion-logwatch.log

tail -fn0 /var/log/unifi-video/motion.log | \
while read line ; do
	echo "$(date): reading line ==> ""$line""" >>~/unifi-video-motion-logwatch.log
	
	cameraName="$(echo "$line" | grep -Po "(?<=\()[^\)]+(?=\))")"
	isStart="$(echo "$line" | grep -o "type:start")"
	isStop="$(echo "$line" | grep -o "type:stop")"
	openBracket="("
	closeBracket=")"
	emptyString=""

	if [ ! -z "$cameraName" ] && [ ! -z "$isStart" ]
	then
			echo "$(date): Camera: ""$cameraName"" Action: Start" >>~/unifi-video-motion-logwatch.log
			curl -Gv "http://10.1.1.221:8888/start" --data-urlencode "camera=${cameraName}"
	fi

	if [ ! -z "$cameraName" ] && [ ! -z "$isStop" ]
	then
			echo "$(date): Camera: ""$cameraName"" Action: Stop" >>~/unifi-video-motion-logwatch.log
			curl -Gv "http://10.1.1.221:8888/stop" --data-urlencode "camera=${cameraName}"
	fi
done