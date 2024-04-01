<div align=center>
<img src="./icon.png" width=65 height=65/>
</div>
<h1 align=center>The Runner's Token ($RUN)</h1>
<p align=center>Token to unlock the world!</p>

## Introduction

This is a fun and popular **MEME** token for the runners, for whom loves the culture of RUN, for the runner's community, for the Web3!

## What You Will Need

- Node.js installed
- npm or yarn installed
- Rust and Cargo latest version installed
- Solana CLI latest version installed
- Anchor CLI latest version installed
- TypeScript latest version installed

## Dependency Versions

| Dependency | Version |
| ---------- | ------- |
| node.js    | 18.16.1 |
| anchor cli | 0.29    |
| solana cli | 1.16.5  |
| tsc        | 5.0.2   |

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

Implement mocha unit test and run the test in `tests/`

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

If you want to deploy with some initial instructions, you need to use `migrate` and implement the `deploy.js` in `migrates/`

```bash
anchor migrate
```

## How to deploy to local solana-test-validator

First, you need to dump the metadata.so to the local as you will deploy SPL token.

```bash
solana program dump -u m metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s metadata.so
```

Then, you will need to run the `solana-test-validator` using `--bpf-program` to add the `metadata.so`.

```bash
solana-test-validator -r --bpf-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s metadata.so
```

The above method is same with the config `[[test.genesis]]` in `Anchor.toml`.
