const compiledSafemoon = require("../build/contracts/Safemoon.json");
const compiledERC20 = require("../library/IERC20.json");
const compiledFactory = require("../library/IPancakeFactory.json");
const compiledRouter = require("../library/IUniswapV2Router02.json");
const Safemoon = artifacts.require("Safemoon");

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


  // Note: Modify the following values (Until "beforeEach")

  // type of contract
  const hasDividend = false;  // is dividend paying token or not
  const hasAddLiquidityFunction = true;  // has addLiquidity() function or not

  // dividend-paying-token only
  const isDividendBNB = false;  // true if dividend is BNB?
  let dividendTokenAddress;  // if isDividendBNB is false, give this parameter an address
  const minimumTokenBalanceForDividendsinFinney = 0;  // in finney, 1 ether == 1000 finney


  // true: all the fees are sent to the contract in _transfer(), distribute fees when the balance of contract reaches `numToaddliquidityinFinney`
  // false: only liquidity fees are sent to the contract
  const isAllFeeSentToContract = false;

  // fees to be charged when addLiquidity(), 0 for most projects
  let walletFee = 0;

  // standard transfer Fees
  const dividendRewardFeeRate = 0; // dividend-paying-token only
  const reflectFeeRate = 5;  // 0 for dividend-paying-token
  const liquidityFeeRate = 5;
  const marketingFeeRate = 0;
  const burnFeeRate = 0;
  const buyBackFeeRate = 0;
  
  //separate buy Fees
  const hasSeparateBuyFees = false;  // true if contract has separate buy fees, and change the following values if true
  const buyDividendRewardFeeRate = 0; // dividend-paying-token only
  const buyReflectFeeRate = 0;
  const buyLiquidityFeeRate = 0;
  const buyMarketingFeeRate = 0;
  const buyBurnFeeRate = 0;
  const buyBuyBackFeeRate = 0;

  //separate sell Fees
  const hasSeparateSellFees = false;  // true if contract has separate sell fees, and change the following values if true
  const sellDividendRewardFeeRate = 0;
  const sellReflectFeeRate = 0;
  const sellLiquidityFeeRate = 0;
  const sellMarketingFeeRate = 0;
  const sellBurnFeeRate = 0;
  const sellBuyBackFeeRate = 0;

  // true if only selling tokens can trigger addLiuqidity()
  const onlySellToTriggerAddLiquidity = false;  

  // min number to add liquidity in finney (in finney, 1 ether == 1000 finney)
  // don't change it if no addLiquidity() function in contract
  const numToAddliquidityinFinney = 500000;   // 500000 finney == 500 ether

  // don't change this
  let numToAddliquidity;

  beforeEach(async () => {
    SafemoonInstance = await Safemoon.new();
    SafemoonAddress = SafemoonInstance.address;
    SafemoonInstance = await new web3.eth.Contract(compiledSafemoon.abi, SafemoonAddress);

    PancakeRouterInstance = await new web3.eth.Contract(compiledRouter.abi, PancakeRouterAddress);
    const factoryAddress = await PancakeRouterInstance.methods.factory().call();
    const factoryInstance = await new web3.eth.Contract(compiledFactory.abi, factoryAddress);
    WBNBAddress = await PancakeRouterInstance.methods.WETH().call();
    PairAddress = await factoryInstance.methods.getPair(SafemoonAddress, WBNBAddress).call();

    // addLiquidityEth
    numToAddliquidity = toWei(numToAddliquidityinFinney.toString());

    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000000000000')).send({from: deployer}); // approve
    await PancakeRouterInstance.methods.addLiquidityETH(SafemoonAddress, numToAddliquidity, 0, 0, SafemoonAddress, 2639271011)
        .send({ from: deployer, value: toWei('500'), gas: 1200000000 }); // add LiquidityETH 500 BNB / 500 ether Safemoon
  });

  it('values of parameters are legal', async () => {
    if (hasDividend) {
        assert.ok(isDividendBNB || !dividendTokenAddress, "modify isDividendBNB or dividendTokenAddress");
    }
    assert.ok(!(dividendRewardFeeRate == 0 && reflectFeeRate == 0 && liquidityFeeRate == 0 && marketingFeeRate == 0 && burnFeeRate == 0),
              "check parameters setting for standard transfer fees" 
              );

    assert.ok(!hasSeparateBuyFees ||
              !(buyDividendRewardFeeRate == 0 && buyReflectFeeRate == 0 && buyLiquidityFeeRate == 0 && buyMarketingFeeRate == 0 && buyBurnFeeRate == 0),
              "check parameters setting for buy fees "
              );
    
    assert.ok(!hasSeparateSellFees ||
              !(sellDividendRewardFeeRate == 0 && sellReflectFeeRate == 0 && sellLiquidityFeeRate == 0 && sellMarketingFeeRate == 0 && sellBurnFeeRate == 0),
              "check parameters setting for sell fees"
              );
  });

  it('trigger addliquidity() automatically once', async () => {
    const anyAccount = accounts[6];

    await SafemoonInstance.methods.transfer(anyAccount, 10**6)
    .send({from: deployer, gas: 1200000000});

    await SafemoonInstance.methods.transfer(SafemoonAddress, numToAddliquidity)
      .send({from: deployer, gas: 1200000000});
    
    // balances before auto addLiquidity 
    const pairSafemoonBalance0 = await balanceOf(SafemoonInstance, PairAddress);
    let contractSafemoonBalance = await balanceOf(SafemoonInstance, SafemoonAddress);
    let s0 = contractSafemoonBalance;
    let s2 = numToAddliquidity;

    // only compare the first 2 digits
    assert.ok(s0.length == s2.length && s0.substring(0, 2) == s2.substring(0, 2), "deployer is not excluded from fees")

    contractSafemoonBalance = await balanceOf(SafemoonInstance, SafemoonAddress);

    await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000')).send({from: anyAccount}); // approve
    // trigger auto addLiquidity when sell/standard transfer
    if (onlySellToTriggerAddLiquidity) {
      const contractSafemoonBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);
      await SafemoonInstance.methods.transfer(accounts[1], 10**5)
        .send({from: anyAccount, gas: 1200000000});
      const contractSafemoonBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);

      assert.ok(contractSafemoonBalance1 >= contractSafemoonBalance0, "standard transfer triggers addLiquidity(), check if onlySellToTriggerAddLiquidity should be false")

      //sell to trigger addLiquidity()
      const path = new Array(SafemoonAddress, WBNBAddress);
      await PancakeRouterInstance.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(10**5, 0, path, anyAccount, 2639271011)
        .send({from: anyAccount, gas: 12000000});
    } else {
      await SafemoonInstance.methods.transfer(accounts[1], 10**5)
        .send({from: anyAccount, gas: 1200000000});
    }
    
    const pairSafemoonBalance1 = await balanceOf(SafemoonInstance, PairAddress);
    s0 = pairSafemoonBalance0;
    let s1 = pairSafemoonBalance1;
    assert.ok(s1.length > s0.length || s1.substring(0, 2) > s0.substring(0, 2), "addLiquidity() has not been triggered")

    // only compare the first 5 digits, because the pair could get reflect
    if (s1.length > s0.length) {
        assert.equal(s1.substring(0, 6) - s0.substring(0, 5), s2.substring(0, 5) * (100 - walletFee) / 100, "the amount of tokens added to the pool is not enough")
    } else if (s0.length == s2.length) {
        assert.equal(s1.substring(0, 5) - s0.substring(0, 5), s2.substring(0, 5) * (100 - walletFee) / 100, "the amount of tokens added to the pool is not enough");
    } else {
        assert.equal(s1.substring(0, 5) - s0.substring(0, 5), s2.substring(0, 4) * (100 - walletFee) / 100, "the amount of tokens added to the pool is not enough");
    }

    contractSafemoonBalance = await balanceOf(SafemoonInstance, SafemoonAddress);
    assert.ok(contractSafemoonBalance <= 10**5, "could be taken fee when addLiquidity()");
  });

  it('trigger addliquidity() automatically 10 times', async () => {
    const anyAccount = accounts[6];

    for (let i = 0; i < 10; i++) {
        await SafemoonInstance.methods.transfer(anyAccount, 10**6)
            .send({from: deployer, gas: 1200000000});

        await SafemoonInstance.methods.transfer(SafemoonAddress, numToAddliquidity)
            .send({from: deployer, gas: 1200000000});
        
        // balances before auto addLiquidity 
        const pairSafemoonBalance0 = await balanceOf(SafemoonInstance, PairAddress);
        let contractSafemoonBalance = await balanceOf(SafemoonInstance, SafemoonAddress);
        let s0 = contractSafemoonBalance;
        let s2 = numToAddliquidity;

        assert.ok(s0.length == s2.length && s0.substring(0, 2) == s2.substring(0, 2), "deployer is not excluded from fees")

        await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('100000')).send({from: anyAccount}); // approve
        // trigger auto addLiquidity when sell/standard transfer
        if (onlySellToTriggerAddLiquidity) {
            await SafemoonInstance.methods.transfer(accounts[1], 10**5)
                .send({from: anyAccount, gas: 1200000000});
            const contractSafemoonBalance2 = await balanceOf(SafemoonInstance, SafemoonAddress);
            assert.ok(contractSafemoonBalance2 - contractSafemoonBalance0 < 10**5, "standard transfer triggers addLiquidity(), check if onlySellToTriggerAddLiquidity should be false")

            const path = new Array(SafemoonAddress, WBNBAddress);
            await PancakeRouterInstance.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(10**5, 0, path, anyAccount, 2639271011)
                .send({from: anyAccount, gas: 12000000});
        } else {
            await SafemoonInstance.methods.transfer(accounts[1], 10**5)
                .send({from: anyAccount, gas: 1200000000});
        }
        const pairSafemoonBalance1 = await balanceOf(SafemoonInstance, PairAddress);
        s0 = pairSafemoonBalance0;
        let s1 = pairSafemoonBalance1;
        assert.ok(s1.length > s0.length || s1.substring(0, 2) > s0.substring(0, 2), "addLiquidity() has not been triggered")
        if (s1.length > s0.length) {
            assert.equal(s1.substring(0, 6) - s0.substring(0, 5), s2.substring(0, 5) * (100 - walletFee) / 100, "the amount of tokens added to the pool is not enough")
        } else if (s0.length == s2.length) {
            assert.equal(s1.substring(0, 5) - s0.substring(0, 5), s2.substring(0, 5) * (100 - walletFee) / 100, "the amount of tokens added to the pool is not enough");
        } else {
            assert.equal(s1.substring(0, 5) - s0.substring(0, 5), s2.substring(0, 4) * (100 - walletFee) / 100, "the amount of tokens added to the pool is not enough");
        }

        contractSafemoonBalance = await balanceOf(SafemoonInstance, SafemoonAddress);
        assert.ok(contractSafemoonBalance <= 10**5, "could be taken fee when addLiquidity()");
    }
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

    const totalFeeRates = dividendRewardFeeRate + reflectFeeRate + liquidityFeeRate + marketingFeeRate + burnFeeRate + buyBackFeeRate;

    assert.equal(senderContractSafemoonBalance1, 0, "tokens are not correctly deducted from sender");//tokens are correctly deducted from sender
    assert.ok(fromWei((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0).toString()) >= (100 - totalFeeRates).toString(),'receiver doesnt get enough fund from tx');//receiver 
    assert.ok(fromWei((contractSafemoonBalance1 - contractSafemoonBalance0).toString()) >= liquidityFeeRate.toString(),'Safemoon contract doesnt get enough liquidityFee');//take liqudity fee
    
    if (reflectFeeRate > 0) {
      assert.ok((holderContractSafemoonBalance0 < holderContractSafemoonBalance1),'holder doesnt receive reflection');//check reflect
    }
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

      const totalFeeRates = dividendRewardFeeRate + reflectFeeRate + liquidityFeeRate + marketingFeeRate + burnFeeRate + buyBackFeeRate;
  
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
        assert.ok(fromWei(((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0) * 100).toString()) >= (100 - totalFeeRates).toString(),'receiver doesnt get enough fund from tx');
        assert.ok(fromWei(((contractSafemoonBalance1 - contractSafemoonBalance0) * 100).toString()) >= liquidityFeeRate.toString(),'Safemoon contract doesnt get enough liquidityFee');

        if (reflectFeeRate > 0) {
          assert.ok((holderContractSafemoonBalance0 < holderContractSafemoonBalance1),'holder doesnt receive reflection');
        }
      }
    });

    it('Contract can receive BNB', async () => {
        const sender = accounts[1];
        const contractBNB0 = await getBalanceBNB(SafemoonAddress);
        // send bnb
        await web3.eth.sendTransaction({from: sender, to: SafemoonAddress, value: toWei('100')});
        const contractBNB1 = await getBalanceBNB(SafemoonAddress);
        assert.equal(fromWei((contractBNB1 - contractBNB0).toString()), '100', "contract doesn't receive all BNB");
    });

    it('Buy tokens from Router', async () => {
        const buyer = accounts[1];
        const otherOne = accounts[2];
    
        // transfer tokens to otherOne
        await SafemoonInstance.methods.transfer(otherOne, numToAddliquidity)
          .send({from: deployer, gas: 1200000000});
        const otherOneBalance0 = await balanceOf(SafemoonInstance, otherOne);
        
        const contractBalance0 = await balanceOf(SafemoonInstance, SafemoonAddress);
        const buyerBalance0 = await balanceOf(SafemoonInstance, buyer);
    
        // buy tokens
        const BuyTokenNumberinFinney = numToAddliquidityinFinney / 10;
        const path = new Array(WBNBAddress, SafemoonAddress);
        await PancakeRouterInstance.methods.swapETHForExactTokens(toWei(BuyTokenNumberinFinney.toString()), path, buyer, 2639271011)
          .send({from: buyer, value: toWei('1000'), gas: 12000000});
    
        // fee setting
        let _dividendRewardFeeRate = dividendRewardFeeRate;
        let _reflectFeeRate = reflectFeeRate;
        let _liquidityFeeRate = liquidityFeeRate;
        let _marketingFeeRate = marketingFeeRate;
        let _burnFeeRate = burnFeeRate;
        let _buyBackFeeRate = buyBackFeeRate;
    
        if (hasSeparateBuyFees) {
          _dividendRewardFeeRate = buyDividendRewardFeeRate;
          _reflectFeeRate = buyReflectFeeRate;
          _liquidityFeeRate = buyLiquidityFeeRate;
          _marketingFeeRate = buyMarketingFeeRate;
          _burnFeeRate = buyBurnFeeRate;
          _buyBackFeeRate = buyBuyBackFeeRate;
        }
    
        const dividendRewardFeeinFinney = BuyTokenNumberinFinney * _dividendRewardFeeRate / 100;
        const reflectFeeinFinney = BuyTokenNumberinFinney * _reflectFeeRate / 100;
        const liquidityFeeinFinney = BuyTokenNumberinFinney * _liquidityFeeRate / 100;
        const marketingFeeinFinney = BuyTokenNumberinFinney * _marketingFeeRate / 100;
        const burnFeeinFinney = BuyTokenNumberinFinney * _burnFeeRate / 100;
        const buyBackFeeinFinney = BuyTokenNumberinFinney * _buyBackFeeRate / 100;
        const sumFeeinFinney = dividendRewardFeeinFinney + reflectFeeinFinney + liquidityFeeinFinney + marketingFeeinFinney + burnFeeinFinney + buyBackFeeinFinney;
    
         // reflectFee
        const otherOneBalance1 = await balanceOf(SafemoonInstance, otherOne);
        if (_reflectFeeRate > 0) {
            assert.ok(otherOneBalance1 > otherOneBalance0, "no reflect!");
        }
    
        const contractBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);
        const buyerBalance1 = await balanceOf(SafemoonInstance, buyer);
    
        // because of reflect fees and Swap fees, only test if they are roughly equal
        const deltabuyerBalance = BigInt(buyerBalance1 - buyerBalance0);
        const shouldReceiveTokens = toWei((BuyTokenNumberinFinney - sumFeeinFinney).toString());
        const delta0 = Math.abs(deltabuyerBalance.toString() - shouldReceiveTokens);
        assert.ok(delta0 * 1000 / shouldReceiveTokens < 1, "buyer doesn't get enough tokens");  // allow 0.1% diff
    
        let feesToContract = liquidityFeeinFinney;
        if (isAllFeeSentToContract) {
            feesToContract = sumFeeinFinney;
        }
    
        // test fees
        const deltaContractBalance = BigInt(contractBalance1 - contractBalance0);
        const fees = toWei(feesToContract.toString());
        const delta1 = Math.abs(deltaContractBalance.toString() - fees);
        assert.ok(delta1 * 1000 / fees < 1, 'fees are not sent to the contract when buy, or parameter isAllFeeSentToContract are not set correctly');  // allow 0.1% diff
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
        const pairBalance0 =  await balanceOf(SafemoonInstance, PairAddress);
    
        //sell tokens
        const sellTokenNumberinFinney = numToAddliquidityinFinney;
        await SafemoonInstance.methods.approve(PancakeRouterAddress, toWei('1000000000000000')).send({from: seller});
        const path = new Array(SafemoonAddress, WBNBAddress);
        await PancakeRouterInstance.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(toWei(sellTokenNumberinFinney.toString()), 0, path, seller, 2639271011)
          .send({from: seller, gas: 12000000});
    
        // fee setting
        let _dividendRewardFeeRate = dividendRewardFeeRate;
        let _reflectFeeRate = reflectFeeRate;
        let _liquidityFeeRate = liquidityFeeRate;
        let _marketingFeeRate = marketingFeeRate;
        let _burnFeeRate = burnFeeRate;
        let _buyBackFeeRate = buyBackFeeRate;
    
        if (hasSeparateSellFees) {
          _dividendRewardFeeRate = sellDividendRewardFeeRate;
          _reflectFeeRate = sellReflectFeeRate;
          _liquidityFeeRate = sellLiquidityFeeRate;
          _marketingFeeRate = sellMarketingFeeRate;
          _burnFeeRate = sellBurnFeeRate;
          _buyBackFeeRate = sellBuyBackFeeRate;
        }
    
        const dividendRewardFeeinFinney = sellTokenNumberinFinney * _dividendRewardFeeRate / 100;
        const reflectFeeinFinney = sellTokenNumberinFinney * _reflectFeeRate / 100;
        const liquidityFeeinFinney = sellTokenNumberinFinney * _liquidityFeeRate / 100;
        const marketingFeeinFinney = sellTokenNumberinFinney * _marketingFeeRate / 100;
        const burnFeeinFinney = sellTokenNumberinFinney * _burnFeeRate / 100;
        const buyBackFeeinFinney = sellTokenNumberinFinney * _buyBackFeeRate / 100;
        const sumFeeinFinney = dividendRewardFeeinFinney + reflectFeeinFinney + liquidityFeeinFinney + marketingFeeinFinney + burnFeeinFinney + buyBackFeeinFinney;
    
         // reflectFee
        const otherOneBalance1 = await balanceOf(SafemoonInstance, otherOne);
        if (_reflectFeeRate > 0) {
          assert.ok(otherOneBalance1 > otherOneBalance0, "no reflect!");
        } 
    
        const contractBalance1 = await balanceOf(SafemoonInstance, SafemoonAddress);
        const pairBalance1 =  await balanceOf(SafemoonInstance, PairAddress);
    
        // because of reflect fees and Swap fees, only test if they are roughly equal
        const deltaPairBalance = BigInt(pairBalance1 - pairBalance0);
        const shouldAddToPairTokens = toWei((sellTokenNumberinFinney - sumFeeinFinney).toString());
        const delta0 = Math.abs(deltaPairBalance.toString() - shouldAddToPairTokens);
    
        assert.ok(delta0 * 1000 / shouldAddToPairTokens < 1, "pair doesn't get enough tokens");  // allow 0.1% diff
        
        let feesToContract = liquidityFeeinFinney;
        if (isAllFeeSentToContract) {
            feesToContract = sumFeeinFinney;
        }
    
        // test fees
        const deltaContractBalance = BigInt(contractBalance1 - contractBalance0);
        const fees = toWei(feesToContract.toString());
        const delta1 = Math.abs(deltaContractBalance.toString() - fees);
        assert.ok(delta1 * 1000 / fees < 1, 'fees are not sent to the contract when sell, or parameter isAllFeeSentToContract are not set correctly');  // allow 0.1% diff
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

const fromWeiToSzabo = (numString) => {
	return web3.utils.fromWei(numString, 'szabo');
}

const fromWeiToFinney = (numString) => {
	return web3.utils.fromWei(numString, 'finney');
}

const fromWei = (numString) => {
	return web3.utils.fromWei(numString, 'finney');
}

const toFinney = (numString) => {
	return web3.utils.toWei(numString, 'finney');
}
