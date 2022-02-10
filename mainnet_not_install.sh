
#!/bin/sh
opt=$1

# chmod +x bashes/mainnet/installer.sh
chmod +x bashes/mainnet/runGanache-cli.sh

#install packages
# bashes/mainnet/installer.sh

# open a new Terminal tab
osascript -e 'tell application "Terminal" to do script "'"'$(PWD)'"'/bashes/mainnet/runGanache-cli.sh"'
sleep 7

cd Mainnet-BSC

truffle compile

case $opt in
        -r|-R )
		truffle test test/reflect.js
		;;
	-d|-D )
		truffle test test/dividend.js
		;;
	* )
		truffle test test/safemoon.js
		;;
esac
#truffle test test/safemoon.js
