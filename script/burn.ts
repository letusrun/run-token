import * as anchor from "@coral-xyz/anchor";
import {
  createBurnInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { readFileSync } from "fs";


// get provider, wallet, connection, mintAccount
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const wallet = provider.wallet as anchor.Wallet;
const connection = provider.connection;
const mintAccount = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(".anchor/mint_account.json", "utf8")))
)

async function main() {
    const tx = createBurnInstruction(
      await getAssociatedTokenAddress(mintAccount.publicKey, wallet.publicKey),
      mintAccount.publicKey,
      wallet.publicKey,
      BigInt(840000000) * BigInt(10) ** BigInt(9)
    );
    const transaction = new anchor.web3.Transaction().add(tx);
    const result = await provider.sendAndConfirm(transaction);
    console.log('Burn Result', result)
    console.log(
      "Token in wallet after burn",
      ((
        await getOrCreateAssociatedTokenAccount(
          connection,
          wallet.payer,
          mintAccount.publicKey,
          wallet.publicKey
        )
      ).amount/(BigInt(9) ** BigInt(9))).toString()
    )
}

main()
