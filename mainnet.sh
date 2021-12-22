#!/bin/sh

chmod +x bashes/mainnet/installer.sh
chmod +x bashes/mainnet/runGanache-cli.sh
chmod +x bashes/mainnet/runTruffle.sh

bashes/mainnet/installer.sh
# open a new Terminal tab
osascript -e 'tell application "Terminal" to do script "Desktop/Projects/Safemoon\\ Fork\\ Testing\\ Tool/bashes/mainnet/runGanache-cli.sh"'
sleep 8
# open a new Terminal tab
osascript -e 'tell application "Terminal" to do script "Desktop/Projects/Safemoon\\ Fork\\ Testing\\ Tool/bashes/mainnet/runTruffle.sh"' 
