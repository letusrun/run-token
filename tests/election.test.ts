import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Election } from "../target/types/election";
import { assert } from "chai";

describe("election program", () => {
  const program = anchor.workspace.Election as Program<Election>;

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const dataAccount = anchor.web3.Keypair.generate();
  const wallet = provider.wallet;

  const connect = provider.connection;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
      .new(wallet.publicKey, dataAccount.publicKey)
      .accounts({ dataAccount: dataAccount.publicKey })
      .signers([dataAccount])
      .rpc();
    console.log("Your transaction signature", tx);

    console.log(
      "Initial SOL in debit (data account)",
      (await connect.getBalance(dataAccount.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );
  });

  it("add runner", async () => {
    // add runner 0
    const tx = await program.methods
      .addRunner("Golden Instructor")
      .accounts({
        dataAccount: dataAccount.publicKey,
        owner: wallet.publicKey,
      })
      .rpc();
    console.log("add runner0 tx", tx);
    const res = await program.methods
      .getRunner(new anchor.BN(0))
      .accounts({ dataAccount: dataAccount.publicKey })
      .view();
    console.log("runner0", res);
    assert(res.name === "Golden Instructor");
    assert(new anchor.BN(0).eq(res.vote));

    // add runner 1
    const tx2 = await program.methods
      .addRunner("Tian Tian Quan")
      .accounts({
        dataAccount: dataAccount.publicKey,
        owner: wallet.publicKey,
      })
      .rpc();
    console.log("add runner1 tx", tx2);
    const res2 = await program.methods
      .getRunner(new anchor.BN(1))
      .accounts({ dataAccount: dataAccount.publicKey })
      .view();
    console.log("runner1", res2);
    assert(res2.name === "Tian Tian Quan");
    assert(new anchor.BN(0).eq(res2.vote));
  });

  it("vote for runner 0", async () => {
    // generate a test account
    const acc1 = anchor.web3.Keypair.generate(); // test1 recipient
    const balance = await connect.getBalance(acc1.publicKey); // 0
    console.log("acc1 balance 1", balance / anchor.web3.LAMPORTS_PER_SOL); // 0
    assert(balance === 0);
    // give test account 10 SOL
    const transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: acc1.publicKey,
        lamports: 10 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transaction);
    const balance2 = await connect.getBalance(acc1.publicKey); // 1
    console.log("acc1 balance 2", balance2 / anchor.web3.LAMPORTS_PER_SOL); // 1
    assert(balance2 / anchor.web3.LAMPORTS_PER_SOL === 10);

    const tx = await program.methods
      .vote(new anchor.BN(0), new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL))
      .accounts({ sender: acc1.publicKey, dataAccount: dataAccount.publicKey })
      .signers([acc1])
      .rpc();
    console.log("acc1 vote runner0 1 SOL tx", tx);

    const balance3 = await connect.getBalance(acc1.publicKey); // 1
    console.log("acc1 balance 3", balance3 / anchor.web3.LAMPORTS_PER_SOL); // 1
    assert(balance3 / anchor.web3.LAMPORTS_PER_SOL === 9);

    const res = await program.methods
      .getRunner(new anchor.BN(0))
      .accounts({ dataAccount: dataAccount.publicKey })
      .view();
    console.log("runner0 votes", res.vote / anchor.web3.LAMPORTS_PER_SOL);
    assert(res.vote / anchor.web3.LAMPORTS_PER_SOL === 1);

    const tx2 = await program.methods
      .vote(new anchor.BN(0), new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL))
      .accounts({
        sender: wallet.publicKey,
        dataAccount: dataAccount.publicKey,
      })
      .rpc();
    console.log("provider vote runner0 2 SOL tx", tx2);

    const res2 = await program.methods
      .getRunner(new anchor.BN(0))
      .accounts({ dataAccount: dataAccount.publicKey })
      .view();
    console.log("runner0 votes", res2.vote / anchor.web3.LAMPORTS_PER_SOL);
    assert(res2.vote / anchor.web3.LAMPORTS_PER_SOL === 3);

    // contract account balance
    const debit =
      (await connect.getBalance(dataAccount.publicKey)) /
      anchor.web3.LAMPORTS_PER_SOL;
    console.log("data account balance", debit);
    assert(debit >= 3);
  });

  it("vote for runner 1", async () => {
    // generate a test account, and give 10 SOL
    const acc = anchor.web3.Keypair.generate(); // test1 recipient
    const transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: acc.publicKey,
        lamports: 100 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transaction);

    const tx = await program.methods
      .vote(new anchor.BN(1), new anchor.BN(100 * anchor.web3.LAMPORTS_PER_SOL))
      .accounts({
        sender: acc.publicKey,
        dataAccount: dataAccount.publicKey,
      })
      .signers([acc])
      .rpc();
    console.log("acc vote runner1 100 SOL tx", tx);

    const res = await program.methods
      .getRunner(new anchor.BN(1))
      .accounts({ dataAccount: dataAccount.publicKey })
      .view();
    console.log("runner1 votes", res.vote / anchor.web3.LAMPORTS_PER_SOL);
    assert(res.vote / anchor.web3.LAMPORTS_PER_SOL === 100);

    // contract account balance
    const debit =
      (await connect.getBalance(dataAccount.publicKey)) /
      anchor.web3.LAMPORTS_PER_SOL;
    console.log("data account balance", debit);
    assert(debit >= 103);
  });

  it("withdraw", async () => {
    // contract account balance
    const dataBalance =
      (await connect.getBalance(dataAccount.publicKey)) /
      anchor.web3.LAMPORTS_PER_SOL;
    console.log("data account balance", dataBalance);

    // owner account balance
    console.log(
      "owner balance",
      (await connect.getBalance(wallet.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );

    // don't withdraw all the SOL
    const tx = await program.methods
      .withdraw(
        new anchor.BN(Math.floor(dataBalance) * anchor.web3.LAMPORTS_PER_SOL)
      )
      .accounts({
        from: dataAccount.publicKey,
        owner: wallet.publicKey,
        dataAccount: dataAccount.publicKey,
      })
      .rpc();
    console.log("withdraw tx", tx);

    // contract account balance
    console.log(
      "data account balance",
      (await connect.getBalance(dataAccount.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );

    // owner account balance
    console.log(
      "owner balance",
      (await connect.getBalance(wallet.publicKey)) /
        anchor.web3.LAMPORTS_PER_SOL
    );

    /* try to withdraw by other account
    const acc = anchor.web3.Keypair.generate(); // test1 recipient
    const transaction = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: acc.publicKey,
        lamports: 100 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(transaction);
    const tx2 = await program.methods
      .withdraw()
      .accounts({
        from: dataAccount.publicKey,
        owner: wallet.publicKey,
        dataAccount: dataAccount.publicKey,
      })
      .rpc();
      */
  });

  it("set new owner and withdraw", async () => {
    const acc = anchor.web3.Keypair.generate();
    await program.methods
      .setOwner(acc.publicKey)
      .accounts({
        dataAccount: dataAccount.publicKey,
        owner: wallet.publicKey,
      })
      .rpc();

    console.log(
      "new owner balance",
      (await connect.getBalance(acc.publicKey)) / anchor.web3.LAMPORTS_PER_SOL
    );
    // contract account balance
    const dataBalance = await connect.getBalance(dataAccount.publicKey);
    await program.methods
      .withdraw(new anchor.BN(dataBalance))
      .accounts({
        from: dataAccount.publicKey,
        owner: acc.publicKey,
        dataAccount: dataAccount.publicKey,
      })
      .signers([acc])
      .rpc();

    console.log(
      "new owner balance",
      (await connect.getBalance(acc.publicKey)) / anchor.web3.LAMPORTS_PER_SOL
    );

    // contract account balance
    const debit =
      (await connect.getBalance(dataAccount.publicKey)) /
      anchor.web3.LAMPORTS_PER_SOL;
    console.log("data account balance", debit);
    assert(debit === 0);
  });
});
