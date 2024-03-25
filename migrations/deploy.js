const anchor = require("@coral-xyz/anchor");
const idl = require("../target/idl/run_election.json");
module.exports = async function (provider) {
  // Address of the deployed program.
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);

  const dataAccount = anchor.web3.Keypair.generate();
  const wallet = provider.wallet;
  // Generate the program client from IDL.
  const programId = new anchor.web3.PublicKey(idl.metadata.address);
  const program = new anchor.Program(idl, programId, provider);

  // Add your test here.
  const tx = await program.methods
    .new(wallet.publicKey, dataAccount.publicKey)
    .accounts({ dataAccount: dataAccount.publicKey })
    .signers([dataAccount])
    .rpc();
  console.log("deploy tx", tx);
  console.log("data account public", dataAccount.publicKey.toBase58());
  console.log(
    "Initial SOL in debit (data account)",
    (await provider.connection.getBalance(dataAccount.publicKey)) /
      anchor.web3.LAMPORTS_PER_SOL
  );
};
