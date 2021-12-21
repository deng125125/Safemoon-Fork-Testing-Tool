const compiledSafemoon = require("../build/contracts/Safemoon.json");
const compiledRouter = require("../build/contracts/IUniswapV2Router02.json");
const compiledERC20 = require("../build/contracts/IERC20.json");

const Web3 = require('web3');
const rpcURL = "http://127.0.0.1:8545";
const web3 = new Web3(rpcURL);


contract('Safemoon', (accounts) => {
  let SafemoonInstance;
  let PancakeRouterInstance;
  // let WBNBInstance;
  // let pairInstance;
  const deployer = accounts[0];
  const PancakeRouterAddress = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
  let SafemoonAddress;
  let PairAddress;
  // const WBNBAddress;
  // let pairAddress; // Safemoon-wbnb pair



  beforeEach(async () => {
    SafemoonInstance = await new web3.eth.Contract(compiledSafemoon.abi)
      .deploy({ data: compiledSafemoon.bytecode })
      .send({ from: deployer, gas: 1200000000 });

    PancakeRouterInstance = new web3.eth.Contract(compiledRouter.abi, PancakeRouterAddress);

    SafemoonAddress = SafemoonInstance.options.address;
    PairAddress = await SafemoonInstance.methods.uniswapV2Pair().call();
  });

  it('inital conditions', async () => {
    // contracts exist
    assert.ok(SafemoonInstance);
    assert.ok(PancakeRouterInstance);

    // SafemoonContractBalance is 0
    let contractTokenBalance = await SafemoonInstance.methods.balanceOf(SafemoonInstance.options.address).call();
    assert.equal(contractTokenBalance, 0);

    // deployerBalance is totalsupply
    let deployerTokenBalance = await SafemoonInstance.methods.balanceOf(deployer).call();
    assert.equal(await SafemoonInstance.methods.totalSupply().call(), deployerTokenBalance);
  });

  it('test addliquidity', async () => {
    const numToAddliquidity = await toWei('500');
    // await SafemoonInstance.methods.approve(PancakeRouterAddress, numToAddliquidity);
      // .send({ from: deployer });
    // const approved = await SafemoonInstance.methods.allowance(deployer, PancakeRouterAddress).call();
    // console.log("approved", approved);
    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('1500')).send({from: deployer});
    await PancakeRouterInstance.methods.addLiquidityETH(SafemoonAddress, toWei('500'), 0, 0, SafemoonAddress, 2639271011)
      .send({ from: deployer, value: toWei('300'), gas: 1200000000 }); // 300 ether

    await SafemoonInstance.methods.transfer(SafemoonAddress, await toWei('1500'))
      .send({from: deployer, gas: 1200000000});
    
    // balances before auto addLiquidity 
    const pairSafemoonBalance0 = await balanceOf(SafemoonInstance, PairAddress);
    const contractSafemoonBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);

    // trigger auto addLiquidity
    await SafemoonInstance.methods.transfer(accounts[1], 500)
      .send({from: deployer, gas: 1200000000});
    
    // balances after auto addLiquidity
    const pairSafemoonBalance1 = await balanceOf(SafemoonInstance, PairAddress);
    const contractSafemoonBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

    assert.equal((pairSafemoonBalance1 - pairSafemoonBalance0).toString(), numToAddliquidity);
    assert.equal((contractSafemoonBalance0 - contractSafemoonBalance1).toString(), numToAddliquidity);
  });
});

const balanceOf = (instance, address) => {
  return instance.methods.balanceOf(address).call();
}

const toWei = (numString) => {
  return web3.utils.toWei(numString, 'ether');
}