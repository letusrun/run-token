const anchor = require("@coral-xyz/anchor");
const idl = {
  election: require("../target/idl/election.json"),
  token: require("../target/idl/token.json"),
};
const { Metaplex } = require("@metaplex-foundation/js");
const { getOrCreateAssociatedTokenAccount } = require("@solana/spl-token");

module.exports = token;

// deploy election
async function election(provider) {
  // Address of the deployed program.
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const dataAccount = anchor.web3.Keypair.generate();
  const wallet = provider.wallet;
  // Generate the program client from IDL.
  const programId = new anchor.web3.PublicKey(idl.election.metadata.address);
  const program = new anchor.Program(idl.election, programId, provider);

  // Add your test here.
  const tx = await program.methods
    .new(wallet.publicKey, dataAccount.publicKey)
    .accounts({ dataAccount: dataAccount.publicKey })
    .signers([dataAccount])
    .rpc();
  console.log("deploy tx", tx);
  console.log("data account public", dataAccount.publicKey.toBase58());
  console.log(
    "Initial SOL in data account",
    (await provider.connection.getBalance(dataAccount.publicKey)) /
      anchor.web3.LAMPORTS_PER_SOL
  );
}

// deploy token
async function token(provider) {
  anchor.setProvider(provider);

  const dataAccount = anchor.web3.Keypair.generate();
  const mintAccount = anchor.web3.Keypair.generate();
  const wallet = provider.wallet;

  // Generate the program client from IDL.
  const programId = new anchor.web3.PublicKey(idl.token.metadata.address);
  const program = new anchor.Program(idl.token, programId, provider);

  const tx = await program.methods
    .new()
    .accounts({ dataAccount: dataAccount.publicKey })
    .signers([dataAccount])
    .rpc();
  console.log("deploy tx", tx);
  console.log("data account public", dataAccount.publicKey.toBase58());
  console.log(
    "Initial SOL in data account",
    (await provider.connection.getBalance(dataAccount.publicKey)) /
      anchor.web3.LAMPORTS_PER_SOL
  );

  console.log("Create token...");

  const connection = provider.connection;
  const metaplex = Metaplex.make(connection);
  const metadataAddress = metaplex
    .nfts()
    .pdas()
    .metadata({ mint: mintAccount.publicKey });

  const name = "Runner's Token";
  const symbol = "RUN";
  const supply = new anchor.BN(1680000000).mul(
    new anchor.BN(10).pow(new anchor.BN(9))
  );
  const url =
    "https://raw.githubusercontent.com/letusrun/run-token/main/token.json";
  // Add your test here.
  const tx1 = await program.methods
    .createTokenMint(wallet.publicKey, 9, name, symbol, url)
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
  console.log("create token tx", tx1);
  console.log("mint account public", mintAccount.publicKey.toBase58());
  console.log("data account public", dataAccount.publicKey.toBase58());

  console.log("mint token to creator wallet...");
  // Wallet's associated token account address for mint
  let tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    mintAccount.publicKey,
    wallet.publicKey
  );

  const tx3 = await program.methods
    .mintTo(
      new anchor.BN(supply) // amount to mint
    )
    .accounts({
      mintAuthority: wallet.publicKey,
      tokenAccount: tokenAccount.address,
      mint: mintAccount.publicKey,
    })
    .rpc();
  console.log("mint token tx", tx3);

  tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    mintAccount.publicKey,
    wallet.publicKey
  );
  console.log("creator token account amount", tokenAccount.amount.toString());
}
