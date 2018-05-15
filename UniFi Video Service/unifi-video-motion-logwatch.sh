#!/bin/bash
#grep -Po '\([^\)]+\)'
#echo "logwatch started" >> /var/log/logwatch.log

tail -fn0 /var/log/unifi-video/motion.log | \
while read line ; do
        cameraName="$(echo "$line" | grep -o ""\(.*\)"")"
        isStart="$(echo "$line" | grep -o "type:start")"
        isStop="$(echo "$line" | grep -o "type:stop")"
        openBracket="("
        closeBracket=")"
        emptyString=""
        cameraName="${cameraName/$openBracket/$emptyString}"
        cameraName="${cameraName/$closeBracket/$emptyString}"

        if [ ! -z "$cameraName" ] && [ ! -z "$isStart" ]
        then
                #echo "Motion started!!!!" >> /var/log/logwatch.log
                echo "Going to curl the following start URL"
                curl -Gv "http://10.1.1.221:8888/start" --data-urlencode "camera=${cameraName}"
        fi

        if [ ! -z "$cameraName" ] && [ ! -z "$isStop" ]
        then
                #echo "Motion ended!!!!" >> /var/log/logwatch.log
                echo "Going to curl the following stop URL"
                curl -Gv "http://10.1.1.221:8888/stop" --data-urlencode "camera=${cameraName}"
        fi
done