# Mainnet readiness audit — 2026-10-03

Verdict: a local application with live market reads and wallet-signed transaction paths; not a fully verified production launchpad.

| Feature | Evidence | Status |
| --- | --- | --- |
| Market discovery | DexScreener/CoinGecko/GeckoTerminal requests in Web/dist/data.js; live markets observed in browser | Live reads; subject to API availability |
| Robinhood chain | chainId 4663, RPC fallback and wallet network switching in chain.js | Configured for mainnet |
| Wallet | Injected EVM provider and Reown bundle | Connection paths implemented; real signing session not tested |
| ERC-20 deployment | Bytecode, constructor encoding, wallet send, receipt status and contract address checks in deploy.js | Implemented; no actual mainnet deployment verified in this audit |
| Swap | Router02 ABI, quote, approval, slippage, deadline, wallet send and receipt check in swap.js | Implemented; no actual mainnet buy/sell verified in this audit |
| Token liquidity | No automatic pool creation or liquidity provisioning flow | Not implemented; ERC-20 deployment does not create a tradable launch |
| Bonding curve / fair launch | Launch form now correctly offers fixed-supply ERC-20 only | Not implemented |
| Creator revenue | Client-side fee allocation calculation | Simulator; no payout contract |
| Battles | Votes stored in localStorage | Local demo; no shared standings |
| Watchlist and drafts | localStorage | Functional on this device; no account sync |
| RWA | Market data basket | Discovery only; no issuance/redemption integration |
| Hosting | localhost preview | Not evidence of a public production deployment |

Fixes made during this review: sell now reads decimals for the currently selected token before parsing the amount; chain filter provides recognizable chain marks with keyboard-accessible selection and preserves existing filtering.

Remaining verification: mainnet read-only eth_call simulation against a known liquid pool; wallet connection/account/network changes; test deployment and buy/sell receipts with explicitly selected assets and amounts; production origin/Reown configuration; contract security review; mobile UI verification. No transaction was signed or broadcast during this audit.

Follow-up audit completed locally:
- UI blocks repeated swap submissions while awaiting wallet/RPC and disables trade controls during execution; deployment has an in-progress guard.
- Quote requests are invalidated immediately on input changes, preventing stale responses replacing new input.
- Swap/approval/deployment receipt failures retain the submitted hash and expose an explorer link.
- Deployment gas estimation must succeed; the silent 3,000,000 gas fallback was removed.
- Slippage is bounded to 0–3% and zero minimum output is rejected.
- Battles explicitly identify device-local demo votes; Creator Revenue remains explicitly a simulator.
- Router eth_getCode returned 24,497 bytes from the public mainnet RPC. This proves code exists at the configured address, not its identity or security.
- `npm run test:transactions` passes constructor ABI (long name), gas failure preventing sends, amount precision, receipt-error hash retention, Router02 calldata decoding and slippage/minimum-output guards.
- Browser checks passed: Trade direction labels, invalid-address feedback, slippage selection, page search and launch dialog. Chain filtering returned three Robinhood markets; Battles and Creator Studio demo/simulator labels verified. Earlier desktop navigation checks covered six primary pages. Navigation now resets scroll position.

Outstanding verification and limitations:
- Mobile viewport control timed out repeatedly in the in-app browser; responsive CSS was reviewed/improved but a 390px visual pass is NOT verified. Viewport reset was attempted and also timed out.
- Wallet connection/account/network changes and real signed deploy/buy/sell receipts still require a user-operated wallet session.
- Read-only Quoter eth_call passed on chain 4663 for token 0x79Fe86b963255Ce884bdcaC6388C50a599Ba277f: 0.0001 ETH returned 8190.018732 tokens at fee tier 10000. This is a time-specific technical test, not a token recommendation. Full router execution and signed settlement remain unverified. V4-only pools are unsupported.
- No liquidity creation, shared battles backend, revenue payout contract, production deployment verification or contract security audit.
- In-progress guards last only for the current page session. After timeout or reload, check the explorer before resubmitting; transaction recovery/history remains limited.
- CSS consolidation and exhaustive dialog/browser coverage remain pending.

No transaction was signed or broadcast during the follow-up audit.
