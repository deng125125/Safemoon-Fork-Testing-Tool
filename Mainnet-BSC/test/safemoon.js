const compiledSafemoon = require("../build/contracts/Safemoon.json");
const compiledRouter = require("../library/IUniswapV2Router02.json");
const compiledFactory = require("../library/IPancakeFactory.json");
const compiledERC20 = require("../library/IERC20.json");

const Web3 = require('web3');
const rpcURL = "http://127.0.0.1:8545";
const web3 = new Web3(rpcURL);


contract('Safemoon', (accounts) => {
  let SafemoonInstance;
  let PancakeRouterInstance;
  const deployer = accounts[0];
  const PancakeRouterAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  let SafemoonAddress;
  let PairAddress;
  let WBNBAddress;

  const reflectFeeRate = 5;
  const liquidityFeeRate = 5;
  const marketingFeeRate = 0;
  const burnFeeRate = 0;
  
  const numToAddliquidityinFinney = 500000; // min number to add liquidity in BNB/ETH (update it to match the contract)
  let numToAddliquidity;
  
  beforeEach(async () => {
    SafemoonInstance = await new web3.eth.Contract(compiledSafemoon.abi)
    .deploy({ data: compiledSafemoon.bytecode })
    .send({ from: deployer, gas: 1200000000 });

    PancakeRouterInstance = await new web3.eth.Contract(compiledRouter.abi, PancakeRouterAddress);
    const factoryAddress = await PancakeRouterInstance.methods.factory().call();
    const factoryInstance = await new web3.eth.Contract(compiledFactory.abi, factoryAddress);

    SafemoonAddress = SafemoonInstance.options.address;
    WBNBAddress = await PancakeRouterInstance.methods.WETH().call();
    PairAddress = await factoryInstance.methods.getPair(SafemoonAddress, WBNBAddress).call();

    // addLiquidityEth
    numToAddliquidity = toWei(numToAddliquidityinFinney.toString());
    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000000000000')).send({from: deployer}); // approve
    await PancakeRouterInstance.methods.addLiquidityETH(SafemoonAddress, numToAddliquidity, 0, 0, SafemoonAddress, 2639271011)
      .send({ from: deployer, value: toWei('500'), gas: 1200000000 }); // add LiquidityETH 500 BNB / 5000 Safemoon
  });

  it('single transaction succeed', async () => {
    await SafemoonInstance.methods.transfer(accounts[2], toWei('100'))
      .send({from: deployer, gas: 1200000000});
    await SafemoonInstance.methods.transfer(accounts[4], toWei('100'))
      .send({from: deployer, gas: 1200000000});
    //balance before transfer
    const senderContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[2]);
    const receiverContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[3]);
    const holderContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[4]); 
    const contractSafemoonBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);

    // trigger auto addLiquidity
    await SafemoonInstance.methods.transfer(accounts[3], toWei('100'))
      .send({from: accounts[2], gas: 1200000000});
    
    // balances after auto addLiquidity
    const senderContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[2]);
    const receiverContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[3]);
    const holderContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[4]); 
    const contractSafemoonBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

    assert.equal(senderContractSafemoonBalance1, 0);//taxes are correctly deducted from sender
    assert.ok(fromWeiToFinney((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0).toString()) > (100 - reflectFeeRate - liquidityFeeRate - marketingFeeRate - burnFeeRate).toString(),'receiver doesnt get enough fund from tx');//receiver 
    assert.ok(fromWeiToFinney((contractSafemoonBalance1 - contractSafemoonBalance0).toString()) >= liquidityFeeRate.toString(),'Safemoon contract doesnt get enough liquidityFee');//take liqudity fee
    assert.ok((holderContractSafemoonBalance0 < holderContractSafemoonBalance1),'holder doesnt receive reflection');//check reflect
  });

  it('Token transfer succeed for 100 times', async () => {
    await SafemoonInstance.methods.transfer(accounts[2], toWei('100'))
      .send({from: deployer, gas: 1200000000});
    await SafemoonInstance.methods.transfer(accounts[4], toWei('100'))
      .send({from: deployer, gas: 1200000000});

    let senderContractSafemoonBalance0;
    let receiverContractSafemoonBalance0;
    let holderContractSafemoonBalance0; 
    let contractSafemoonBalance0;
    let senderContractSafemoonBalance1;
    let receiverContractSafemoonBalance1;
    let holderContractSafemoonBalance1; 
    let contractSafemoonBalance1;

    for (let i = 0; i < 100; i++) {
      senderContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[2]);
      receiverContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[3]);
      holderContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[4]); 
      contractSafemoonBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress); 

      await SafemoonInstance.methods.transfer(accounts[3], toWei('1'))
        .send({from: accounts[2], gas: 1200000000}); 

      senderContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[2]);
      receiverContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[3]);
      holderContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[4]); 
      contractSafemoonBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

      //assert.equal(fromWeiToFinney((senderContractSafemoonBalance0 - senderContractSafemoonBalance1).toString()), `1`);
      assert.ok(fromWeiToFinney(((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0) * 100).toString()) > (100 - reflectFeeRate - liquidityFeeRate - marketingFeeRate - burnFeeRate).toString(),'receiver doesnt get enough fund from tx');
      assert.ok(fromWeiToFinney(((contractSafemoonBalance1 - contractSafemoonBalance0) * 100).toString()) >= liquidityFeeRate.toString(),'Safemoon contract doesnt get enough liquidityFee');
      assert.ok((holderContractSafemoonBalance0 < holderContractSafemoonBalance1),'holder doesnt receive reflection');
    }
  });

  it('addliquidity() can be triggered once', async () => {
    await SafemoonInstance.methods.transfer(SafemoonAddress, toWei((5 * numToAddliquidityinFinney).toString()))
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

    assert.equal((pairSafemoonBalance1 - pairSafemoonBalance0).toString(), numToAddliquidity, "inadequate addLiquidity()");
    assert.equal((contractSafemoonBalance0 - contractSafemoonBalance1).toString(), numToAddliquidity, "could be taken fee when addLiquidity()");
  });

  it('addLiquidity() can be triggered 10 times', async () => {
    await SafemoonInstance.methods.transfer(SafemoonAddress, toWei((15 * numToAddliquidityinFinney).toString()))
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
  
      assert.equal((pairSafemoonBalance1 - pairSafemoonBalance0).toString(), numToAddliquidity, "inadequate addLiquidity()");
      assert.equal((contractSafemoonBalance0 - contractSafemoonBalance1).toString(), numToAddliquidity, "could be taken fee when addLiquidity()");
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
    assert.equal(fromWeiToFinney((contractBNB1 - contractBNB0).toString()), '10', "contract doesn't receive 10 BNB");
  });

  // for burnfee, only test if any token is burned
  it('Buy tokens from Router', async () => {
    const buyer = accounts[1];
    const otherOne = accounts[2];

    // transfer tokens to otherOne
    await SafemoonInstance.methods.transfer(otherOne, numToAddliquidity)
      .send({from: deployer, gas: 1200000000});
    const otherOneBalance0 = await balanceOf(SafemoonInstance, otherOne);
    
    const contractBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);

    // buy tokens
    const BuyTokenNumberinFinney = numToAddliquidityinFinney / 10;
    const path = new Array(WBNBAddress, SafemoonAddress);
    await PancakeRouterInstance.methods.swapETHForExactTokens(toWei(BuyTokenNumberinFinney.toString()), path, buyer, 2639271011)
      .send({from: buyer, value: toWei('1000'), gas: 12000000});

    const liquidityFeeinFinney = BuyTokenNumberinFinney * liquidityFeeRate / 100;
    const marketingFeeinFinney = BuyTokenNumberinFinney * marketingFeeRate / 100;
    const burnFeeinFinney = BuyTokenNumberinFinney * burnFeeRate / 100;

     // burnFee
    const otherOneBalance1 = await balanceOf(SafemoonInstance, otherOne);
    assert.ok(otherOneBalance1 > otherOneBalance0, "no burn fee!");

    const contractBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

    // test addLiquidityFee
    assert.equal(Math.floor(fromWeiToFinney((contractBalance1 - contractBalance0).toString())),
                            liquidityFeeinFinney + marketingFeeinFinney, 
                            'liquidity fees and marketing fees do not go to contract');
  });

  // it('Sell tokens to Router', async () => {
  //   const seller = accounts[1];
  //   const otherOne = accounts[2];

  //   // transfer tokens to otherOne
  //   await SafemoonInstance.methods.transfer(otherOne, numToAddliquidity)
  //     .send({from: deployer, gas: 1200000000});
  //   const otherOneBalance0 = await balanceOf(SafemoonInstance, otherOne);

  //   // transfer tokens to seller
  //   await SafemoonInstance.methods.transfer(seller, numToAddliquidity)
  //     .send({from: deployer, gas: 1200000000});

  //   const contractBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);

  //   //sell tokens
  //   const sellTokenNumberinFinney = numToAddliquidityinFinney * 1000 / 10;
  //   const sellTokenNumberPlusOne = toFinney((sellTokenNumberinFinney / 10).toString()) + '1';  // avoid error: revert Pancake: K
  //   await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000000')).send({from: seller});
  //   let path = new Array(SafemoonAddress, WBNBAddress);
  //   await PancakeRouterInstance.methods.swapExactTokensForETH(sellTokenNumberPlusOne, 0, path, seller, 2639271011)
  //     .send({from: seller, gas: 12000000});

  //   // sell feeRates to update
  //   const liquidityFeeRate = 5;
  //   const marketingFeeRate = 0;
  //   // const burnFeeRate = 5;

  //   const liquidityFeeinFinney = sellTokenNumberinBNB * 1000 * liquidityFeeRate / 100;
  //   const marketingFeeinFinney = sellTokenNumberinBNB * 1000 * marketingFeeRate / 100;
  //   // const burnFeeinBNB = sellTokenNumberinBNB * burnFeeRate / 100;

  //    // burnFee
  //   const otherOneBalance1 = await balanceOf(SafemoonInstance, otherOne);
  //   assert.ok(otherOneBalance1 > otherOneBalance0, "no burn fee!");

  //   const contractBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

  //   // test addLiquidityFee
  //   assert.equal(Math.floor(fromWeiToSzabo((contractBalance1 - contractBalance0).toString())),
  //                           liquidityFeeinFinney + marketingFeeinFinney, 
  //                           'liquidity fees and marketing fees do not go to contract');

  // });

});



const getBalanceBNB = (address) => {
  return web3.eth.getBalance(address);
}

const balanceOf = (instance, address) => {
  return instance.methods.balanceOf(address).call();
}

const toWei = (numString) => {
  return web3.utils.toWei(numString, 'finney');
}

const fromWeiToSzabo = (numString) => {
  return web3.utils.fromWei(numString, 'szabo');
}

const fromWeiToFinney = (numString) => {
  return web3.utils.fromWei(numString, 'finney');
}

const toFinney = (numString) => {
  return web3.utils.toWei(numString, 'finney');
}
