#!/bin/sh

chmod +x bashes/mainnet/installer.sh
chmod +x bashes/mainnet/runGanache-cli.sh

#install packages
bashes/mainnet/installer.sh

# open a new Terminal tab
osascript -e 'tell application "Terminal" to do script "'"'$(PWD)'"'/bashes/mainnet/runGanache-cli.sh"'
sleep 7

cd Mainnet-BSC

truffle compile

truffle test test/safemoon.js