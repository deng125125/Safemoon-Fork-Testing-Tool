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

  const numToAddliquidityinBNB = 500; // min number to add liquidity in BNB/ETH (update it to match the contract)
  const numToAddliquidity = web3.utils.toWei(numToAddliquidityinBNB.toString(), 'ether'); 
  
  beforeEach(async () => {
    SafemoonInstance = await new web3.eth.Contract(compiledSafemoon.abi)
      .deploy({ data: compiledSafemoon.bytecode })
      .send({ from: deployer, gas: 1200000000 });

    PancakeRouterInstance = new web3.eth.Contract(compiledRouter.abi, PancakeRouterAddress);

    SafemoonAddress = SafemoonInstance.options.address;
    PairAddress = await SafemoonInstance.methods.uniswapV2Pair().call();

    // addLiquidityEth
    const numToAddLiquidityEth =  toWei((10 * numToAddliquidityinBNB).toString()); 
    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000000000000')).send({from: deployer}); // approve
    await PancakeRouterInstance.methods.addLiquidityETH(SafemoonAddress, numToAddLiquidityEth, 0, 0, SafemoonAddress, 2639271011)
      .send({ from: deployer, value: toWei('500'), gas: 1200000000 }); // add LiquidityETH 500 BNB / 5000 Safemoon
  });

  it('addliquidity() can be triggered once', async () => {
    await SafemoonInstance.methods.transfer(SafemoonAddress, toWei('1500'))
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

  it('addLiquidity() can be triggered 10 times', async () => {
    // transfer 15 * numToAddliquidity tokens to SafemoonAddress
    await SafemoonInstance.methods.transfer(SafemoonAddress, toWei((15 * numToAddliquidityinBNB).toString()))
      .send({from: deployer, gas: 1200000000});

    // balances before each addLiquidity()
    let pairSafemoonBalance0;
    let contractSafemoonBalance0;
    // balances after each addLiquidity()
    let pairSafemoonBalance1;
    let contractSafemoonBalance1;

    let hasWithdrawableBNB;
    for (let i = 0; i < 10; i++) {
      pairSafemoonBalance0 = await balanceOf(SafemoonInstance, PairAddress);
      contractSafemoonBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);
  
      // trigger auto addLiquidity
      await SafemoonInstance.methods.transfer(accounts[1], 500)
        .send({from: deployer, gas: 1200000000});
      
      pairSafemoonBalance1 = await balanceOf(SafemoonInstance, PairAddress);
      contractSafemoonBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);
  
      assert.equal((pairSafemoonBalance1 - pairSafemoonBalance0).toString(), numToAddliquidity);
      assert.equal((contractSafemoonBalance0 - contractSafemoonBalance1).toString(), numToAddliquidity);
      hasWithdrawableBNB = await getBalanceBNB(SafemoonAddress) > 0;
    }
    console.log("withdrawable BNB in contract after addLiquidity(): ", hasWithdrawableBNB);
  });


  it('Contract can receive BNB', async () => {
    const sender = accounts[1];
    const senderBNB0 = await getBalanceBNB(sender);
    const contractBNB0 = await getBalanceBNB(SafemoonAddress);
    // send bnb
    await web3.eth.sendTransaction({from: sender, to: SafemoonAddress, value: toWei('10')});
    const senderBNB1 = await getBalanceBNB(sender);
    const contractBNB1 = await getBalanceBNB(SafemoonAddress);
    assert.equal(fromWei((contractBNB1 - contractBNB0).toString()), '10');
  });



});

const getBalanceBNB = (address) => {
  return web3.eth.getBalance(address);
}

const balanceOf = (instance, address) => {
  return instance.methods.balanceOf(address).call();
}

const toWei = (numString) => {
  return web3.utils.toWei(numString, 'ether');
}

const fromWei = (numString) => {
  return web3.utils.fromWei(numString, 'ether');
}