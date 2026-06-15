// ── Script generation (BONUS feature for developers) ─────────────────────────
//
// Produces ready-to-run code/commands as TEXT for devs who want to interact
// with Pharos from their own terminal. THIS MODULE EXECUTES NOTHING and HANDLES
// NO KEYS — it only returns strings. Generated scripts read PRIVATE_KEY from the
// developer's OWN environment (process.env / $PRIVATE_KEY), never from this app.
//
// The chat UI renders the returned `code` inside a markdown code block and shows
// the `howToRun` note. The main app (swaps/bridges/liquidity) is unaffected.

import { TOKENS } from "./tokens";

export type ScriptOperation =
  | "balance" // native + ERC-20 balance check (read-only)
  | "read" // call a view/pure contract function (read-only)
  | "write" // send a state-changing contract call (signs)
  | "transfer" // transfer native PROS or an ERC-20 (signs)
  | "deploy" // deploy a minimal ERC-20 (signs)
  | "airdrop" // batch ERC-20 transfer to many recipients (signs)
  | "gas"; // estimate gas for a transfer (read-only)

export type ScriptLanguage =
  | "javascript" // ethers v6
  | "typescript" // viem
  | "python" // web3.py
  | "foundry"; // cast / forge CLI

export interface ScriptParams {
  /** Token symbol (PROS, USDC, …) or a raw 0x address. Defaults to USDC. */
  token?: string;
  /** Target/recipient address for transfers and reads. */
  to?: string;
  /** Amount in human units (e.g. "1.5"). */
  amount?: string;
  /** Contract address for read/write/gas operations. */
  contract?: string;
  /** Function signature for read/write, e.g. "totalSupply()(uint256)". */
  signature?: string;
  /** Call arguments for read/write (already-stringified, space-free tokens). */
  args?: string;
  /** ERC-20 deploy: token name. */
  name?: string;
  /** ERC-20 deploy: token symbol. */
  symbol?: string;
  /** ERC-20 deploy: initial supply in whole tokens. */
  supply?: string;
}

export interface GeneratedScript {
  code: string;
  /** Markdown fence language for rendering. */
  lang: "javascript" | "typescript" | "python" | "bash";
  /** Suggested filename / command label. */
  filename: string;
  /** Short, human "how to run" note shown under the code block. */
  howToRun: string;
  operation: ScriptOperation;
  language: ScriptLanguage;
}

// ── Canonical Pharos mainnet config (kept in sync with lib/tokens.ts) ─────────
const PHAROS = {
  chainId: 1672,
  rpc: "https://rpc.pharos.xyz",
  explorer: "https://www.pharosscan.xyz",
  symbol: "PROS",
};

interface ResolvedToken {
  symbol: string;
  address: string;
  decimals: number;
  /** true for the native coin (PROS) — has no ERC-20 contract (zero address). */
  isNative: boolean;
}

const ZERO = "0x0000000000000000000000000000000000000000";

// Resolve a token symbol or raw address to { symbol, address, decimals, isNative }.
// Defaults to USDC when nothing usable is given.
function resolveToken(token?: string): ResolvedToken {
  if (token && /^0x[a-fA-F0-9]{40}$/.test(token.trim())) {
    const addr = token.trim();
    return { symbol: "TOKEN", address: addr, decimals: 18, isNative: addr.toLowerCase() === ZERO };
  }
  const key = (token ?? "USDC").toUpperCase().replace(/[^A-Z]/g, "");
  if (key === "PROS") return { symbol: "PROS", address: ZERO, decimals: 18, isNative: true };
  const entry = (TOKENS as Record<string, { address: string; decimals: number }>)[key];
  if (entry) return { symbol: key, address: entry.address, decimals: entry.decimals, isNative: entry.address.toLowerCase() === ZERO };
  return { symbol: "USDC", address: TOKENS.USDC.address, decimals: TOKENS.USDC.decimals, isNative: false };
}

const ADDR = (v?: string, fallback = "0xRecipientAddress0000000000000000000000000") =>
  v && /^0x[a-fA-F0-9]{40}$/.test(v.trim()) ? v.trim() : fallback;

// ── how-to-run notes per language ─────────────────────────────────────────────
function howTo(language: ScriptLanguage, signs: boolean): string {
  const keyNote = signs
    ? " It reads **PRIVATE_KEY** from your own environment — set it in your shell (`export PRIVATE_KEY=0x…`) or a local `.env`. Never share it; this app never sees it."
    : " Read-only — no private key needed.";
  switch (language) {
    case "javascript":
      return `Save as \`pharos.js\`, run \`npm i ethers@6\`, then \`node pharos.js\`.${keyNote}`;
    case "typescript":
      return `Save as \`pharos.ts\`, run \`npm i viem\` and \`npm i -D tsx\`, then \`npx tsx pharos.ts\`.${keyNote}`;
    case "python":
      return `Save as \`pharos.py\`, run \`pip install web3\`, then \`python pharos.py\`.${keyNote}`;
    case "foundry":
      return `Run in your terminal with [Foundry](https://getfoundry.sh) installed (\`cast\`/\`forge\`).${keyNote}`;
  }
}

const fence = (language: ScriptLanguage): GeneratedScript["lang"] =>
  language === "foundry" ? "bash" : language === "python" ? "python" : language === "typescript" ? "typescript" : "javascript";

