import * as fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "bn.js";
import { homedir } from "os";
import { join } from "path";

// first you need to generate a new solana key, named ~/.config/solana/id2.json
const homeDirectory = homedir();
const walletFile = join(homeDirectory, ".config/solana/id2.json");
const transferSol = 1;

// extract wallet, connection
const secretKey = JSON.parse(fs.readFileSync(walletFile, "utf8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
const connection = anchor.AnchorProvider.env().connection;

console.log("Public Addr:", wallet.publicKey.toBase58());

async function main() {
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("SOL Balance", balance);
  // receive by token owner
  const recipient = anchor.AnchorProvider.env().wallet as anchor.Wallet;
  // recipient send SOL to wallet.publicKey
  const transaction = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipient.publicKey,
      lamports: new BN(transferSol).mul(new BN(LAMPORTS_PER_SOL)).toNumber(),
    })
  );
  console.log("Transfer SOL to owner...");
  const tx = await anchor.web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [wallet]
  );
  console.log("Transfer tx", tx);
}

main();
