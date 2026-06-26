/**
 * ============================================================================
 * 合约部署脚本 — 将 FootballBetting 合约部署到指定网络（USDT 支付版）
 * ============================================================================
 * 本地链：自动部署 MockERC20 作为 USDT
 * 测试网/主网：从 .env 或部署记录读取 USDT 地址
 */
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { USDT_DECIMALS } from "./shared/usdt";

const PLATFORM_FEE_RATE = 200;
const ADDITIONAL_ADMINS: string[] = [
  "0x69a44E15f5718853e757866D000a98141D49da0D",
  "0x914fAfB682e62638351699fe1c228Bc6Fd2E516E",
];

/** 打印步骤分隔线 */
const step = (n: number, title: string) => {
    console.log(`\n  ┌${"─".repeat(56)}┐`);
    console.log(`  │ 步骤 ${n}: ${title.padEnd(47)}│`);
    console.log(`  └${"─".repeat(56)}┘`);
};

/** 格式化 gas 消耗 */
const fmtGas = (gas: bigint) =>
    gas > 1_000_000n ? `${(Number(gas) / 1_000_000).toFixed(2)}M` : gas.toString();

async function main(): Promise<void> {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const deployerBalBefore = await ethers.provider.getBalance(deployer.address);

    console.log("╔" + "═".repeat(56) + "╗");
    console.log("║" + "  FootballBetting — 合约部署 (USDT)".padEnd(56) + "║");
    console.log("╚" + "═".repeat(56) + "╝");
    console.log(`  部署账户      ${deployer.address}`);
    console.log(`  部署前余额    ${ethers.formatEther(deployerBalBefore).padStart(12)} ETH`);
    console.log(`  目标网络      ${network.name} (chainId: ${network.chainId})`);
    console.log(`  手续费率      ${PLATFORM_FEE_RATE / 100}%  (${PLATFORM_FEE_RATE} 基点)`);
    console.log(`  当前区块      #${await ethers.provider.getBlockNumber()}`);

    // =========================================================================
    // USDT 地址解析策略（三步回退）
    //
    // 【为什么需要智能判断？】
    // 本地链（chainId=31337）没有真实的 USDT 合约，需要自动部署 MockERC20；
    // 测试网/主网有现成的 USDT，需要从 .env 或部署记录读取。
    // 这个判断让同一个 deploy.ts 在所有网络都可用，不需要手动修改代码。
    //
    // 优先级：
    //   ① chainId===31337 → 本地链，自动部署 MockERC20
    //   ② .env 里的 USDT_ADDRESS → 用户显式配置
    //   ③ deployments/<network>.json 里的历史记录 → 之前部署时存的
    //   ④ 都没有 → 抛出异常，提示配置
    // =========================================================================
    let usdtAddress = "";
    let mockUsdt: any = null;

    if (network.chainId === 31337n) {
        // ── ① 本地链：部署 MockERC20 作为测试 USDT ──
        step(0, "本地链 — 部署 MockERC20 模拟 USDT");
        const mockFactory = await ethers.getContractFactory("MockERC20");
        mockUsdt = await mockFactory.deploy();
        await mockUsdt.waitForDeployment();
        usdtAddress = await mockUsdt.getAddress();
        console.log(`  ✓ MockERC20 已部署  ${usdtAddress}`);
        // 给所有可用测试账户 mint USDT
        const signers = await ethers.getSigners();
        for (let i = 0; i < signers.length; i++) {
            await mockUsdt.mint(signers[i].address, ethers.parseUnits("100000", USDT_DECIMALS));
            console.log(`  ✓ 已为账户 [${i}] mint 100,000 USDT  ${signers[i].address}`);
        }
    } else {
        // ── ②/③ 测试网/主网：寻找 USDT 地址，未配置则自动部署 MockERC20 ──
        const envUsdt = process.env.USDT_ADDRESS;
        if (envUsdt) {
            usdtAddress = envUsdt;
            console.log(`  → 从 .env 读取 USDT 地址: ${usdtAddress}`);
        } else {
            // 尝试从历史部署记录中恢复（上次部署时保存的 usdtAddress）
            const networkName = network.name === "unknown" ? `chain-${network.chainId}` : network.name;
            const prevDeploy = path.join(__dirname, "..", "deployments", `${networkName}.json`);
            if (fs.existsSync(prevDeploy)) {
                const record = JSON.parse(fs.readFileSync(prevDeploy, "utf-8"));
                usdtAddress = record.usdtAddress || "";
                if (usdtAddress) console.log(`  → 从部署记录读取 USDT 地址: ${usdtAddress}`);
            }
            if (!usdtAddress) {
                // 没有配置 USDT 地址 → 自动部署 MockERC20（适合测试网做功能验证）
                step(0, "未配置 USDT — 自动部署 MockERC20");
                const mockFactory = await ethers.getContractFactory("MockERC20");
                mockUsdt = await mockFactory.deploy();
                await mockUsdt.waitForDeployment();
                usdtAddress = await mockUsdt.getAddress();
                console.log(`  ✓ MockERC20 已部署  ${usdtAddress}`);
                const signers = await ethers.getSigners();
                for (let i = 0; i < signers.length; i++) {
                    await mockUsdt.mint(signers[i].address, ethers.parseUnits("100000", USDT_DECIMALS));
                    console.log(`  ✓ 已为账户 [${i}] mint 100,000 USDT  ${signers[i].address}`);
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────
    step(1, "获取合约工厂");
    // ──────────────────────────────────────────────────────────────
    console.log(`  → getContractFactory("FootballBetting")`);
    const factory = await ethers.getContractFactory("FootballBetting");
    console.log(`  ✓ 工厂就绪 — 字节码长度: ${factory.bytecode.length} bytes`);

    // ──────────────────────────────────────────────────────────────
    step(2, "发送部署交易");
    // ──────────────────────────────────────────────────────────────
    console.log(`  → factory.deploy(feeRate=${PLATFORM_FEE_RATE}, usdt=${usdtAddress})`);
    console.log(`  → 交易类型: 合约创建 (to=null, data=bytecode)`);
    const bc = factory.bytecode ?? "";
    console.log(`  → 字节码长度: ${bc.length} bytes`);

    const contract = await factory.deploy(PLATFORM_FEE_RATE, usdtAddress);
    console.log(`  ✓ 交易已广播，等待确认...`);

    // ──────────────────────────────────────────────────────────────
    step(3, "等待区块确认");
    // ──────────────────────────────────────────────────────────────
    const deployReceipt = await contract.deploymentTransaction()!.wait();
    const contractAddress = await contract.getAddress();
    const deployerBalAfter = await ethers.provider.getBalance(deployer.address);

    console.log(`  ✓ 已确认 — 区块 #${deployReceipt!.blockNumber}`);
    console.log(`  合约地址      ${contractAddress}`);
    console.log(`  交易哈希      ${deployReceipt!.hash}`);
    console.log(`  Gas 消耗      ${fmtGas(deployReceipt!.gasUsed)} (实际: ${ethers.formatEther(deployReceipt!.gasUsed * deployReceipt!.gasPrice)} ETH)`);
    console.log(`  部署者余额    ${ethers.formatEther(deployerBalAfter).padStart(12)} ETH`);
    console.log(`  部署成本      ${ethers.formatEther(deployerBalBefore - deployerBalAfter).padStart(12)} ETH`);

    // ──────────────────────────────────────────────────────────────
    step(4, "验证初始化状态");
    // ──────────────────────────────────────────────────────────────
    const cOwner = await contract.owner();
    const cFeeRate = await contract.platformFeeRate();
    const cUsdt = await contract.usdt();
    const cMatchCnt = await contract.matchCounter();
    const cFeeBal = await contract.platformBalance();
    const cCode = await ethers.provider.getCode(contractAddress);

    const ok = (v: boolean) => v ? "✓" : "✗";
    console.log(`  ${ok(cOwner === deployer.address)} owner           = ${cOwner}`);
    console.log(`  ${ok(cFeeRate === BigInt(PLATFORM_FEE_RATE))} platformFeeRate = ${cFeeRate} (= ${Number(cFeeRate) / 100}%)`);
    console.log(`  ${ok(cUsdt.toLowerCase() === usdtAddress.toLowerCase())} usdt            = ${cUsdt}`);
    console.log(`  ${ok(cMatchCnt === 0n)} matchCounter    = ${cMatchCnt}`);
    console.log(`  ${ok(cFeeBal === 0n)} platformBalance = ${cFeeBal}`);
    console.log(`  ${ok(cCode !== "0x")} 链上字节码         ${cCode.length} bytes`);

    // ──────────────────────────────────────────────────────────────
    step(5, "添加管理员");
    // ──────────────────────────────────────────────────────────────
    for (const adminAddr of ADDITIONAL_ADMINS) {
        const tx = await contract.addAdmin(adminAddr);
        await tx.wait();
        console.log(`  ✓ 已添加管理员 ${adminAddr}`);
    }

    // ──────────────────────────────────────────────────────────────
    step(6, "部署事件日志");
    // ──────────────────────────────────────────────────────────────
    if (deployReceipt!.logs.length > 0) {
        for (const log of deployReceipt!.logs) {
            console.log(`  事件 #${log.index} — 地址: ${log.address.slice(0, 10)}...`);
        }
    } else {
        console.log(`  (部署交易无自定义事件 — 正常)`);
    }

    // ── 步骤 7：保存部署记录 ──
    step(7, "保存部署记录");
    const networkName = network.name === "unknown" ? `chain-${network.chainId}` : network.name;
    const deployDir = path.join(__dirname, "..", "deployments");
    fs.mkdirSync(deployDir, { recursive: true });

    const deployFile = path.join(deployDir, `${networkName}.json`);
    const deployRecord = {
        contractName: "FootballBetting",
        address: contractAddress,
        deployer: deployer.address,
        network: networkName,
        chainId: Number(network.chainId),
        platformFeeRate: PLATFORM_FEE_RATE,
        usdtAddress,
        txHash: deployReceipt!.hash,
        blockNumber: deployReceipt!.blockNumber,
        deployedAt: new Date().toISOString()
    };
    fs.writeFileSync(deployFile, JSON.stringify(deployRecord, null, 2));
    console.log(`  ✓ 部署记录已保存到 ${deployFile}`);

    // 同步到前端，避免手动更新 config.ts
    const frontendDeployDir = path.join(__dirname, "..", "frontend", "src", "lib", "deployments");
    fs.mkdirSync(frontendDeployDir, { recursive: true });
    const frontendDeployFile = path.join(frontendDeployDir, `${networkName}.json`);
    const frontendRecord = {
        contractAddress,
        usdtAddress,
        platformFeeRate: PLATFORM_FEE_RATE,
        deployBlock: deployReceipt!.blockNumber,
    };
    fs.writeFileSync(frontendDeployFile, JSON.stringify(frontendRecord, null, 2));
    console.log(`  ✓ 前端配置已同步到 ${frontendDeployFile}`);
    console.log(`  → 合约地址: ${contractAddress}`);
    console.log(`  → USDT 地址: ${usdtAddress}`);

    console.log("\n╔" + "═".repeat(56) + "╗");
    console.log("║" + "  部署结果".padEnd(56) + "║");
    console.log("╠" + "═".repeat(56) + "╣");
    console.log(`║  合约地址  ${contractAddress.padEnd(42)}║`);
    console.log(`║  USDT地址  ${usdtAddress.padEnd(42)}║`);
    console.log(`║  Gas 用    ${fmtGas(deployReceipt!.gasUsed).padEnd(42)}║`);
    console.log(`║  区块      ${String(deployReceipt!.blockNumber).padEnd(42)}║`);
    console.log("╚" + "═".repeat(56) + "╝");

    // ──────────────────────────────────────────────────────────────
    // 本地链专属：账户信息
    // ──────────────────────────────────────────────────────────────
    if (network.chainId === 31337n) {
        const signers = await ethers.getSigners();
        console.log("\n╔" + "═".repeat(56) + "╗");
        console.log("║" + "  本地测试账户（前 5 个）".padEnd(56) + "║");
        console.log("╚" + "═".repeat(56) + "╝");
        for (let i = 0; i < 5; i++) {
            const eth = await ethers.provider.getBalance(signers[i].address);
            const usdtBal = await mockUsdt.balanceOf(signers[i].address);
            const role = i === 0 ? "管理员" : "用户";
            console.log(`  [${i}] ${signers[i].address} ${role}`);
            console.log(`       ETH: ${ethers.formatEther(eth).slice(0, 8)}  USDT: ${ethers.formatUnits(usdtBal, 18)}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error("\n╔" + "═".repeat(56) + "╗");
        console.error("║  部署失败".padEnd(56) + "║");
        console.error("╚" + "═".repeat(56) + "╝");
        console.error(error);
        process.exit(1);
    });
