import * as anchor from "@coral-xyz/anchor";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import {
  Connection,
  LAMPORTS_PER_SOL,
  ParsedTransactionWithMeta,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { BN } from "bn.js";
import db from "node-persist";
import { readFileSync } from "fs";

// modify MINT and NETWORK when you migrate to create a new token
const MINT = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(".anchor/mint_account.json", "utf8")))
).publicKey.toBase58();
const TOKEN_PER_SOL = 33000;

// get provider, wallet, connection
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const wallet = provider.wallet as anchor.Wallet;
const connection = provider.connection;

async function main() {
  await db.init({ dir: "./db/transfer_log" });

  // simulate a buyer keep buying
  // await simulate(101, 10, 10);

  // get latest transactions
  watchTx(wallet.publicKey);
}

// watch account change tx
function watchTx(pubkey: PublicKey) {
  const confirmedConnection = new Connection(
    connection.rpcEndpoint,
    "confirmed"
  );
  confirmedConnection.onAccountChange(
    pubkey,
    async (accountInfo, context) => {
      console.log(`Tx slot: ${context.slot}`);
      await db.setItem("current", context.slot);
      // Additional processing can be done here
      try {
        // extract transactions
        const res = await getBlockSignatures(context.slot);
        const txs = await getParsedTransactions(res.signatures);

        // foreach transactions
        const transaction = new Transaction();
        const values = [];
        const keys = [];
        for (const item of txs) {
          for (const item2 of item.transaction.message.instructions) {
            // is system instruction?
            if (item2.programId.equals(SystemProgram.programId)) {
              const { type, info } = item2["parsed"];
              if (
                type &&
                info &&
                type === "transfer" &&
                new anchor.web3.PublicKey(info.destination).equals(
                  wallet.publicKey
                )
              ) {
                console.log("Receive from", info.source);
                console.log("Receive SOL", info.lamports / LAMPORTS_PER_SOL);
                // ignore small transfer, at least buy 3 token
                if (info.lamports / LAMPORTS_PER_SOL < 0.0001) return;

                // transfer token to source
                const trans = await transferToken(
                  new PublicKey(info.source),
                  new BN(info.lamports).mul(new BN(TOKEN_PER_SOL))
                );
                transaction.add(trans);

                // log
                const key = item.transaction.signatures[0];
                keys.push(key);
                values.push(info);
                await db.setItem(key, info);
              }
            }
          }
        }

        if (transaction.instructions.length) {
          // send one time
          const tx = await provider.sendAndConfirm(transaction);

          // add transfer tx to db
          for (const item of keys) {
            const value = await db.getItem(item);
            value.tokenTx = tx;
            await db.setItem(item, value);
          }
          console.log("Transfer tokens tx", tx);
        }
      } catch (e) {
        console.error(`Error fetching block for slot ${context.slot}:`, e);
        await db.setItem(context.slot.toString(), e.message);
      } finally {
        console.log(`Total SOL: ${accountInfo.lamports / LAMPORTS_PER_SOL}`);
      }
    },
    "confirmed"
  );
}

// get associate token account
async function getATA(pubkey: PublicKey) {
  return await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    new anchor.web3.PublicKey(MINT),
    pubkey
  );
}

// transfer token to pubkey
async function transferToken(pubkey: PublicKey, amount: anchor.BN) {
  // get token accounts
  const from = await getATA(wallet.publicKey);
  const to = await getATA(pubkey);
  console.log("Transfer token to", pubkey.toBase58());
  console.log(
    "Transfer token amount",
    BigInt(amount.toString()) / BigInt(LAMPORTS_PER_SOL)
  );

  return createTransferInstruction(
    from.address,
    to.address,
    wallet.publicKey,
    BigInt(amount.toString())
  );
}

async function getBlockSignatures(slot: number) {
  return await connection.getBlockSignatures(slot, "confirmed");
}

// too many signatures, split transactions
async function getParsedTransactions(signatures: string[]) {
  const txs: ParsedTransactionWithMeta[] = [];
  const batchSize = 100; // 每批次处理的签名数量

  for (let i = 0; i < signatures.length; i += batchSize) {
    const batchSignatures = signatures.slice(i, i + batchSize);

    // 获取当前批次的解析交易
    const batchTxs = await Promise.all(
      batchSignatures.map((signature) =>
        connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        })
      )
    );

    txs.push(...batchTxs); // 将当前批次的解析交易追加到结果数组中
    await sleep(500);
  }

  return txs;
}

// transfer some SOL to pubkey
async function transferSOL(pubkey: PublicKey, amount: number) {
  const transaction = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: pubkey,
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );
  return await provider.sendAndConfirm(transaction);
}

// simulate to buy
async function simulate(drop: number, buy: number, max: number) {
  const recipient = anchor.web3.Keypair.generate();
  console.log("Send some SOL to recipient", recipient.publicKey.toBase58());
  const tx = await transferSOL(recipient.publicKey, drop);
  const balance =
    (await connection.getBalance(recipient.publicKey)) / LAMPORTS_PER_SOL;
  console.log("Send SOL tx", tx);
  console.log("Recipient balance", balance);

  // simulate buy token, 3s buy once
  let count = 0;
  const interval = setInterval(() => {
    // recipient send SOL to wallet.publicKey
    const transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: recipient.publicKey,
        toPubkey: wallet.publicKey,
        lamports: buy * LAMPORTS_PER_SOL,
      })
    );
    anchor.web3.sendAndConfirmTransaction(connection, transaction, [recipient]);

    count++;
    if (count === max) {
      clearInterval(interval);
      getATA(recipient.publicKey)
        .then((acc) => {
          console.log(
            "Recipient final token amount",
            acc.amount / BigInt(10) ** BigInt(9)
          );
          return connection.getBalance(recipient.publicKey);
        })
        .then((balance) => console.log("Recipient final SOL amount", balance));
    }
  }, 3000);
}

async function sleep(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

main();
