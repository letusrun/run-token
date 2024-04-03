import * as fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { homedir } from "os";
import { join } from "path";

// first you need to generate a new solana key, named ~/.config/solana/id2.json
const walletFile = join(homedir(), ".config/solana/id2.json");
const transferSol = 0.1;

// extract wallet, connection
const secretKey = JSON.parse(fs.readFileSync(walletFile, "utf8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
const connection = anchor.AnchorProvider.env().connection;

console.log("Public Addr:", wallet.publicKey.toBase58());

async function main() {
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("SOL Balance", balance / LAMPORTS_PER_SOL);
  // receive by token owner
  const recipient = anchor.AnchorProvider.env().wallet as anchor.Wallet;
  // recipient send SOL to wallet.publicKey
  const transaction = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipient.publicKey,
      lamports: transferSol * LAMPORTS_PER_SOL,
    })
  );
  console.log("Transfer SOL to owner...");
  const tx = await sendAndConfirmTransaction(connection, transaction, [wallet]);
  console.log("Transfer tx", tx);
}

main();
