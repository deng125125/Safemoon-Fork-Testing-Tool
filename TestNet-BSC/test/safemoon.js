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

  it('addliquidity() can be triggered once', async () => {
    const numToAddliquidity = toWei('500');  // reset to match the contract
    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000000000000000000000')).send({from: deployer}); //approve
    await PancakeRouterInstance.methods.addLiquidityETH(SafemoonAddress, toWei('500'), 0, 0, SafemoonAddress, 2639271011)
      .send({ from: deployer, value: toWei('300'), gas: 1200000000 }); // 300 ether

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
    const numToAddliquidityinBNB = 500;
    const numToAddliquidity = toWei(numToAddliquidityinBNB.toString());  // min number to add liquidity (update it to match the contract)
    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000000000000')).send({from: deployer}); // approve
    await PancakeRouterInstance.methods.addLiquidityETH(SafemoonAddress, numToAddliquidity, 0, 0, SafemoonAddress, 2639271011)
      .send({ from: deployer, value: toWei('300'), gas: 1200000000 }); // add LiquidityETH 300 ether

    // transfer 15 * numToAddliquidity tokens to SafemoonAddress
    await SafemoonInstance.methods.transfer(SafemoonAddress, toWei((15 * numToAddliquidityinBNB).toString()))
      .send({from: deployer, gas: 1200000000});

    // balances before each addLiquidity()
    let pairSafemoonBalance0;
    let contractSafemoonBalance0;
    // balances after each addLiquidity()
    let pairSafemoonBalance1;
    let contractSafemoonBalance1;

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
    }
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