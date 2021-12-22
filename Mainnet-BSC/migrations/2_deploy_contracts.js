const Safemoon = artifacts.require('Safemoon');

module.exports = function(deployer) {
  deployer.deploy(Safemoon);
}