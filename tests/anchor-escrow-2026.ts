import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorEscrow2026 } from "../target/types/anchor_escrow_2026";
import { expect } from "chai";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("anchor-escrow-2026", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorEscrow2026 as Program<AnchorEscrow2026>;

  const maker = provider.wallet.publicKey;
  const taker = anchor.web3.Keypair.generate();

  let mintA: anchor.web3.PublicKey;
  let mintB: anchor.web3.PublicKey;
  let makerAtaA: anchor.web3.PublicKey;
  let takerAtaB: anchor.web3.PublicKey;
  let makerAtaB: anchor.web3.PublicKey;
  let takerAtaA: anchor.web3.PublicKey;

  const seed = new anchor.BN(1234);
  let escrowPda: anchor.web3.PublicKey;
  let escrowBump: number;
  let vault: anchor.web3.PublicKey;

  const depositAmount = 100;
  const receiveAmount = 200;

  function uniqueSeed(): anchor.BN {
    return new anchor.BN(Date.now()).mul(new anchor.BN(1000)).add(new anchor.BN(Math.floor(Math.random() * 1000)));
  }

  before(async () => {
    await provider.connection.requestAirdrop(maker, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(taker.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    mintA = await createMint(provider.connection, provider.wallet.payer, maker, null, 0);
    mintB = await createMint(provider.connection, provider.wallet.payer, taker.publicKey, null, 0);

    makerAtaA = getAssociatedTokenAddressSync(mintA, maker);
    const makerAtaATx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(provider.wallet.publicKey, makerAtaA, maker, mintA)
    );
    await provider.sendAndConfirm(makerAtaATx);
    await mintTo(provider.connection, provider.wallet.payer, mintA, makerAtaA, provider.wallet.payer, depositAmount * 2);

    takerAtaB = getAssociatedTokenAddressSync(mintB, taker.publicKey);
    const takerAtaBTx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(taker.publicKey, takerAtaB, taker.publicKey, mintB)
    );
    await provider.sendAndConfirm(takerAtaBTx, [taker]);
    await mintTo(provider.connection, taker, mintB, takerAtaB, taker, receiveAmount * 2);
  });

  it("make", async () => {
    const seed1 = uniqueSeed();
    [escrowPda, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), maker.toBuffer(), seed1.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    vault = getAssociatedTokenAddressSync(mintA, escrowPda, true);

    await program.methods
      .make(seed1, new anchor.BN(depositAmount), new anchor.BN(receiveAmount))
      .accountsStrict({
        maker,
        mintA,
        mintB,
        makerAtaA,
        escrow: escrowPda,
        vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    expect(escrowAccount.maker.toBase58()).to.equal(maker.toBase58());
    expect(escrowAccount.mintA.toBase58()).to.equal(mintA.toBase58());
    expect(escrowAccount.mintB.toBase58()).to.equal(mintB.toBase58());
    expect(escrowAccount.receive.toNumber()).to.equal(receiveAmount);
    expect(escrowAccount.bump).to.equal(escrowBump);

    const vaultBalance = (await provider.connection.getTokenAccountBalance(vault)).value.uiAmount;
    expect(vaultBalance).to.equal(depositAmount);
  });

  it("refund", async () => {
    const seed2 = uniqueSeed();
    [escrowPda, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), maker.toBuffer(), seed2.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    vault = getAssociatedTokenAddressSync(mintA, escrowPda, true);

    await program.methods
      .make(seed2, new anchor.BN(depositAmount), new anchor.BN(receiveAmount))
      .accountsStrict({
        maker,
        mintA,
        mintB,
        makerAtaA,
        escrow: escrowPda,
        vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .refund()
      .accountsStrict({
        maker,
        mintA,
        makerAtaA,
        escrow: escrowPda,
        vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const escrowInfo = await provider.connection.getAccountInfo(escrowPda);
    expect(escrowInfo).to.be.null;

    const vaultInfo = await provider.connection.getAccountInfo(vault);
    expect(vaultInfo).to.be.null;
  });

  it("take", async () => {
    const seed3 = uniqueSeed();
    [escrowPda, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), maker.toBuffer(), seed3.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    vault = getAssociatedTokenAddressSync(mintA, escrowPda, true);

    await program.methods
      .make(seed3, new anchor.BN(depositAmount), new anchor.BN(receiveAmount))
      .accountsStrict({
        maker,
        mintA,
        mintB,
        makerAtaA,
        escrow: escrowPda,
        vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    takerAtaA = getAssociatedTokenAddressSync(mintA, taker.publicKey);
    makerAtaB = getAssociatedTokenAddressSync(mintB, maker);

    const takerAtaACreateIx = createAssociatedTokenAccountInstruction(
      taker.publicKey,
      takerAtaA,
      taker.publicKey,
      mintA
    );
    try {
      await provider.sendAndConfirm(new anchor.web3.Transaction().add(takerAtaACreateIx), [taker]);
    } catch {
    }

    const makerAtaBCreateIx = createAssociatedTokenAccountInstruction(maker, makerAtaB, maker, mintB);
    try {
      await provider.sendAndConfirm(new anchor.web3.Transaction().add(makerAtaBCreateIx));
    } catch {
    
    }

    await program.methods
      .take()
      .accountsStrict({
        taker: taker.publicKey,
        maker,
        mintA,
        mintB,
        makerAtaA,
        makerAtaB,
        escrow: escrowPda,
        vault,
        takerAtaA,
        takerAtaB,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([taker])
      .rpc();

    const escrowInfo = await provider.connection.getAccountInfo(escrowPda);
    expect(escrowInfo).to.be.null;

    const vaultInfo = await provider.connection.getAccountInfo(vault);
    expect(vaultInfo).to.be.null;

    const takerBalanceA = (await provider.connection.getTokenAccountBalance(takerAtaA)).value.uiAmount;
    expect(takerBalanceA).to.equal(depositAmount);

    const makerBalanceB = (await provider.connection.getTokenAccountBalance(makerAtaB)).value.uiAmount;
    expect(makerBalanceB).to.equal(receiveAmount);
  });
});