// ─────────────────────────────────────────────────────────────────────────────
// JavaScript (ethers v6)
// ─────────────────────────────────────────────────────────────────────────────
function jsHeader(signer: boolean): string {
  return (
    `// Pharos mainnet (chainId ${PHAROS.chainId}) — ethers v6\n` +
    `import { ethers } from "ethers";\n\n` +
    `const RPC = "${PHAROS.rpc}";\n` +
    `const provider = new ethers.JsonRpcProvider(RPC, ${PHAROS.chainId});\n` +
    (signer
      ? `// PRIVATE_KEY comes from YOUR environment — never hard-code it.\n` +
        `const PRIVATE_KEY = process.env.PRIVATE_KEY;\n` +
        `if (!PRIVATE_KEY) throw new Error("Set PRIVATE_KEY in your environment first");\n` +
        `const wallet = new ethers.Wallet(PRIVATE_KEY, provider);\n`
      : "")
  );
}

function jsScript(op: ScriptOperation, p: ScriptParams): string {
  const t = resolveToken(p.token);
  const amount = p.amount ?? "1.0";
  switch (op) {
    case "balance":
      if (t.isNative)
        return (
          jsHeader(false) +
          `\nconst address = "${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}";\n\n` +
          `async function main() {\n  try {\n` +
          `    const native = await provider.getBalance(address);\n` +
          `    console.log(\`${PHAROS.symbol}: \${ethers.formatEther(native)}\`);\n` +
          `  } catch (err) {\n    console.error("Failed:", err.shortMessage ?? err.message);\n    process.exit(1);\n  }\n}\nmain();\n`
        );
      return (
        jsHeader(false) +
        `\nconst address = "${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}";\n` +
        `const erc20 = new ethers.Contract("${t.address}", ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)", "function symbol() view returns (string)"], provider);\n\n` +
        `async function main() {\n` +
        `  try {\n` +
        `    const native = await provider.getBalance(address);\n` +
        `    console.log(\`${PHAROS.symbol}: \${ethers.formatEther(native)}\`);\n` +
        `    const [raw, dec, sym] = await Promise.all([erc20.balanceOf(address), erc20.decimals(), erc20.symbol()]);\n` +
        `    console.log(\`\${sym}: \${ethers.formatUnits(raw, dec)}\`);\n` +
        `  } catch (err) {\n    console.error("Failed:", err.shortMessage ?? err.message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "read":
      return (
        jsHeader(false) +
        `\nconst CONTRACT = "${ADDR(p.contract, "0xYourContractAddress00000000000000000000")}";\n` +
        `// Replace with your function's ABI fragment:\n` +
        `const abi = ["function ${p.signature ?? "totalSupply() view returns (uint256)"}"];\n` +
        `const contract = new ethers.Contract(CONTRACT, abi, provider);\n\n` +
        `async function main() {\n` +
        `  try {\n` +
        `    const result = await contract.${(p.signature ?? "totalSupply()").split("(")[0]}(${p.args ?? ""});\n` +
        `    console.log("Result:", result.toString());\n` +
        `  } catch (err) {\n    console.error("Call failed:", err.shortMessage ?? err.message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "write":
      return (
        jsHeader(true) +
        `\nconst CONTRACT = "${ADDR(p.contract, "0xYourContractAddress00000000000000000000")}";\n` +
        `const abi = ["function ${p.signature ?? "setValue(uint256)"}"];\n` +
        `const contract = new ethers.Contract(CONTRACT, abi, wallet);\n\n` +
        `async function main() {\n` +
        `  try {\n` +
        `    const tx = await contract.${(p.signature ?? "setValue(uint256)").split("(")[0]}(${p.args ?? "/* args */"});\n` +
        `    console.log("Sent:", tx.hash);\n` +
        `    const receipt = await tx.wait();\n` +
        `    console.log(receipt.status === 1 ? "Confirmed" : "Reverted", "in block", receipt.blockNumber);\n` +
        `    console.log("${PHAROS.explorer}/tx/" + tx.hash);\n` +
        `  } catch (err) {\n    console.error("Tx failed:", err.shortMessage ?? err.message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "transfer":
      if (t.isNative)
        return (
          jsHeader(true) +
          `\nconst TO = "${ADDR(p.to)}";\nconst AMOUNT = "${amount}";\n\n` +
          `async function main() {\n  try {\n` +
          `    // Native ${PHAROS.symbol} transfer.\n` +
          `    const tx = await wallet.sendTransaction({ to: TO, value: ethers.parseEther(AMOUNT) });\n` +
          `    console.log("Sent:", tx.hash);\n` +
          `    const receipt = await tx.wait();\n` +
          `    console.log(receipt.status === 1 ? "Confirmed" : "Reverted");\n` +
          `    console.log("${PHAROS.explorer}/tx/" + tx.hash);\n` +
          `  } catch (err) {\n    console.error("Transfer failed:", err.shortMessage ?? err.message);\n    process.exit(1);\n  }\n}\nmain();\n`
        );
      return (
        jsHeader(true) +
        `\nconst TO = "${ADDR(p.to)}";\n` +
        `const AMOUNT = "${amount}";\n\n` +
        `async function main() {\n  try {\n` +
        `    // ERC-20 transfer of ${t.symbol}. For native ${PHAROS.symbol}, use:\n` +
        `    //   const tx = await wallet.sendTransaction({ to: TO, value: ethers.parseEther(AMOUNT) });\n` +
        `    const erc20 = new ethers.Contract("${t.address}", ["function transfer(address,uint256) returns (bool)", "function decimals() view returns (uint8)"], wallet);\n` +
        `    const dec = await erc20.decimals();\n` +
        `    const tx = await erc20.transfer(TO, ethers.parseUnits(AMOUNT, dec));\n` +
        `    console.log("Sent:", tx.hash);\n` +
        `    const receipt = await tx.wait();\n` +
        `    console.log(receipt.status === 1 ? "Confirmed" : "Reverted");\n` +
        `    console.log("${PHAROS.explorer}/tx/" + tx.hash);\n` +
        `  } catch (err) {\n    console.error("Transfer failed:", err.shortMessage ?? err.message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "deploy":
      return (
        jsHeader(true) +
        `\n// Minimal ERC-20 deploy. Compiled bytecode + ABI shown inline for a tiny\n` +
        `// OpenZeppelin-style token. For production, use Foundry/Hardhat to compile.\n` +
        `const NAME = "${p.name ?? "MyToken"}";\nconst SYMBOL = "${p.symbol ?? "MTK"}";\nconst SUPPLY = "${p.supply ?? "1000000"}";\n\n` +
        `// ⚠ Replace ABI + BYTECODE with your compiled contract artifacts:\n` +
        `const ABI = [/* compiled ABI */];\nconst BYTECODE = "0x/* compiled bytecode */";\n\n` +
        `async function main() {\n  try {\n` +
        `    const factory = new ethers.ContractFactory(ABI, BYTECODE, wallet);\n` +
        `    const contract = await factory.deploy(NAME, SYMBOL, ethers.parseUnits(SUPPLY, 18));\n` +
        `    console.log("Deploy tx:", contract.deploymentTransaction().hash);\n` +
        `    await contract.waitForDeployment();\n` +
        `    console.log("Deployed at:", await contract.getAddress());\n` +
        `    console.log("${PHAROS.explorer}/address/" + (await contract.getAddress()));\n` +
        `  } catch (err) {\n    console.error("Deploy failed:", err.shortMessage ?? err.message);\n    process.exit(1);\n  }\n}\nmain();\n` +
        `\n// TIP: the Foundry version of this script compiles + deploys in one step.\n`
      );
    case "airdrop":
      if (t.isNative)
        return (
          jsHeader(true) +
          `\n// Batch native ${PHAROS.symbol} airdrop. Fill in recipients below.\n` +
          `const recipients = [\n  "0xRecipient1...",\n  "0xRecipient2...",\n];\n` +
          `const AMOUNT_EACH = "${amount}";\n\n` +
          `async function main() {\n` +
          `  const value = ethers.parseEther(AMOUNT_EACH);\n` +
          `  let nonce = await wallet.getNonce();\n` +
          `  for (const to of recipients) {\n    try {\n` +
          `      const tx = await wallet.sendTransaction({ to, value, nonce: nonce++ });\n` +
          `      console.log(\`→ \${to}: \${tx.hash}\`);\n      await tx.wait();\n` +
          `    } catch (err) {\n      console.error(\`✗ \${to}:\`, err.shortMessage ?? err.message);\n    }\n  }\n  console.log("Airdrop done.");\n}\nmain();\n`
        );
      return (
        jsHeader(true) +
        `\n// Batch ERC-20 airdrop of ${t.symbol}. Fill in recipients below.\n` +
        `const recipients = [\n  "0xRecipient1...",\n  "0xRecipient2...",\n];\n` +
        `const AMOUNT_EACH = "${amount}";\n\n` +
        `async function main() {\n` +
        `  const erc20 = new ethers.Contract("${t.address}", ["function transfer(address,uint256) returns (bool)", "function decimals() view returns (uint8)"], wallet);\n` +
        `  const dec = await erc20.decimals();\n` +
        `  const value = ethers.parseUnits(AMOUNT_EACH, dec);\n` +
        `  let nonce = await wallet.getNonce();\n` +
        `  for (const to of recipients) {\n` +
        `    try {\n` +
        `      const tx = await erc20.transfer(to, value, { nonce: nonce++ });\n` +
        `      console.log(\`→ \${to}: \${tx.hash}\`);\n` +
        `      await tx.wait();\n` +
        `    } catch (err) {\n      console.error(\`✗ \${to}:\`, err.shortMessage ?? err.message);\n    }\n  }\n  console.log("Airdrop done.");\n}\nmain();\n`
      );
    case "gas":
      return (
        jsHeader(false) +
        `\nconst FROM = "${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}";\n` +
        `const TO = "${ADDR(p.contract, "0xRecipientAddress0000000000000000000000000")}";\n\n` +
        `async function main() {\n  try {\n` +
        `    // Estimate a native ${PHAROS.symbol} transfer of ${amount}.\n` +
        `    const gas = await provider.estimateGas({ from: FROM, to: TO, value: ethers.parseEther("${amount}") });\n` +
        `    const fee = await provider.getFeeData();\n` +
        `    console.log("Gas units:", gas.toString());\n` +
        `    if (fee.gasPrice) console.log("Est. cost (${PHAROS.symbol}):", ethers.formatEther(gas * fee.gasPrice));\n` +
        `  } catch (err) {\n    console.error("Estimate failed:", err.shortMessage ?? err.message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript (viem)
// ─────────────────────────────────────────────────────────────────────────────
function viemHeader(signer: boolean): string {
  return (
    `// Pharos mainnet (chainId ${PHAROS.chainId}) — viem\n` +
    `import { createPublicClient${signer ? ", createWalletClient" : ""}, http${signer ? ", parseEther, parseUnits, formatEther" : ", formatEther, formatUnits"} } from "viem";\n` +
    (signer ? `import { privateKeyToAccount } from "viem/accounts";\n` : "") +
    `import { defineChain } from "viem";\n\n` +
    `const pharos = defineChain({\n  id: ${PHAROS.chainId},\n  name: "Pharos",\n  nativeCurrency: { name: "Pharos", symbol: "${PHAROS.symbol}", decimals: 18 },\n  rpcUrls: { default: { http: ["${PHAROS.rpc}"] } },\n  blockExplorers: { default: { name: "PharosScan", url: "${PHAROS.explorer}" } },\n});\n\n` +
    `const publicClient = createPublicClient({ chain: pharos, transport: http() });\n` +
    (signer
      ? `// PRIVATE_KEY comes from YOUR environment — never hard-code it.\n` +
        `const pk = process.env.PRIVATE_KEY as \`0x\${string}\`;\nif (!pk) throw new Error("Set PRIVATE_KEY in your environment first");\n` +
        `const account = privateKeyToAccount(pk);\n` +
        `const walletClient = createWalletClient({ account, chain: pharos, transport: http() });\n`
      : "")
  );
}

function tsScript(op: ScriptOperation, p: ScriptParams): string {
  const t = resolveToken(p.token);
  const amount = p.amount ?? "1.0";
  const erc20Abi =
    `const erc20Abi = [\n` +
    `  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },\n` +
    `  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },\n` +
    `  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },\n` +
    `  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },\n` +
    `] as const;\n`;
  switch (op) {
    case "balance":
      if (t.isNative)
        return (
          viemHeader(false) +
          `\nconst address = "${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}" as \`0x\${string}\`;\n\n` +
          `async function main() {\n  try {\n` +
          `    const native = await publicClient.getBalance({ address });\n    console.log(\`${PHAROS.symbol}: \${formatEther(native)}\`);\n` +
          `  } catch (err) {\n    console.error("Failed:", (err as Error).message);\n    process.exit(1);\n  }\n}\nmain();\n`
        );
      return (
        viemHeader(false) +
        `\n${erc20Abi}\nconst address = "${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}" as \`0x\${string}\`;\nconst token = "${t.address}" as \`0x\${string}\`;\n\n` +
        `async function main() {\n  try {\n` +
        `    const native = await publicClient.getBalance({ address });\n    console.log(\`${PHAROS.symbol}: \${formatEther(native)}\`);\n` +
        `    const [raw, dec, sym] = await Promise.all([\n` +
        `      publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] }),\n` +
        `      publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),\n` +
        `      publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),\n` +
        `    ]);\n    console.log(\`\${sym}: \${formatUnits(raw as bigint, Number(dec))}\`);\n` +
        `  } catch (err) {\n    console.error("Failed:", (err as Error).message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "read":
      return (
        viemHeader(false) +
        `\nconst CONTRACT = "${ADDR(p.contract, "0xYourContractAddress00000000000000000000")}" as \`0x\${string}\`;\n` +
        `// Replace with your function's ABI fragment:\nconst abi = [{ type: "function", name: "${(p.signature ?? "totalSupply").split("(")[0]}", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const;\n\n` +
        `async function main() {\n  try {\n` +
        `    const result = await publicClient.readContract({ address: CONTRACT, abi, functionName: "${(p.signature ?? "totalSupply").split("(")[0]}" });\n` +
        `    console.log("Result:", result);\n` +
        `  } catch (err) {\n    console.error("Call failed:", (err as Error).message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "write":
      return (
        viemHeader(true) +
        `\nconst CONTRACT = "${ADDR(p.contract, "0xYourContractAddress00000000000000000000")}" as \`0x\${string}\`;\n` +
        `const abi = [{ type: "function", name: "${(p.signature ?? "setValue").split("(")[0]}", stateMutability: "nonpayable", inputs: [{ name: "v", type: "uint256" }], outputs: [] }] as const;\n\n` +
        `async function main() {\n  try {\n` +
        `    const hash = await walletClient.writeContract({ address: CONTRACT, abi, functionName: "${(p.signature ?? "setValue").split("(")[0]}", args: [${p.args ?? "0n"}] });\n` +
        `    console.log("Sent:", hash);\n` +
        `    const receipt = await publicClient.waitForTransactionReceipt({ hash });\n` +
        `    console.log(receipt.status === "success" ? "Confirmed" : "Reverted");\n` +
        `    console.log("${PHAROS.explorer}/tx/" + hash);\n` +
        `  } catch (err) {\n    console.error("Tx failed:", (err as Error).message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "transfer":
      if (t.isNative)
        return (
          viemHeader(true) +
          `\nconst TO = "${ADDR(p.to)}" as \`0x\${string}\`;\nconst AMOUNT = "${amount}";\n\n` +
          `async function main() {\n  try {\n` +
          `    // Native ${PHAROS.symbol} transfer.\n` +
          `    const hash = await walletClient.sendTransaction({ to: TO, value: parseEther(AMOUNT) });\n` +
          `    console.log("Sent:", hash);\n    const receipt = await publicClient.waitForTransactionReceipt({ hash });\n    console.log(receipt.status === "success" ? "Confirmed" : "Reverted");\n` +
          `    console.log("${PHAROS.explorer}/tx/" + hash);\n` +
          `  } catch (err) {\n    console.error("Transfer failed:", (err as Error).message);\n    process.exit(1);\n  }\n}\nmain();\n`
        );
      return (
        viemHeader(true) +
        `\n${erc20Abi}\nconst TO = "${ADDR(p.to)}" as \`0x\${string}\`;\nconst AMOUNT = "${amount}";\n\n` +
        `async function main() {\n  try {\n` +
        `    // ERC-20 transfer of ${t.symbol}. For native ${PHAROS.symbol}:\n` +
        `    //   const hash = await walletClient.sendTransaction({ to: TO, value: parseEther(AMOUNT) });\n` +
        `    const dec = await publicClient.readContract({ address: "${t.address}", abi: erc20Abi, functionName: "decimals" });\n` +
        `    const hash = await walletClient.writeContract({ address: "${t.address}", abi: erc20Abi, functionName: "transfer", args: [TO, parseUnits(AMOUNT, Number(dec))] });\n` +
        `    console.log("Sent:", hash);\n    const receipt = await publicClient.waitForTransactionReceipt({ hash });\n    console.log(receipt.status === "success" ? "Confirmed" : "Reverted");\n` +
        `    console.log("${PHAROS.explorer}/tx/" + hash);\n` +
        `  } catch (err) {\n    console.error("Transfer failed:", (err as Error).message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "deploy":
      return (
        viemHeader(true) +
        `\n// viem deploys from compiled artifacts. Compile your ERC-20 with Foundry/Hardhat,\n// then paste its abi + bytecode here.\n` +
        `const NAME = "${p.name ?? "MyToken"}";\nconst SYMBOL = "${p.symbol ?? "MTK"}";\nconst SUPPLY = "${p.supply ?? "1000000"}";\n\n` +
        `const abi = [/* compiled ABI */] as const;\nconst bytecode = "0x/* compiled bytecode */" as \`0x\${string}\`;\n\n` +
        `async function main() {\n  try {\n` +
        `    const hash = await walletClient.deployContract({ abi, bytecode, args: [NAME, SYMBOL, parseUnits(SUPPLY, 18)] });\n` +
        `    console.log("Deploy tx:", hash);\n` +
        `    const receipt = await publicClient.waitForTransactionReceipt({ hash });\n` +
        `    console.log("Deployed at:", receipt.contractAddress);\n` +
        `    console.log("${PHAROS.explorer}/address/" + receipt.contractAddress);\n` +
        `  } catch (err) {\n    console.error("Deploy failed:", (err as Error).message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
    case "airdrop":
      if (t.isNative)
        return (
          viemHeader(true) +
          `\nconst recipients = ["0xRecipient1...", "0xRecipient2..."] as \`0x\${string}\`[];\nconst AMOUNT_EACH = "${amount}";\n\n` +
          `async function main() {\n` +
          `  const value = parseEther(AMOUNT_EACH);\n` +
          `  for (const to of recipients) {\n    try {\n` +
          `      const hash = await walletClient.sendTransaction({ to, value });\n` +
          `      console.log(\`→ \${to}: \${hash}\`);\n      await publicClient.waitForTransactionReceipt({ hash });\n` +
          `    } catch (err) {\n      console.error(\`✗ \${to}:\`, (err as Error).message);\n    }\n  }\n  console.log("Airdrop done.");\n}\nmain();\n`
        );
      return (
        viemHeader(true) +
        `\n${erc20Abi}\nconst recipients = ["0xRecipient1...", "0xRecipient2..."] as \`0x\${string}\`[];\nconst AMOUNT_EACH = "${amount}";\n\n` +
        `async function main() {\n` +
        `  const dec = await publicClient.readContract({ address: "${t.address}", abi: erc20Abi, functionName: "decimals" });\n` +
        `  const value = parseUnits(AMOUNT_EACH, Number(dec));\n` +
        `  for (const to of recipients) {\n    try {\n` +
        `      const hash = await walletClient.writeContract({ address: "${t.address}", abi: erc20Abi, functionName: "transfer", args: [to, value] });\n` +
        `      console.log(\`→ \${to}: \${hash}\`);\n      await publicClient.waitForTransactionReceipt({ hash });\n` +
        `    } catch (err) {\n      console.error(\`✗ \${to}:\`, (err as Error).message);\n    }\n  }\n  console.log("Airdrop done.");\n}\nmain();\n`
      );
    case "gas":
      return (
        viemHeader(false) +
        `\nconst FROM = "${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}" as \`0x\${string}\`;\nconst TO = "${ADDR(p.contract, "0xRecipientAddress0000000000000000000000000")}" as \`0x\${string}\`;\n\n` +
        `async function main() {\n  try {\n` +
        `    const gas = await publicClient.estimateGas({ account: FROM, to: TO, value: parseEther("${amount}") });\n` +
        `    const gasPrice = await publicClient.getGasPrice();\n` +
        `    console.log("Gas units:", gas.toString());\n    console.log("Est. cost (${PHAROS.symbol}):", formatEther(gas * gasPrice));\n` +
        `  } catch (err) {\n    console.error("Estimate failed:", (err as Error).message);\n    process.exit(1);\n  }\n}\nmain();\n`
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Python (web3.py)
// ─────────────────────────────────────────────────────────────────────────────
function pyHeader(signer: boolean): string {
  return (
    `# Pharos mainnet (chainId ${PHAROS.chainId}) — web3.py\n` +
    `import os\nfrom web3 import Web3\n\n` +
    `RPC = "${PHAROS.rpc}"\nw3 = Web3(Web3.HTTPProvider(RPC))\nassert w3.is_connected(), "Cannot reach Pharos RPC"\n` +
    (signer
      ? `\n# PRIVATE_KEY comes from YOUR environment — never hard-code it.\n` +
        `PRIVATE_KEY = os.environ.get("PRIVATE_KEY")\nif not PRIVATE_KEY:\n    raise SystemExit("Set PRIVATE_KEY in your environment first")\n` +
        `account = w3.eth.account.from_key(PRIVATE_KEY)\n`
      : "")
  );
}

const PY_ERC20_ABI =
  `ERC20_ABI = [\n` +
  `    {"name": "balanceOf", "type": "function", "stateMutability": "view", "inputs": [{"name": "a", "type": "address"}], "outputs": [{"type": "uint256"}]},\n` +
  `    {"name": "decimals", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint8"}]},\n` +
  `    {"name": "symbol", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "string"}]},\n` +
  `    {"name": "transfer", "type": "function", "stateMutability": "nonpayable", "inputs": [{"name": "to", "type": "address"}, {"name": "v", "type": "uint256"}], "outputs": [{"type": "bool"}]},\n` +
  `]\n`;

function pySendHelper(): string {
  return (
    `\ndef send(tx):\n` +
    `    tx.setdefault("chainId", ${PHAROS.chainId})\n` +
    `    tx.setdefault("from", account.address)\n` +
    `    tx.setdefault("nonce", w3.eth.get_transaction_count(account.address))\n` +
    `    tx.setdefault("gasPrice", w3.eth.gas_price)\n` +
    `    if "gas" not in tx:\n        tx["gas"] = w3.eth.estimate_gas(tx)\n` +
    `    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)\n` +
    `    h = w3.eth.send_raw_transaction(signed.raw_transaction)\n` +
    `    print("Sent:", h.hex())\n` +
    `    receipt = w3.eth.wait_for_transaction_receipt(h)\n` +
    `    print("Confirmed" if receipt.status == 1 else "Reverted")\n` +
    `    print("${PHAROS.explorer}/tx/0x" + h.hex())\n    return receipt\n`
  );
}

function pyScript(op: ScriptOperation, p: ScriptParams): string {
  const t = resolveToken(p.token);
  const amount = p.amount ?? "1.0";
  switch (op) {
    case "balance":
      if (t.isNative)
        return (
          pyHeader(false) +
          `\naddress = Web3.to_checksum_address("${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}")\n\n` +
          `try:\n    print(f"${PHAROS.symbol}: {w3.from_wei(w3.eth.get_balance(address), 'ether')}")\n` +
          `except Exception as e:\n    raise SystemExit(f"Failed: {e}")\n`
        );
      return (
        pyHeader(false) +
        `\n${PY_ERC20_ABI}\naddress = Web3.to_checksum_address("${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}")\n` +
        `token = w3.eth.contract(address=Web3.to_checksum_address("${t.address}"), abi=ERC20_ABI)\n\n` +
        `try:\n    print(f"${PHAROS.symbol}: {w3.from_wei(w3.eth.get_balance(address), 'ether')}")\n` +
        `    dec = token.functions.decimals().call()\n    raw = token.functions.balanceOf(address).call()\n    sym = token.functions.symbol().call()\n` +
        `    print(f"{sym}: {raw / 10 ** dec}")\nexcept Exception as e:\n    raise SystemExit(f"Failed: {e}")\n`
      );
    case "read":
      return (
        pyHeader(false) +
        `\nCONTRACT = Web3.to_checksum_address("${ADDR(p.contract, "0xYourContractAddress00000000000000000000")}")\n` +
        `# Replace with your function's ABI fragment:\n` +
        `ABI = [{"name": "${(p.signature ?? "totalSupply").split("(")[0]}", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]}]\n` +
        `contract = w3.eth.contract(address=CONTRACT, abi=ABI)\n\n` +
        `try:\n    result = contract.functions.${(p.signature ?? "totalSupply").split("(")[0]}(${p.args ?? ""}).call()\n    print("Result:", result)\nexcept Exception as e:\n    raise SystemExit(f"Call failed: {e}")\n`
      );
    case "write":
      return (
        pyHeader(true) +
        `\nCONTRACT = Web3.to_checksum_address("${ADDR(p.contract, "0xYourContractAddress00000000000000000000")}")\n` +
        `ABI = [{"name": "${(p.signature ?? "setValue").split("(")[0]}", "type": "function", "stateMutability": "nonpayable", "inputs": [{"name": "v", "type": "uint256"}], "outputs": []}]\n` +
        `contract = w3.eth.contract(address=CONTRACT, abi=ABI)\n` +
        pySendHelper() +
        `\ntry:\n    tx = contract.functions.${(p.signature ?? "setValue").split("(")[0]}(${p.args ?? "0"}).build_transaction({"from": account.address})\n    send(tx)\nexcept Exception as e:\n    raise SystemExit(f"Tx failed: {e}")\n`
      );
    case "transfer":
      if (t.isNative)
        return (
          pyHeader(true) +
          `\nTO = Web3.to_checksum_address("${ADDR(p.to)}")\nAMOUNT = "${amount}"\n` +
          pySendHelper() +
          `\ntry:\n    # Native ${PHAROS.symbol} transfer.\n` +
          `    send({"to": TO, "value": w3.to_wei(AMOUNT, "ether")})\nexcept Exception as e:\n    raise SystemExit(f"Transfer failed: {e}")\n`
        );
      return (
        pyHeader(true) +
        `\n${PY_ERC20_ABI}\nTO = Web3.to_checksum_address("${ADDR(p.to)}")\nAMOUNT = "${amount}"\n` +
        `token = w3.eth.contract(address=Web3.to_checksum_address("${t.address}"), abi=ERC20_ABI)\n` +
        pySendHelper() +
        `\ntry:\n` +
        `    # ERC-20 transfer of ${t.symbol}. For native ${PHAROS.symbol}:\n` +
        `    #   send({"to": TO, "value": w3.to_wei(AMOUNT, "ether")})\n` +
        `    dec = token.functions.decimals().call()\n    value = int(float(AMOUNT) * 10 ** dec)\n` +
        `    tx = token.functions.transfer(TO, value).build_transaction({"from": account.address})\n    send(tx)\nexcept Exception as e:\n    raise SystemExit(f"Transfer failed: {e}")\n`
      );
    case "deploy":
      return (
        pyHeader(true) +
        `\n# web3.py deploys from compiled artifacts. Compile your ERC-20 (Foundry/Hardhat/solcx),\n# then paste abi + bytecode here.\n` +
        `NAME, SYMBOL, SUPPLY = "${p.name ?? "MyToken"}", "${p.symbol ?? "MTK"}", ${p.supply ?? "1000000"}\n` +
        `ABI = [...]  # compiled ABI\nBYTECODE = "0x..."  # compiled bytecode\n` +
        pySendHelper() +
        `\ntry:\n    contract = w3.eth.contract(abi=ABI, bytecode=BYTECODE)\n` +
        `    tx = contract.constructor(NAME, SYMBOL, SUPPLY * 10 ** 18).build_transaction({"from": account.address})\n` +
        `    receipt = send(tx)\n    print("Deployed at:", receipt.contractAddress)\n` +
        `    print("${PHAROS.explorer}/address/" + receipt.contractAddress)\nexcept Exception as e:\n    raise SystemExit(f"Deploy failed: {e}")\n`
      );
    case "airdrop":
      if (t.isNative)
        return (
          pyHeader(true) +
          `\nrecipients = ["0xRecipient1...", "0xRecipient2..."]\nAMOUNT_EACH = "${amount}"\n` +
          `value = w3.to_wei(AMOUNT_EACH, "ether")\nnonce = w3.eth.get_transaction_count(account.address)\n\n` +
          `for to in recipients:\n    try:\n` +
          `        tx = {\n            "to": Web3.to_checksum_address(to), "value": value, "from": account.address,\n            "chainId": ${PHAROS.chainId}, "nonce": nonce, "gasPrice": w3.eth.gas_price, "gas": 21000,\n        }\n` +
          `        signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)\n` +
          `        h = w3.eth.send_raw_transaction(signed.raw_transaction)\n` +
          `        w3.eth.wait_for_transaction_receipt(h)\n        print(f"-> {to}: 0x{h.hex()}")\n        nonce += 1\n` +
          `    except Exception as e:\n        print(f"x {to}: {e}")\nprint("Airdrop done.")\n`
        );
      return (
        pyHeader(true) +
        `\n${PY_ERC20_ABI}\nrecipients = ["0xRecipient1...", "0xRecipient2..."]\nAMOUNT_EACH = "${amount}"\n` +
        `token = w3.eth.contract(address=Web3.to_checksum_address("${t.address}"), abi=ERC20_ABI)\n` +
        `dec = token.functions.decimals().call()\nvalue = int(float(AMOUNT_EACH) * 10 ** dec)\n` +
        `nonce = w3.eth.get_transaction_count(account.address)\n\n` +
        `for to in recipients:\n    try:\n` +
        `        to_addr = Web3.to_checksum_address(to)\n` +
        `        tx = token.functions.transfer(to_addr, value).build_transaction({\n            "from": account.address, "chainId": ${PHAROS.chainId},\n            "nonce": nonce, "gasPrice": w3.eth.gas_price,\n        })\n` +
        `        tx["gas"] = w3.eth.estimate_gas(tx)\n` +
        `        signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)\n` +
        `        h = w3.eth.send_raw_transaction(signed.raw_transaction)\n` +
        `        w3.eth.wait_for_transaction_receipt(h)\n        print(f"-> {to}: 0x{h.hex()}")\n        nonce += 1\n` +
        `    except Exception as e:\n        print(f"x {to}: {e}")\nprint("Airdrop done.")\n`
      );
    case "gas":
      return (
        pyHeader(false) +
        `\nFROM = Web3.to_checksum_address("${ADDR(p.to, "0xYourAddress00000000000000000000000000000")}")\n` +
        `TO = Web3.to_checksum_address("${ADDR(p.contract, "0xRecipientAddress0000000000000000000000000")}")\n\n` +
        `try:\n    gas = w3.eth.estimate_gas({"from": FROM, "to": TO, "value": w3.to_wei("${amount}", "ether")})\n` +
        `    price = w3.eth.gas_price\n    print("Gas units:", gas)\n    print("Est. cost (${PHAROS.symbol}):", w3.from_wei(gas * price, "ether"))\n` +
        `except Exception as e:\n    raise SystemExit(f"Estimate failed: {e}")\n`
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Foundry (cast / forge)
// ─────────────────────────────────────────────────────────────────────────────
function foundryScript(op: ScriptOperation, p: ScriptParams): string {
  const t = resolveToken(p.token);
  const amount = p.amount ?? "1.0";
  const rpc = `--rpc-url ${PHAROS.rpc}`;
  const head = `# Pharos mainnet (chainId ${PHAROS.chainId}) — Foundry cast/forge\n# Pharos' official tooling builds on Foundry.\n`;
  switch (op) {
    case "balance":
      if (t.isNative)
        return head + `\n# Native ${PHAROS.symbol} balance:\n` + `cast balance ${ADDR(p.to, "0xYourAddress")} ${rpc} --ether\n`;
      return (
        head +
        `\n# Native ${PHAROS.symbol} balance:\n` +
        `cast balance ${ADDR(p.to, "0xYourAddress")} ${rpc} --ether\n\n` +
        `# ERC-20 (${t.symbol}) balance:\n` +
        `cast call ${t.address} "balanceOf(address)(uint256)" ${ADDR(p.to, "0xYourAddress")} ${rpc}\n`
      );
    case "read":
      return (
        head +
        `\n# Call a view function:\n` +
        `cast call ${ADDR(p.contract, "0xYourContract")} "${p.signature ?? "totalSupply()(uint256)"}" ${p.args ?? ""} ${rpc}\n`
      );
    case "write":
      return (
        head +
        `\n# PRIVATE_KEY must be set in your shell: export PRIVATE_KEY=0x...\n` +
        `cast send ${ADDR(p.contract, "0xYourContract")} "${p.signature ?? "setValue(uint256)"}" ${p.args ?? "<args>"} \\\n  ${rpc} --private-key $PRIVATE_KEY\n`
      );
    case "transfer":
      return (
        head +
        `\n# PRIVATE_KEY must be set: export PRIVATE_KEY=0x...\n\n` +
        `# Native ${PHAROS.symbol} transfer:\n` +
        `cast send ${ADDR(p.to, "0xRecipient")} --value ${amount}ether ${rpc} --private-key $PRIVATE_KEY\n\n` +
        `# ERC-20 (${t.symbol}) transfer — amount is in token base units;\n` +
        `# use cast --to-unit / parse-units for decimals (${t.symbol} has ${t.decimals}):\n` +
        `cast send ${t.address} "transfer(address,uint256)" ${ADDR(p.to, "0xRecipient")} $(cast to-wei ${amount} ${t.decimals === 6 ? "mwei" : "ether"}) \\\n  ${rpc} --private-key $PRIVATE_KEY\n`
      );
    case "deploy":
      return (
        head +
        `\n# 1) Scaffold a project and add OpenZeppelin:\n` +
        `forge init my-token && cd my-token\nforge install OpenZeppelin/openzeppelin-contracts\n\n` +
        `# 2) src/MyToken.sol:\n` +
        `#   // SPDX-License-Identifier: MIT\n#   pragma solidity ^0.8.20;\n#   import "openzeppelin-contracts/token/ERC20/ERC20.sol";\n` +
        `#   contract ${p.symbol ?? "MyToken"} is ERC20 {\n#       constructor() ERC20("${p.name ?? "MyToken"}", "${p.symbol ?? "MTK"}") {\n#           _mint(msg.sender, ${p.supply ?? "1000000"} * 10 ** decimals());\n#       }\n#   }\n\n` +
        `# 3) Deploy (PRIVATE_KEY in your shell):\n` +
        `forge create src/MyToken.sol:${p.symbol ?? "MyToken"} ${rpc} --private-key $PRIVATE_KEY --broadcast\n`
      );
    case "airdrop":
      if (t.isNative)
        return (
          head +
          `\n# Batch native ${PHAROS.symbol} airdrop. PRIVATE_KEY in your shell.\n` +
          `#!/usr/bin/env bash\nset -euo pipefail\n` +
          `RECIPIENTS=( "0xRecipient1..." "0xRecipient2..." )\n\n` +
          `for to in "\${RECIPIENTS[@]}"; do\n` +
          `  echo "-> $to"\n` +
          `  cast send "$to" --value ${amount}ether ${rpc} --private-key $PRIVATE_KEY\n` +
          `done\necho "Airdrop done."\n`
        );
      return (
        head +
        `\n# Batch ERC-20 (${t.symbol}) airdrop. PRIVATE_KEY in your shell.\n` +
        `#!/usr/bin/env bash\nset -euo pipefail\n` +
        `RECIPIENTS=( "0xRecipient1..." "0xRecipient2..." )\n` +
        `AMOUNT=$(cast to-wei ${amount} ${t.decimals === 6 ? "mwei" : "ether"})\n\n` +
        `for to in "\${RECIPIENTS[@]}"; do\n` +
        `  echo "-> $to"\n` +
        `  cast send ${t.address} "transfer(address,uint256)" "$to" "$AMOUNT" \\\n    ${rpc} --private-key $PRIVATE_KEY\n` +
        `done\necho "Airdrop done."\n`
      );
    case "gas":
      return (
        head +
        `\n# Estimate gas for a native ${PHAROS.symbol} transfer:\n` +
        `cast estimate ${ADDR(p.to, "0xRecipient")} --value ${amount}ether ${rpc}\n\n` +
        `# Current gas price:\ncast gas-price ${rpc}\n`
      );
  }
}

// ── public API ────────────────────────────────────────────────────────────────
const SIGNS: Record<ScriptOperation, boolean> = {
  balance: false,
  read: false,
  gas: false,
  write: true,
  transfer: true,
  deploy: true,
  airdrop: true,
};

const LABELS: Record<ScriptOperation, string> = {
  balance: "balance check",
  read: "contract read",
  write: "contract write",
  transfer: "token transfer",
  deploy: "ERC-20 deploy",
  airdrop: "batch airdrop",
  gas: "gas estimate",
};

export function generateScript(input: {
  operation: ScriptOperation;
  language: ScriptLanguage;
  params?: ScriptParams;
}): GeneratedScript {
  const { operation, language } = input;
  const params = input.params ?? {};
  let code: string;
  switch (language) {
    case "javascript":
      code = jsScript(operation, params);
      break;
    case "typescript":
      code = tsScript(operation, params);
      break;
    case "python":
      code = pyScript(operation, params);
      break;
    case "foundry":
      code = foundryScript(operation, params);
      break;
  }
  const ext = language === "javascript" ? "js" : language === "typescript" ? "ts" : language === "python" ? "py" : "sh";
  return {
    code: code.trimEnd() + "\n",
    lang: fence(language),
    filename: language === "foundry" ? `${operation} (cast/forge)` : `pharos-${operation}.${ext}`,
    howToRun: howTo(language, SIGNS[operation]),
    operation,
    language,
  };
}

export { LABELS as SCRIPT_LABELS };
