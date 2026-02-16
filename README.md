# anchor-escrow-2026

Anchor escrow program on Solana (make, take, refund).

- **Program ID:** `78WQ77s2Jxo5NQDjD1NW65Z9GbmYHNzMoTn8r8SnXway`
- **Instructions:** make, refund, take

**Prerequisites**

- Rust, Solana CLI, Anchor CLI
- Node.js, yarn

**Setup**

- `yarn install`
- Set `[provider] wallet` in `Anchor.toml` to your keypair path (or use default)

**Build**

- `anchor build`

**Test**

- Start a local validator (e.g. `solana-test-validator` or `surfpool start`), then:
- `anchor test --skip-local-validator`
- Or full run: `anchor test` (starts validator, deploys, runs tests)

**Tests**

- make — maker creates escrow and deposits token A
- refund — maker cancels and reclaims token A
- take — taker sends token B to maker, receives token A from vault
