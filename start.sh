#!/bin/bash
python3 -m http.server 3000 > server.log 2>&1 &
echo $! > server.pid
