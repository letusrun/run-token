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

        // foreach transactions, find pubkeys transfer SOL to owner
        const transaction = new Transaction();
        const values = [];
        for (const item of txs) {
          const instructions = item.transaction.message.instructions;
          for (const item2 of instructions) {
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
                // ignore tiny transfer, at least buy 300 tokens
                if (info.lamports / LAMPORTS_PER_SOL < 0.01) continue;

                // transfer token to source
                const trans = await transferToken(
                  new PublicKey(info.source),
                  new BN(info.lamports).mul(new BN(TOKEN_PER_SOL))
                );
                transaction.add(trans);

                values.push(info);
              }
            }
          }
        }

        if (transaction.instructions.length) {
          // send in one time
          const tx = await provider.sendAndConfirm(transaction);

          // add transfer tx to db
          for (const i in values) values[i].tokenTx = tx;
          console.log("Transfer tokens tx", tx);
        }

        // record slot transactions
        await db.setItem("slot_" + context.slot, values);
      } catch (e) {
        console.error(`Error slot: ${context.slot}:`, e);
        // record errors
        let errors = await db.getItem("error");
        if (!errors) errors = [];
        errors.push(context.slot);
        await db.setItem("error", errors);
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
  const res = await connection.getBlockSignatures(slot, "confirmed");
  console.log("Signatures", res.signatures.length);
  return res;
}

// too many signatures, split transactions
async function getParsedTransactions(signatures: string[]) {
  const txs: ParsedTransactionWithMeta[] = [];
  const batchSize = 100; // 每批次处理的签名数量

  for (let i = 0; i < signatures.length; i += batchSize) {
    console.log("Batch", i % batchSize);
    const batchSignatures = signatures.slice(i, i + batchSize);
    const batchTxs = await connection.getParsedTransactions(
      batchSignatures,
      "confirmed"
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
