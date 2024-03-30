import * as anchor from "@coral-xyz/anchor";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { BN } from "bn.js";

import db from "node-persist";

// modify MINT and NETWORK when you migrate to create a new token
const MINT = "8MxSS1hTph3XsgpzZsc4uM6d1Cw19uzvGEMr1AJaVNWB";
const NETWORK = "http://localhost:8899";
const TOKEN_PER_SOL = 66000;

// get provider, wallet, connection
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const wallet = provider.wallet as anchor.Wallet;
const connection = provider.connection;

async function main() {
  await db.init({ dir: "./db/transfer_log" });

  // simulate a buyer keep buying
  await simulate(101, 10, 10);

  // get latest transactions
  watchTx(wallet.publicKey);
}

// watch account change tx
function watchTx(pubkey: PublicKey) {
  const connection = new Connection(NETWORK, "confirmed");
  connection.onAccountChange(pubkey, async (accountInfo, context) => {
    console.log(`Transaction detected in slot: ${context.slot}`);
    console.log(`New balance: ${accountInfo.lamports / LAMPORTS_PER_SOL} SOL`);
    // Additional processing can be done here
    try {
      // extract transactions
      const res = await connection.getBlockSignatures(
        context.slot,
        "confirmed"
      );
      const txs = await connection.getParsedTransactions(res.signatures);

      // foreach transactions
      for (const item of txs) {
        for (const item2 of item.transaction.message.instructions) {
          // is system instruction?
          if (item2.programId.equals(SystemProgram.programId)) {
            console.log(item2);
            const { type, info } = item2["parsed"];
            if (
              type &&
              info &&
              type === "transfer" &&
              new anchor.web3.PublicKey(info.destination).equals(
                wallet.publicKey
              )
            ) {
              // transfer token to source
              const tokenTx = await transferToken(
                new PublicKey(info.source),
                new BN(info.lamports)
                  .div(new BN(LAMPORTS_PER_SOL))
                  .mul(new BN(TOKEN_PER_SOL))
                  .toNumber()
              );
              // log
              const value = { ...info, tokenTx };
              const key = item.transaction.signatures[0];
              await db.setItem(key, value);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching block for slot ${context.slot}:`, error);
    }
  });
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
async function transferToken(pubkey: PublicKey, amount: number) {
  // get token accounts
  const from = await getATA(wallet.publicKey);
  const to = await getATA(pubkey);
  console.log("Transfer token to", pubkey.toBase58());

  const transaction = new Transaction();
  transaction.add(
    createTransferInstruction(
      from.address,
      to.address,
      wallet.publicKey,
      BigInt(new BN(amount).mul(new BN(10).pow(new BN(9))).toString())
    )
  );
  return await provider.sendAndConfirm(transaction);
}

// transfer some SOL to pubkey
async function transferSOL(pubkey: PublicKey, amount: number) {
  const transaction = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: pubkey,
      lamports: new BN(amount).mul(new BN(LAMPORTS_PER_SOL)).toNumber(),
    })
  );
  return await provider.sendAndConfirm(transaction);
}

// simulate to buy
async function simulate(drop: number, buy: number, max: number) {
  const recipient = anchor.web3.Keypair.generate();
  console.log("Send some SOL to recipient", recipient.publicKey);
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
        lamports: new BN(buy).mul(new BN(LAMPORTS_PER_SOL)).toNumber(),
      })
    );
    anchor.web3.sendAndConfirmTransaction(connection, transaction, [recipient]);

    count++;
    if (count === max) {
      clearInterval(interval);
      getATA(recipient.publicKey)
        .then((acc) => {
          console.log("Recipient final token amount", acc.amount);
          return connection.getBalance(recipient.publicKey);
        })
        .then((balance) => console.log("Recipient final SOL amount", balance));
    }
  }, 3000);
}

main();
