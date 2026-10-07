const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AbiCoder, Interface } = require('ethers');
function load(file, extra={}) { const context = {window:{}, TextEncoder,TextDecoder,setTimeout, ...extra}; vm.createContext(context); vm.runInContext(fs.readFileSync(file,'utf8'),context); return context; }
(async()=>{
 let activeChain='0x1';
 const chainContext=load('Web/dist/chain.js');
 chainContext.window.ethereum={request:async({method})=>method==='eth_chainId'?activeChain:null};
 await assert.rejects(chainContext.window.TurboChain.ensureRobinhood(),/requested network/);
 activeChain='0x1237';assert.equal((await chainContext.window.TurboChain.ensureRobinhood()).chainId,4663);
 const deploy=load('Web/dist/deploy.js').window.TurboDeploy;
 const encoded=deploy.encodeConstructor('A token name longer than thirty two bytes','TST',123n);
 assert.deepEqual(Array.from(AbiCoder.defaultAbiCoder().decode(['string','string','uint256'],'0x'+encoded)),['A token name longer than thirty two bytes','TST',123n]);
 let sent=0;
 const p={request:async({method})=>{if(method==='eth_requestAccounts')return ['0x'+'1'.repeat(40)];if(method==='eth_estimateGas')throw Error('insufficient funds');if(method==='eth_sendTransaction')sent++;}};
 const d=load('Web/dist/deploy.js',{TurboChain:{ensureRobinhood:async()=>({chainId:4663})}});d.window.ethereum=p;d.window.TurboTokenArtifact={bytecode:'00'};
 await assert.rejects(d.window.TurboDeploy.deploy({name:'Test',symbol:'TST',supply:'1'}),/insufficient funds/);assert.equal(sent,0);
 let tx;
 const chain={ensureRobinhood:async()=>{},rpc:async(method)=>{if(method==='eth_call')return '0x'+(1000n).toString(16).padStart(64,'0');throw Error('RPC unavailable');}};
 const c=load('Web/dist/swap.js',{TurboChain:chain});c.window.ethereum={request:async({method,params})=>{if(method==='eth_requestAccounts')return ['0x'+'1'.repeat(40)];if(method==='eth_sendTransaction'){tx=params[0];return '0x'+'a'.repeat(64);}}};
 const swap=c.window.TurboSwap;
 assert.throws(()=>swap.parseUnits('0.0000001',6),/decimal/);assert.equal(swap.parseUnits('1.25',6),1250000n);
 await assert.rejects(swap.buy({token:'0x'+'2'.repeat(40),amountWei:100n}),e=>e.txHash==='0x'+'a'.repeat(64));
 const iface=new Interface(['function multicall(uint256,bytes[])','function exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))']);
 const calls=iface.decodeFunctionData('multicall',tx.data);const swapArgs=iface.decodeFunctionData('exactInputSingle',calls[1][0])[0];assert.equal(swapArgs[4],100n);assert.equal(swapArgs[5],990n);
 tx=null;await assert.rejects(swap.buy({token:'0x'+'2'.repeat(40),amountWei:100n,slippageBps:10000}),/Slippage/);assert.equal(tx,null);
 console.log('PASS: constructor ABI, gas failure blocks send, precision, transaction hash preservation, router ABI, minimum output and slippage guard');
})().catch(e=>{console.error(e);process.exit(1)});
