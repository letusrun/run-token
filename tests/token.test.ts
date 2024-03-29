import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Metaplex } from "@metaplex-foundation/js";
import {
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createBurnInstruction,
} from "@solana/spl-token";
import { Token } from "../target/types/token";

describe("Transfer Tokens", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const dataAccount = anchor.web3.Keypair.generate();
  const mintAccount = anchor.web3.Keypair.generate();
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const program = anchor.workspace.Token as Program<Token>;

  const nftTitle = "Test Token";
  const nftSymbol = "TEST";
  const nftUri =
    "https://raw.githubusercontent.com/letusrun/run-token/main/token.json";

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .new()
      .accounts({ dataAccount: dataAccount.publicKey })
      .signers([dataAccount])
      .rpc();
    console.log("Init program tx", tx);
  });

  it("Create an SPL Token!", async () => {
    const metaplex = Metaplex.make(connection);
    const metadataAddress = metaplex
      .nfts()
      .pdas()
      .metadata({ mint: mintAccount.publicKey });

    // Add your test here.
    const tx = await program.methods
      .createTokenMint(
        wallet.publicKey, // freeze authority
        9, // 0 decimals for NFT
        nftTitle, // NFT name
        nftSymbol, // NFT symbol
        nftUri // NFT URI
      )
      .accounts({
        payer: wallet.publicKey,
        mint: mintAccount.publicKey,
        metadata: metadataAddress,
        mintAuthority: wallet.publicKey,
        rentAddress: anchor.web3.SYSVAR_RENT_PUBKEY,
        metadataProgramId: new anchor.web3.PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        ),
      })
      .signers([mintAccount])
      .rpc();
    console.log("Create token tx", tx);
  });

  it("Mint some tokens to token account!", async () => {
    // Wallet's associated token account address for mint
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer, // payer
      mintAccount.publicKey, // mint
      wallet.publicKey // owner
    );

    const tx = await program.methods
      .mintTo(
        new anchor.BN(1680000000).mul(new anchor.BN(10).pow(new anchor.BN(9)))
      )
      .accounts({
        mintAuthority: wallet.publicKey,
        tokenAccount: tokenAccount.address,
        mint: mintAccount.publicKey,
      })
      .rpc();
    console.log("Mint token tx", tx);
    console.log(
      "Token in wallet after mint",
      (
        await getAccount(
          connection,
          await getAssociatedTokenAddress(
            mintAccount.publicKey,
            wallet.publicKey
          )
        )
      ).amount.toString()
    );
  });

  it("Transfer some tokens to another wallet!", async () => {
    // Wallet's associated token account address for mint
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer, // payer
      mintAccount.publicKey, // mint
      wallet.publicKey // owner
    );

    const receipient = anchor.web3.Keypair.generate();
    const receipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer, // payer
      mintAccount.publicKey, // mint account
      receipient.publicKey // owner account
    );

    const tx = await program.methods
      .transferTokens(
        new anchor.BN(80000000).mul(new anchor.BN(10).pow(new anchor.BN(9)))
      )
      .accounts({
        from: tokenAccount.address,
        to: receipientTokenAccount.address,
        owner: wallet.publicKey,
      })
      .rpc();
    console.log("Transfer token tx", tx);
    console.log(
      "Token in wallet after transfer",
      (
        await getAccount(
          connection,
          await getAssociatedTokenAddress(
            mintAccount.publicKey,
            wallet.publicKey
          )
        )
      ).amount.toString()
    );
  });

  it("burn some tokens", async () => {
    const tx = createBurnInstruction(
      await getAssociatedTokenAddress(mintAccount.publicKey, wallet.publicKey),
      mintAccount.publicKey,
      wallet.publicKey,
      BigInt(600000000) * BigInt(10) ** BigInt(9)
    );
    const transaction = new anchor.web3.Transaction().add(tx);
    await provider.sendAndConfirm(transaction);
    console.log(
      "Token in wallet after burn",
      (
        await getAccount(
          connection,
          await getAssociatedTokenAddress(
            mintAccount.publicKey,
            wallet.publicKey
          )
        )
      ).amount.toString()
    );
  });
});
