const compiledSafemoon = require("../build/contracts/Safemoon.json");
const compiledERC20 = require("../library/IERC20.json");
const compiledFactory = require("../library/IPancakeFactory.json");
const compiledRouter = require("../library/IUniswapV2Router02.json");

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
  
    // const buybackFeeRate = 5;
    // const marketingFeeRate = 5;
    // const dividendFeeRate = 5;
    // const burnFeeRate = 0;
    const totalFeeRates = 13;
    
    const swapTokensAtAmount = 10000000; // min number to add liquidity in BNB/ETH (update it to match the contract)
    let numToAddliquidity;

    const numToAddliquidityinFinney = 10000; // min number to add liquidity in BNB/ETH (update it to match the contract)

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
        // await PancakeRouterInstance.methods.addLiquidityETH(SafemoonAddress, numToAddliquidity, 0, 0, SafemoonAddress, 2639271011)
        //     .send({ from: deployer, value: toWei('500'), gas: 1200000000 }); // add LiquidityETH 500 BNB / 5000 Safemoon
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
    
        // const totalFeeRates = buybackFeeRate + marketingFeeRate + dividendFeeRate + burnFeeRate;

        // assert.equal(senderContractSafemoonBalance1, 0);//taxes are correctly deducted from sender
        // console.log("left", fromWeiToFinney((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0).toString()));
        // console.log("right",(100 - totalFeeRates).toString());
        assert.ok(fromWeiToFinney((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0).toString()) >= (100 - totalFeeRates).toString(),'receiver doesnt get enough fund from tx');//receiver 
        // assert.ok(fromWeiToFinney((contractSafemoonBalance1 - contractSafemoonBalance0).toString()) >= totalFeeRates.toString(),'Safemoon contract doesnt get enough liquidityFee');//take liqudity fee
        // assert.ok((holderContractSafemoonBalance0 < holderContractSafemoonBalance1),'holder doesnt receive reflection');//check reflect
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
    
          assert.ok(fromWeiToFinney(((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0)*100).toString()) >= (100 - totalFeeRates).toString(),'receiver doesnt get enough fund from tx');//receiver 
          //assert.equal(fromWeiToFinney((senderContractSafemoonBalance0 - senderContractSafemoonBalance1).toString()), `1`);
        //   assert.ok(fromWeiToFinney(((receiverContractSafemoonBalance1 - receiverContractSafemoonBalance0) * 100).toString()) > (100 - reflectFeeRate - liquidityFeeRate - marketingFeeRate - burnFeeRate).toString());
        //   assert.ok(fromWeiToFinney(((contractSafemoonBalance1 - contractSafemoonBalance0) * 100).toString()) >= liquidityFeeRate.toString());
        //   assert.ok(holderContractSafemoonBalance0 < holderContractSafemoonBalance1);
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
        assert.equal(fromWeiToFinney((contractBNB1 - contractBNB0).toString()), '10', "contract doesn't receive 10 BNB");
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
  
  const toFinney = (numString) => {
    return web3.utils.toWei(numString, 'finney');
  }
