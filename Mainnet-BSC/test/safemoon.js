const compiledSafemoon = require("../build/contracts/Safemoon.json");
const compiledRouter = require("../library/IUniswapV2Router02.json");
const compiledFactory = require("../library/IPancakeFactory.json");
const compiledERC20 = require("../library/IERC20.json");

const Web3 = require('web3');
const rpcURL = "http://127.0.0.1:8545";
const web3 = new Web3(rpcURL);

// We treat the deployer and address(this) are excluded from fees
contract('Safemoon', (accounts) => {
  let SafemoonInstance;
  let PancakeRouterInstance;
  const deployer = accounts[0];
  const PancakeRouterAddress = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  let SafemoonAddress;
  let PairAddress;
  let WBNBAddress;



  // Note: Modify the values from line 24 - line 51!!!!

  // fees to be charged when addLiquidity(), 0 for most projects
  let walletFee = 0;

  // standard transfer Fees
  let reflectFeeRate = 5;
  let liquidityFeeRate = 5;
  let marketingFeeRate = 0;
  let burnFeeRate = 0;
  
  //separate buy Fees
  const hasSeparateBuyFees = false;  // true if contract has separate buy fees, and change the following values if true
  const buyReflectFeeRate = 0;
  const buyLiquidityFeeRate = 0;
  const buyMarketingFeeRate = 0;
  const buyBurnFeeRate = 0;

  //separate sell Fees
  const hasSeparateSellFees = false;  // true if contract has separate sell fees, and change the following values if true
  const sellReflectFeeRate = 0;
  const sellLiquidityFeeRate = 0;
  const sellMarketingFeeRate = 0;
  const sellBurnFeeRate = 0;

  // true if only selling tokens can trigger addLiuqidity()
  const onlySellToTriggerAddLiquidity = false;  

  // min number to add liquidity in BNB/ETH (update it to match the contract)
  const numToAddliquidityinFinney = 500000; 


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

  it('values of parameters are legal', async () => {
    assert.ok(!(reflectFeeRate == 0 && liquidityFeeRate == 0 && marketingFeeRate == 0 && burnFeeRate == 0),
              "check parameters setting for standard transfer fees at line 28 - 31" 
              );

    assert.ok(!hasSeparateBuyFees ||
              !(buyReflectFeeRate == 0 && buyLiquidityFeeRate == 0 && buyMarketingFeeRate == 0 && buyBurnFeeRate == 0),
              "check parameters setting for buy fees at line 34 - 38"
              );
    
    assert.ok(!hasSeparateSellFees ||
              !(sellReflectFeeRate == 0 && sellLiquidityFeeRate == 0 && sellMarketingFeeRate == 0 && sellBurnFeeRate == 0),
              "check parameters setting for sell fees at line 41 - 45"
              );
  });

  it('standard transaction succeed', async () => {
    await SafemoonInstance.methods.transfer(accounts[2], toWei('100'))
      .send({from: deployer, gas: 1200000000});
    await SafemoonInstance.methods.transfer(accounts[4], toWei('100'))
      .send({from: deployer, gas: 1200000000});
    //balance before transfer
    const senderContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[2]);
    const receiverContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[3]);
    const holderContractSafemoonBalance0 = await balanceOf(SafemoonInstance, accounts[4]); 
    const contractSafemoonBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);

    // transfer from sender to receiver 
    await SafemoonInstance.methods.transfer(accounts[3], toWei('100'))
      .send({from: accounts[2], gas: 1200000000});
    
    // balances after transfer
    const senderContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[2]);
    const receiverContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[3]);
    const holderContractSafemoonBalance1 = await balanceOf(SafemoonInstance, accounts[4]); 
    const contractSafemoonBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

    assert.equal(senderContractSafemoonBalance1, 0, "taxes are not correctly deducted from sender");//taxes are correctly deducted from sender
    assert.ok(fromWei((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0).toString()) > (100 - reflectFeeRate - liquidityFeeRate - marketingFeeRate - burnFeeRate).toString(),'receiver doesnt get enough fund from tx');//receiver 
    assert.ok(fromWei((contractSafemoonBalance1 - contractSafemoonBalance0).toString()) >= liquidityFeeRate.toString(),'Safemoon contract doesnt get enough liquidityFee');//take liqudity fee
    assert.ok((holderContractSafemoonBalance0 < holderContractSafemoonBalance1),'holder doesnt receive reflection');//check reflect
  });

  it('standard transfer succeed for 100 times', async () => {
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

      //assert.equal(fromWei((senderContractSafemoonBalance0 - senderContractSafemoonBalance1).toString()), `1`);
      assert.ok(fromWei(((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0) * 100).toString()) > (100 - reflectFeeRate - liquidityFeeRate - marketingFeeRate - burnFeeRate).toString(),'receiver doesnt get enough fund from tx');
      assert.ok(fromWei(((contractSafemoonBalance1 - contractSafemoonBalance0) * 100).toString()) >= liquidityFeeRate.toString(),'Safemoon contract doesnt get enough liquidityFee');
      assert.ok((holderContractSafemoonBalance0 < holderContractSafemoonBalance1),'holder doesnt receive reflection');
    }
  });

  it('trigger addliquidity() automatically once', async () => {
    const anyAccount = accounts[6];
    await SafemoonInstance.methods.transfer(anyAccount, 10**6)
      .send({from: deployer, gas: 1200000000});

    await SafemoonInstance.methods.transfer(SafemoonAddress, toWei(numToAddliquidityinFinney.toString()))
      .send({from: deployer, gas: 1200000000});
    
    // balances before auto addLiquidity 
    pairSafemoonBalance0 = await balanceOf(SafemoonInstance, PairAddress);
    contractSafemoonBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);

    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000')).send({from: anyAccount}); // approve
    // trigger auto addLiquidity when sell/standard transfer
    if (onlySellToTriggerAddLiquidity) {
      const path = new Array(SafemoonAddress, WBNBAddress);
      await PancakeRouterInstance.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(10**5, 0, path, anyAccount, 2639271011)
        .send({from: anyAccount, gas: 12000000});
    } else {
      await SafemoonInstance.methods.transfer(accounts[1], 500)
        .send({from: anyAccount, gas: 1200000000});
    }
    
    pairSafemoonBalance1 = await balanceOf(SafemoonInstance, PairAddress);
    contractSafemoonBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

    const deltaPairBalance = substringToNumber(pairSafemoonBalance1, 8) - substringToNumber(pairSafemoonBalance0, 8);
    const deltaContractBalance = (contractSafemoonBalance0 - contractSafemoonBalance1).toString();

    assert.ok(deltaPairBalance >=0 && deltaPairBalance <= 10**5, "inadequate addLiquidity()");
    assert.equal(deltaContractBalance, numToAddliquidity, "could be taken fee when addLiquidity()");
  });

  it('trigger addliquidity() automatically 10 times', async () => {
    const anyAccount = accounts[5];
    await SafemoonInstance.methods.transfer(anyAccount, 10**6)
      .send({from: deployer, gas: 1200000000});

    await SafemoonInstance.methods.transfer(SafemoonAddress, toWei((15 * numToAddliquidityinFinney).toString()))
      .send({from: deployer, gas: 1200000000});

    // balances before each addLiquidity()
    let pairSafemoonBalance0;
    let contractSafemoonBalance0;
    // balances after each addLiquidity()
    let pairSafemoonBalance1;
    let contractSafemoonBalance1;

    let hasWithdrawableBNB;

    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000')).send({from: anyAccount}); // approve
    for (let i = 0; i < 10; i++) {
      pairSafemoonBalance0 = await balanceOf(SafemoonInstance, PairAddress);
      contractSafemoonBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);
  
      // trigger auto addLiquidity when sell/standard transfer
      if (onlySellToTriggerAddLiquidity) {
        const path = new Array(SafemoonAddress, WBNBAddress);
        await PancakeRouterInstance.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(10**5, 0, path, anyAccount, 2639271011)
          .send({from: anyAccount, gas: 12000000});
      } else {
        await SafemoonInstance.methods.transfer(accounts[1], 500)
          .send({from: anyAccount, gas: 1200000000});
      }
      
      pairSafemoonBalance1 = await balanceOf(SafemoonInstance, PairAddress);
      contractSafemoonBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);
  
      const deltaPairBalance = substringToNumber(pairSafemoonBalance1, 8) - substringToNumber(pairSafemoonBalance0, 8);
      const deltaContractBalance = (contractSafemoonBalance0 - contractSafemoonBalance1).toString();

      assert.ok(deltaPairBalance >=0 && deltaPairBalance <= 10**5, "inadequate addLiquidity()");
      assert.equal(deltaContractBalance, numToAddliquidity, "could be taken fee when addLiquidity()");
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
    assert.equal(fromWei((contractBNB1 - contractBNB0).toString()), '10', "contract doesn't receive 10 BNB");
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

    if (hasSeparateBuyFees) {
      liquidityFeeRate = buyLiquidityFeeRate;
      marketingFeeRate = buyMarketingFeeRate;
      burnFeeRate = buyBurnFeeRate;
    }

    const liquidityFeeinFinney = BuyTokenNumberinFinney * liquidityFeeRate / 100;
    const marketingFeeinFinney = BuyTokenNumberinFinney * marketingFeeRate / 100;
    const burnFeeinFinney = BuyTokenNumberinFinney * burnFeeRate / 100;

     // reflectFee
    const otherOneBalance1 = await balanceOf(SafemoonInstance, otherOne);
    assert.ok(otherOneBalance1 > otherOneBalance0, "no reflect!");

    const contractBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

    // test addLiquidityFee
    assert.equal(Math.floor(fromWei((contractBalance1 - contractBalance0).toString())),
                            liquidityFeeinFinney + marketingFeeinFinney, 
                            'liquidity fees and marketing fees do not go to contract');
  });

  it('Sell tokens to Router', async () => {
    const seller = accounts[1];
    const otherOne = accounts[2];

    // transfer tokens to otherOne
    await SafemoonInstance.methods.transfer(otherOne, numToAddliquidity)
      .send({from: deployer, gas: 1200000000});
    const otherOneBalance0 = await balanceOf(SafemoonInstance, otherOne);

    // transfer tokens to seller
    await SafemoonInstance.methods.transfer(seller, numToAddliquidity)
      .send({from: deployer, gas: 1200000000});
    await SafemoonInstance.methods.transfer(seller, numToAddliquidity)
      .send({from: deployer, gas: 1200000000});

    const contractBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);

    //sell tokens
    const sellTokenNumberinFinney = numToAddliquidityinFinney;
    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('1000000000000000')).send({from: seller});
    const path = new Array(SafemoonAddress, WBNBAddress);
    await PancakeRouterInstance.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(toWei(sellTokenNumberinFinney.toString()), 0, path, seller, 2639271011)
      .send({from: seller, gas: 12000000});

    if (hasSeparateSellFees) {
      liquidityFeeRate = sellLiquidityFeeRate;
      marketingFeeRate = sellMarketingFeeRate;
      burnFeeRate = sellBurnFeeRate;
    }

    const liquidityFeeinFinney = sellTokenNumberinFinney * liquidityFeeRate / 100;
    const marketingFeeinFinney = sellTokenNumberinFinney * marketingFeeRate / 100;
    // const burnFeeinBNB = sellTokenNumberinFinney * burnFeeRate / 100;

     // burnFee
    const otherOneBalance1 = await balanceOf(SafemoonInstance, otherOne);
    assert.ok(otherOneBalance1 > otherOneBalance0, "no burn fee!");

    const contractBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

    // test addLiquidityFee
    assert.equal(Math.floor(fromWei((contractBalance1 - contractBalance0).toString())),
                            liquidityFeeinFinney + marketingFeeinFinney, 
                            'liquidity fees and marketing fees do not go to contract');

  });

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

const fromWei = (numString) => {
  return web3.utils.fromWei(numString, 'finney');
}

const substringToNumber = (string, num) => {
  return parseInt(string.substring(string.length - num));
}
