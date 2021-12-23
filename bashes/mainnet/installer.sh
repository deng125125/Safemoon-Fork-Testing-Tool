#!/bin/sh

which -s brew
if [[ $? != 0 ]] ; then
    # Install Homebrew
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "already has brew"
fi

# Add Homebrew to your PATH in /Users/$USER/.zprofile:
echo 'eval $(/opt/homebrew/bin/brew shellenv)' >> /Users/$USER/.zprofile
eval $(/opt/homebrew/bin/brew shellenv)

which -s node
if [[ $? != 0 ]] ; then
    # Install node
    brew install node
else
    echo "already has node"
fi

which -s truffle
if [[ $? != 0 ]] ; then
    # Install truffle
    brew install truffle
else
    echo "already has truffle"
fi

npm install web3

npm install -D ganache-cli
