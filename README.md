# The Runner's Token

**$RUN**

*A token to unlock the world*

## Introduction

This is a fun and popular **MEME** token for the runners, for whom loves the culture of RUN, for the Runner Comminuity, for the Web3!

## What You Will Need

- Node.js installed
- npm or yarn installed
- Rust and Cargo latest version installed
- Solana CLI latest version installed
- Anchor CLI latest version installed
- TypeScript latest version installed

## Dependency Versions

| Dependency   | Version |
|--------------|---------|
| node.js      | 18.16.1 |
| anchor cli   | 0.29    |
| solana cli   | 1.16.5  |
| tsc          | 5.0.2   |

To ensure you are ready to start, verify that you have installed Solana 1.16+ and Anchor 0.28+. You can do this by running the following commands:

## Run Test

```bash
yarn
```

or

```bash
npm install
```

Download the meta program

```bash
solana program dump --url mainnet-beta TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA meta_program.so
```

Run unit test in `tests/`

```bash
anchor test
```

All the sol code will be automatically compile, build, and deploy during test in local net.

## Run Deploy

Check the chain network you want to deploy in `Anchor.toml`

```bash
anchor deploy
```

## Run Migrate

If you want to deploy with some initial insturctions, you need to use `migrate`

```bash
anchor migrate
```
