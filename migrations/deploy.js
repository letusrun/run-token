const anchor = require("@coral-xyz/anchor");
const { BN } = anchor;
const idl = {
  election: require("../target/idl/election.json"),
  token: require("../target/idl/token.json"),
};
const { Metaplex } = require("@metaplex-foundation/js");
const { getOrCreateAssociatedTokenAccount } = require("@solana/spl-token");
const { writeFileSync, existsSync, readFileSync } = require("fs");

module.exports = token;

const SUPPLY = 1680000000;
const DECIMAL = 9;
const NAME = "Runner's Token";
const SYMBOL = "RUN";
const URL =
  "https://raw.githubusercontent.com/letusrun/run-token/main/token.json";
const supply = new BN(SUPPLY).mul(new BN(10).pow(new BN(9)));

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

  let mintAccount;
  if (existsSync("./mint_account.json"))
    mintAccount = anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync("./mint_account.json", "utf8")))
    );
  else {
    mintAccount = anchor.web3.Keypair.generate();
    writeFileSync(
      "./mint_account.json",
      `[${mintAccount.secretKey.toString()}]`
    );
  }
  let dataAccount;
  if (existsSync("./data_account.json"))
    dataAccount = anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync("./data_account.json", "utf8")))
    );
  else {
    dataAccount = anchor.web3.Keypair.generate();
    writeFileSync(
      "./data_account.json",
      `[${dataAccount.secretKey.toString()}]`
    );
  }
  const wallet = provider.wallet;

  // Generate the program client from IDL.
  const programId = new anchor.web3.PublicKey(idl.token.metadata.address);
  const program = new anchor.Program(idl.token, programId, provider);

  const tx = await program.methods
    .new()
    .accounts({ dataAccount: dataAccount.publicKey })
    .signers([dataAccount])
    .rpc();

  console.log("initial token tx", tx);

  console.log("create token...");

  const connection = provider.connection;
  const metaplex = Metaplex.make(connection);
  const metadataAddress = metaplex
    .nfts()
    .pdas()
    .metadata({ mint: mintAccount.publicKey });

  // Add your test here.
  const tx1 = await program.methods
    .createTokenMint(wallet.publicKey, DECIMAL, NAME, SYMBOL, URL)
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

  console.log("mint token to creator wallet...", wallet.publicKey.toBase58());
  // Wallet's associated token account address for mint
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    mintAccount.publicKey,
    wallet.publicKey
  );

  const tx3 = await program.methods
    .mintTo(new BN(supply))
    .accounts({
      mintAuthority: wallet.publicKey, // owner account
      tokenAccount: tokenAccount.address, // owner's token account
      mint: mintAccount.publicKey, // token mint account
    })
    .rpc();
  console.log("mint token tx", tx3);
}
