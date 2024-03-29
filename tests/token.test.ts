import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Metaplex } from "@metaplex-foundation/js";
import { getOrCreateAssociatedTokenAccount, } from "@solana/spl-token";
import { Token } from "../target/types/token";

describe("Transfer Tokens", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const dataAccount = anchor.web3.Keypair.generate();
  const mintKeypair = anchor.web3.Keypair.generate();
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const program = anchor.workspace.Token as Program<Token>;

  const nftTitle = "Test Token";
  const nftSymbol = "TEST";
  const nftUri = "https://raw.githubusercontent.com/letusrun/run-token/main/token.json";

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
      .metadata({ mint: mintKeypair.publicKey });

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
        mint: mintKeypair.publicKey,
        metadata: metadataAddress,
        mintAuthority: wallet.publicKey,
        rentAddress: anchor.web3.SYSVAR_RENT_PUBKEY,
        metadataProgramId: new anchor.web3.PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        ),
      })
      .signers([mintKeypair])
      .rpc();
    console.log("Create token tx", tx);
  });

  it("Mint some tokens to your wallet!", async () => {
    // Wallet's associated token account address for mint
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer, // payer
      mintKeypair.publicKey, // mint
      wallet.publicKey // owner
    );

    const tx = await program.methods
      .mintTo(
        new anchor.BN(150) // amount to mint
      )
      .accounts({
        mintAuthority: wallet.publicKey,
        tokenAccount: tokenAccount.address,
        mint: mintKeypair.publicKey,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("Transfer some tokens to another wallet!", async () => {
    // Wallet's associated token account address for mint
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer, // payer
      mintKeypair.publicKey, // mint
      wallet.publicKey // owner
    );

    const receipient = anchor.web3.Keypair.generate();
    const receipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer, // payer
      mintKeypair.publicKey, // mint account
      receipient.publicKey // owner account
    );

    const tx = await program.methods
      .transferTokens(new anchor.BN(150))
      .accounts({
        from: tokenAccount.address,
        to: receipientTokenAccount.address,
        owner: wallet.publicKey,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });
});
