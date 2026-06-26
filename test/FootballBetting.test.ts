/**
 * ============================================================================
 * 单元测试 — FootballBetting 合约完整测试套件（USDT 支付版）
 * ============================================================================
 *
 * 【ETH → USDT 改造导致的测试变更】
 * 以下所有测试与 ETH 版的核心逻辑完全相同（Parimutuel 算法、状态机、权限等），
 * 但发生资金流转的操作全部改为 USDT 模式：
 *
 *   ETH 版                          USDT 版
 *   ─────────────────────────────────────────────────────────
 *   placeBet(id, opt, {value: X})   placeBet(id, opt, X)  ← 金额变成参数
 *   合约通过 msg.value 收 ETH        合约通过 transferFrom 拉 USDT  ← 需预先 approve
 *   call{value: X}("") 发 ETH      usdt.transfer(user, X) 发 USDT
 *   检查 provider.getBalance()      检查 mockUsdt.balanceOf()
 *   ethers.parseEther("0.05")       ethers.parseUnits("0.05", 18)  ← 统一 18 位小数
 *
 * 【测试账户布局（Hardhat 本地链预设的 20 个账户）】
 *   [0] owner  — 合约部署者（管理员）
 *   [1] user1  — 普通用户
 *   [2] user2  — 普通用户
 *   [3] user3  — 普通用户
 *   [4] user4  — 备用用户
 *   [5] user5  — 端到端测试用
 *   [6] user6  — 端到端测试用
 *   每个账户初始余额 10000 ETH（用于付 Gas 费），USDT 通过 mint 单独分发
 */
import { ethers } from "hardhat";
import { expect } from "chai";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { FootballBetting, FootballBetting__factory, MockERC20, MockERC20__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { U, FU, USDT_DECIMALS } from "../scripts/shared/usdt";

/** @dev 测试使用的平台手续费率：200 基点 = 2% */
const FEE_RATE = 200;

/** @dev 将字符串编码为 bytes32（空字符串 → ZeroHash） */
const B = (s: string) => s === "" ? ethers.ZeroHash : ethers.encodeBytes32String(s);

/**
 * @dev USDT 金额工具函数 — 从 scripts/shared/usdt.ts 导入
 *      Faucet USDT = 18 位小数（与 ETH/CFX 相同），1 USDT = 10^18 最小单位
 *      切换币种时修改 scripts/shared/usdt.ts 的 USDT_DECIMALS 即可
 */

describe("FootballBetting 合约（USDT 支付版）", function () {

    // ======================================================================
    // 全局测试变量
    // ======================================================================
    let contract: FootballBetting;
    let mockUsdt: MockERC20;

    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;
    let user4: SignerWithAddress;
    let addrs: SignerWithAddress[];

    /**
     * @dev 测试便捷函数：一步完成 mint + approve
     *      新加入的测试账户（如 user5/user6）调用此函数后即可投注。
     *
     *      等价于两笔链上操作：
     *        mockUsdt.mint(user.address, U("1000"))           → 发放 1000 USDT
     *        mockUsdt.connect(user).approve(contract, U("1000")) → 授权合约使用 1000 USDT
     *
     *      @param user   需要准备资金的测试账户
     *      @param amount 发放+授权的 USDT 数量（默认 1000）
     */
    async function fundAndApprove(user: SignerWithAddress, amount: string = "1000") {
        const amt = U(amount);
        await mockUsdt.mint(user.address, amt);
        await mockUsdt.connect(user).approve(await contract.getAddress(), amt);
    }

    // =========================================================================
    // before 钩子：USDT 版本的部署流程（对比 ETH 版多了 MockERC20 的初始化和授权）
    //
    // 部署顺序：MockERC20 → 给测试账户 mint USDT → FootballBetting(USDT地址) → approve
    //
    // 为什么 mocked USDT 地址作为 constructor 参数传入？
    // 合约不再硬编码代币地址，而是由部署者指定。测试环境传入 MockERC20 地址，
    // 真实环境传入链上 USDT 地址，合约代码完全不用改。
    // =========================================================================
    before(async function () {
        addrs = await ethers.getSigners();
        owner = addrs[0];
        user1 = addrs[1];
        user2 = addrs[2];
        user3 = addrs[3];
        user4 = addrs[4];

        // 1. 部署 Mock USDT
        mockUsdt = await new MockERC20__factory(owner).deploy();
        await mockUsdt.waitForDeployment();

        // 2. 为测试账户 mint 足够 USDT
        for (const u of [owner, user1, user2, user3, user4]) {
            await mockUsdt.mint(u.address, U("100000"));
        }

        // 3. 部署竞猜合约，传入 USDT 地址
        contract = await new FootballBetting__factory(owner).deploy(
            FEE_RATE,
            await mockUsdt.getAddress()
        );
        await contract.waitForDeployment();

        // 4. 所有测试账户 approve 合约
        const contractAddr = await contract.getAddress();
        for (const u of [owner, user1, user2, user3, user4]) {
            await mockUsdt.connect(u).approve(contractAddr, U("100000"));
        }
    });

    // ========================================================================
    // 模块一：部署和初始状态验证
    // ========================================================================
    describe("1. 部署与初始状态", function () {
        it("合约管理员应为部署者", async function () {
            expect(await contract.owner()).to.equal(owner.address);
        });

        it("初始比赛计数应为 0", async function () {
            expect(await contract.matchCounter()).to.equal(0);
        });

        it("手续费率应为 200 (2%)", async function () {
            expect(await contract.platformFeeRate()).to.equal(200);
        });

        it("平台余额初始为 0", async function () {
            expect(await contract.platformBalance()).to.equal(0);
        });

        it("USDT 地址已正确设置", async function () {
            expect(await contract.usdt()).to.equal(await mockUsdt.getAddress());
        });

        it("合约不接受 ETH 转账（USDT 模式下原生币转账应 revert）", async function () {
            await expect(
                owner.sendTransaction({
                    to: await contract.getAddress(),
                    value: ethers.parseEther("0.1")
                })
            ).to.be.reverted;
        });
    });

    // ========================================================================
    // 模块二：赛事管理（管理员功能）
    // ========================================================================
    describe("2. 赛事管理（管理员功能）", function () {
        let m1StartTime: number;
        let m1Deadline: number;

        before(async function () {
            const block = await ethers.provider.getBlock("latest");
            m1StartTime = block!.timestamp + 86400;
            m1Deadline = m1StartTime - 3600;
        });

        it("管理员可以创建比赛", async function () {
            const tx = await contract.connect(owner).createMatch(
                B('test'), B("巴西"), B("阿根廷"),
                m1StartTime, m1Deadline,
                U("0.01"),  // minBet: 0.01 USDT
                0, // maxBet: 不限制
            true
            );

            expect(await contract.matchCounter()).to.equal(1);

            const match = await contract.getMatch(1);
            expect(match.homeTeam).to.equal(B("巴西"));
            expect(match.awayTeam).to.equal(B("阿根廷"));
            expect(match.startTime).to.equal(m1StartTime);
            expect(match.deadline).to.equal(m1Deadline);
            expect(match.minBet).to.equal(U("0.01"));
            expect(match.maxBet).to.equal(0);
            expect(match.status).to.equal(0);

            await expect(tx)
                .to.emit(contract, "MatchCreated")
                .withArgs(1, B("test"), B("巴西"), B("阿根廷"), m1StartTime, m1Deadline, U("0.01"), 0n);
        });

        it("非管理员不能创建比赛", async function () {
            await expect(
                contract.connect(user1).createMatch(
                    B('test'), B("德国"), B("法国"), m1StartTime + 1000, m1Deadline + 1000,
                    U("0.01"), 0,
                    true
                )
            ).to.be.revertedWithCustomError(contract, "NotOwner");
        });

        it("不能创建开始时间在过去或现在的比赛", async function () {
            const pastTime = m1StartTime - 86400 - 100;
            await expect(
                contract.connect(owner).createMatch(
                    B('test'), B("中国"), B("日本"), pastTime, pastTime - 100,
                    U("0.01"), 0,
                    true
                )
            ).to.be.revertedWithCustomError(contract, "StartTimeNotFuture");
        });

        it("deadline 必须 <= startTime", async function () {
            await expect(
                contract.connect(owner).createMatch(
                    B('test'), B("中国"), B("日本"), m1StartTime, m1StartTime + 100,
                    U("0.01"), 0,
                    true
                )
            ).to.be.revertedWithCustomError(contract, "DeadlineAfterStart");
        });

        it("不能创建队名为空的比赛", async function () {
            await expect(
                contract.connect(owner).createMatch(
                    B("test"), ethers.ZeroHash, B("法国"), m1StartTime + 2000, m1Deadline + 2000,
                    U("0.01"), 0,
                    true
                )
            ).to.be.revertedWithCustomError(contract, "TeamNameEmpty");
        });

        it("管理员可以开放比赛投注", async function () {
            const tx = await contract.connect(owner).openMatch(1);
            expect((await contract.getMatch(1)).status).to.equal(1);
            await expect(tx).to.emit(contract, "MatchOpened").withArgs(1);
        });

        it("不能开放不存在的比赛", async function () {
            await expect(
                contract.connect(owner).openMatch(999)
            ).to.be.revertedWithCustomError(contract, "MatchNotExist");
        });

        it("不能重复开放同一场比赛", async function () {
            await expect(
                contract.connect(owner).openMatch(1)
            ).to.be.revertedWithCustomError(contract, "MatchNotCreated");
        });

        it("管理员可以关闭比赛投注", async function () {
            const tx = await contract.connect(owner).closeMatch(1);
            expect((await contract.getMatch(1)).status).to.equal(2);
            await expect(tx).to.emit(contract, "MatchClosed").withArgs(1);
        });
    });

    // ========================================================================
    // 模块三：用户投注（USDT transferFrom 模式）
    // ========================================================================
    describe("3. 用户投注", function () {
        let m2StartTime: number;
        let m2Deadline: number;

        before(async function () {
            const block = await ethers.provider.getBlock("latest");
            m2StartTime = block!.timestamp + 7200;
            m2Deadline = m2StartTime - 3600;

            await contract.connect(owner).createMatch(
                B('test'), B("英格兰"), B("德国"),
                m2StartTime, m2Deadline,
                U("0.01"),        // minBet
                U("1"),     // maxBet: 1 USDT = 1,000,000 最小单位
            true
            );
            await contract.connect(owner).openMatch(2);
        });

        it("用户可以投注主队胜（USDT 模式，需先 approve）", async function () {
            const betAmount = U("0.05"); // 0.05 USDT
            const tx = await contract.connect(user1).placeBet(2, 1, betAmount);

            const bet = await contract.getUserBet(2, user1.address);
            expect(bet.amount).to.equal(betAmount);
            expect(bet.betOn).to.equal(1);
            expect(bet.claimed).to.equal(false);

            await expect(tx)
                .to.emit(contract, "BetPlaced")
                .withArgs(2, user1.address, betAmount, 1);

            // 验证 USDT 已从 user1 转入合约
            expect(await mockUsdt.balanceOf(await contract.getAddress()))
                .to.equal(betAmount);
        });

        it("其他用户可以投注不同结果", async function () {
            const betAmount = U("0.06"); // 0.06 USDT
            await contract.connect(user2).placeBet(2, 3, betAmount);

            const bet = await contract.getUserBet(2, user2.address);
            expect(bet.amount).to.equal(betAmount);
            expect(bet.betOn).to.equal(3);
        });

        it("第三个用户投注平局", async function () {
            const betAmount = U("0.03"); // 0.03 USDT
            await contract.connect(user3).placeBet(2, 2, betAmount);

            const match = await contract.getMatch(2);
            expect(match.poolHome).to.equal(U("0.05"));
            expect(match.poolDraw).to.equal(U("0.03"));
            expect(match.poolAway).to.equal(U("0.06"));
            expect(match.totalPool).to.equal(U("0.14")); // 0.14 USDT
        });

        it("同一用户可以对同一场比赛追加投注", async function () {
            // user4 首次投注 0.02，再追加 0.01 应累加为 0.03
            await contract.connect(user4).placeBet(2, 2, U("0.02"));
            await contract.connect(user4).placeBet(2, 2, U("0.01"));
            const bet = await contract.getUserBet(2, user4.address);
            expect(bet[0]).to.equal(U("0.03")); // 0.02 + 0.01 = 0.03
            // 清理，避免影响后续测试的奖池计算
            await contract.connect(user4).cancelBet(2);
        });

        it("不能投注不存在的比赛", async function () {
            await expect(
                contract.connect(user4).placeBet(999, 1, U("0.01"))
            ).to.be.revertedWithCustomError(contract, "MatchNotExist");
        });

        it("不能投注未开放的比赛", async function () {
            const block = await ethers.provider.getBlock("latest");
            const t = block!.timestamp + 10000;
            await contract.connect(owner).createMatch(
                B('test'), B("法国"), B("意大利"), t + 7200, t + 3600,
                U("0.01"), 0,
            true
            );
            await expect(
                contract.connect(user4).placeBet(3, 1, U("0.01"))
            ).to.be.revertedWithCustomError(contract, "MatchNotOpen");
        });

        it("不能投注无效的结果类型", async function () {
            await expect(
                contract.connect(user4).placeBet(2, 0, U("0.01"))
            ).to.be.revertedWithCustomError(contract, "InvalidResult");
        });

        it("投注金额低于最低限额时拒绝", async function () {
            await contract.connect(owner).openMatch(3);
            await expect(
                contract.connect(user4).placeBet(3, 1, U("0.001")) // 10 < minBet(100)
            ).to.be.revertedWithCustomError(contract, "BelowMinBet");
        });

        it("投注金额超过最高限额时拒绝", async function () {
            await expect(
                contract.connect(user4).placeBet(2, 1, U("2")) // 2 USDT > maxBet(1)
            ).to.be.revertedWithCustomError(contract, "AboveMaxBet");
        });

        it("投注截止后不能投注", async function () {
            await time.increaseTo(m2Deadline + 1);
            await expect(
                contract.connect(user4).placeBet(2, 1, U("0.01"))
            ).to.be.revertedWithCustomError(contract, "DeadlineNotPassed");
        });
    });

    // ========================================================================
    // 模块四：结算与奖励领取
    // ========================================================================
    describe("4. 结算与奖励领取", function () {

        it("管理员可以录入比分（主队胜）", async function () {
            await contract.connect(owner).closeMatch(2);
            await contract.connect(owner).recordResult(2, 2, 1);

            const match = await contract.getMatch(2);
            expect(match.homeScore).to.equal(2);
            expect(match.awayScore).to.equal(1);
            expect(match.result).to.equal(1);
            expect(match.status).to.equal(3);
            expect(match.settled).to.equal(true);
        });

        it("猜对主队胜的用户可以领取 USDT 奖励", async function () {
            // 总奖池 = 0.14 USDT = 140000
            // 手续费 = 140000 * 2% = 2800
            // 可分配 = 137200
            // winningPool(Home) = 50000
            // loserPool = 137200 - 50000 = 87200
            // 奖励 = 50000 + (50000 * 87200) / 50000 = 137200
            const expectedReward = U("0.1372");

            const balBefore = await mockUsdt.balanceOf(user1.address);
            await contract.connect(user1).claimReward(2);
            const balAfter = await mockUsdt.balanceOf(user1.address);
            expect(balAfter - balBefore).to.equal(expectedReward);
        });

        it("猜错（投了客队胜）的用户领取奖励为 0", async function () {
            const balBefore = await mockUsdt.balanceOf(user2.address);
            await contract.connect(user2).claimReward(2);
            const balAfter = await mockUsdt.balanceOf(user2.address);
            expect(balAfter - balBefore).to.equal(0n);

            const bet = await contract.getUserBet(2, user2.address);
            expect(bet.claimed).to.equal(true);
            expect(bet.reward).to.equal(0);
        });

        it("猜错（投了平局）的用户领取奖励也为 0", async function () {
            await contract.connect(user3).claimReward(2);
            const bet = await contract.getUserBet(2, user3.address);
            expect(bet.claimed).to.equal(true);
            expect(bet.reward).to.equal(0);
        });

        it("不能重复领取已结算的奖励", async function () {
            await expect(
                contract.connect(user1).claimReward(2)
            ).to.be.revertedWithCustomError(contract, "AlreadyClaimed");
        });

        it("不能对未结算的比赛领取奖励", async function () {
            await expect(
                contract.connect(user1).claimReward(3)
            ).to.be.revertedWithCustomError(contract, "MatchNotSettled");
        });

        it("不能对已结算的比赛重复录入赛果", async function () {
            await expect(
                contract.connect(owner).recordResult(2, 1, 0)
            ).to.be.revertedWithCustomError(contract, "MatchAlreadySettled");
        });

        it("不能录入无法判定的比分", async function () {
            // _determineResult 三种情况全覆盖，不存在无法判定的比分
        });

        it("非管理员不能录入赛果", async function () {
            await expect(
                contract.connect(user1).recordResult(3, 1, 0)
            ).to.be.revertedWithCustomError(contract, "NotOwner");
        });

        it("previewReward 函数返回正确的预期奖励", async function () {
            const preview = await contract.previewReward(2, user1.address);
            expect(preview).to.equal(0); // 已领取

            const preview99 = await contract.previewReward(99, user1.address);
            expect(preview99).to.equal(0); // 不存在
        });
    });

    // ========================================================================
    // 模块五：平台手续费
    // ========================================================================
    describe("5. 平台手续费", function () {

        it("结算后平台应有手续费余额（USDT）", async function () {
            // 比赛 2 总奖池 0.14 USDT，手续费 2% = 0.0028 USDT = 2800
            const bal = await contract.platformBalance();
            expect(bal).to.equal(U("0.0028"));
        });

        it("管理员可以提取手续费（USDT）", async function () {
            const balBefore = await mockUsdt.balanceOf(owner.address);
            const tx = await contract.withdrawFee();
            await expect(tx)
                .to.emit(contract, "FeeWithdrawn")
                .withArgs(owner.address, U("0.0028"));

            const balAfter = await mockUsdt.balanceOf(owner.address);
            expect(balAfter - balBefore).to.equal(U("0.0028"));
            expect(await contract.platformBalance()).to.equal(0);
        });

        it("余额为 0 时不能提取", async function () {
            await expect(
                contract.withdrawFee()
            ).to.be.revertedWithCustomError(contract, "NoFees");
        });

        it("非管理员不能提取手续费", async function () {
            await expect(
                contract.connect(user1).withdrawFee()
            ).to.be.revertedWithCustomError(contract, "NotOwner");
        });
    });

    // ========================================================================
    // 模块六：安全防护
    // ========================================================================
    describe("6. 安全防护", function () {

        it("管理员权限隔离：普通用户不能调用管理员函数", async function () {
            await expect(
                contract.connect(user1).openMatch(1)
            ).to.be.revertedWithCustomError(contract, "NotOwner");

            await expect(
                contract.connect(user1).closeMatch(1)
            ).to.be.revertedWithCustomError(contract, "NotOwner");
        });

        it("重复结算拦截：不能对已结算比赛再次录入", async function () {
            await expect(
                contract.connect(owner).recordResult(2, 0, 0)
            ).to.be.revertedWithCustomError(contract, "MatchAlreadySettled");
        });

        it("不能对未关闭的比赛录入赛果", async function () {
            await expect(
                contract.connect(owner).recordResult(3, 1, 0)
            ).to.be.revertedWithCustomError(contract, "MatchNotClosedOrPast");
        });
    });

    // ========================================================================
    // 模块七：完整业务流程（端到端）
    // ========================================================================
    describe("7. 完整业务流程（端到端）", function () {
        it("完整流程：创建 → 开放 → 投注 → 关闭 → 结算 → 领奖 → 提手续费", async function () {
            const block = await ethers.provider.getBlock("latest");
            const now = block!.timestamp;
            const startTime = now + 3600;
            const deadline = now + 1800;

            // Step 1: 创建并开放
            await contract.connect(owner).createMatch(
                B('test'), B("皇家马德里"), B("巴塞罗那"),
                startTime, deadline,
                U("0.01"), 0,
            true
            );
            await contract.connect(owner).openMatch(4);
            expect((await contract.getMatch(4)).status).to.equal(1);

            // Step 2: 三位用户投注（需先 approve）
            const user5 = addrs[5];
            const user6 = addrs[6];
            await fundAndApprove(user5);
            await fundAndApprove(user6);

            await contract.connect(user4).placeBet(4, 1, U("0.1")); // 0.1 USDT HomeWin
            await contract.connect(user5).placeBet(4, 2, U("0.05"));  // 0.05 USDT Draw
            await contract.connect(user6).placeBet(4, 3, U("0.06"));  // 0.06 USDT AwayWin

            const matchBefore = await contract.getMatch(4);
            expect(matchBefore.poolHome).to.equal(U("0.1"));
            expect(matchBefore.poolDraw).to.equal(U("0.05"));
            expect(matchBefore.poolAway).to.equal(U("0.06"));
            expect(matchBefore.totalPool).to.equal(U("0.21")); // 0.21 USDT

            // Step 3: 关闭
            await time.increaseTo(deadline + 1);
            await contract.connect(owner).closeMatch(4);
            expect((await contract.getMatch(4)).status).to.equal(2);

            // Step 4: 录入赛果（平局）
            await contract.connect(owner).recordResult(4, 1, 1);
            const matchAfter = await contract.getMatch(4);
            expect(matchAfter.result).to.equal(2);
            expect(matchAfter.settled).to.equal(true);

            // Step 5: 领取奖励
            // user5 猜中：手续费=4200, 可分配=205800, winnerPool=50000
            // reward = 50000 + (50000 * (205800-50000)) / 50000 = 50000 + 155800 = 205800
            const bal5Before = await mockUsdt.balanceOf(user5.address);
            await contract.connect(user5).claimReward(4);
            const bal5After = await mockUsdt.balanceOf(user5.address);
            expect(bal5After - bal5Before).to.equal(U("0.2058"));

            // user4 猜错
            await contract.connect(user4).claimReward(4);
            expect((await contract.getUserBet(4, user4.address)).claimed).to.equal(true);

            // user6 猜错
            await contract.connect(user6).claimReward(4);
            expect((await contract.getUserBet(4, user6.address)).claimed).to.equal(true);

            // Step 6: 提取手续费
            expect(await contract.platformBalance()).to.equal(U("0.0042"));
            await contract.withdrawFee();
            expect(await contract.platformBalance()).to.equal(0);
        });
    });

    // ========================================================================
    // 模块八：查询函数
    // ========================================================================
    describe("8. 查询函数", function () {

        it("getMatchCount 返回正确数量", async function () {
            expect(await contract.getMatchCount()).to.equal(4);
        });

        it("getAllMatches 返回完整列表", async function () {
            const all = await contract.getAllMatches();
            expect(all.length).to.equal(4);
            expect(all[0].homeTeam).to.equal(B("巴西"));
            expect(all[3].homeTeam).to.equal(B("皇家马德里"));
        });

        it("getUserAllBets 返回用户全部投注", async function () {
            const [matchIds, amounts] = await contract.getUserAllBets(user1.address);
            expect(matchIds.length).to.equal(1);
            expect(matchIds[0]).to.equal(2);
            expect(amounts[0]).to.equal(U("0.05"));
        });
    });

    // ========================================================================
    // 模块九：边界情况
    // ========================================================================
    describe("9. 边界情况", function () {

        it("constructor 拒绝手续费率超过 10%", async function () {
            const factory = await ethers.getContractFactory("FootballBetting");
            const usdtAddr = await mockUsdt.getAddress();
            await expect(
                factory.deploy(1001, usdtAddr)
            ).to.be.revertedWithCustomError(contract, "FeeRateTooHigh");
        });

        it("constructor 拒绝 USDT 地址为零地址", async function () {
            const factory = await ethers.getContractFactory("FootballBetting");
            await expect(
                factory.deploy(200, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(contract, "InvalidUsdtAddress");
        });

        it("手续费率为 0（免费）也可以正常工作", async function () {
            const factory = await ethers.getContractFactory("FootballBetting");
            const usdtAddr = await mockUsdt.getAddress();
            const freeContract = await factory.deploy(0, usdtAddr);
            await freeContract.waitForDeployment();
            expect(await freeContract.platformFeeRate()).to.equal(0);
        });

        it("无人投注的比赛录入赛果也不应报错", async function () {
            const block = await ethers.provider.getBlock("latest");
            const t = block!.timestamp + 7200;
            const d = t - 3600;

            await contract.connect(owner).createMatch(
                B('test'), B("日本"), B("韩国"), t, d,
                U("0.01"), 0,
            true
            );
            await contract.connect(owner).openMatch(5);
            await contract.connect(owner).closeMatch(5);
            await contract.connect(owner).recordResult(5, 0, 0);

            const m = await contract.getMatch(5);
            expect(m.settled).to.equal(true);
            expect(m.result).to.equal(2);
            expect(m.totalPool).to.equal(0);
        });
    });

    // ========================================================================
    // 模块十：紧急暂停机制
    // ========================================================================
    describe("10. 紧急暂停机制", function () {
        let m6StartTime: number;
        let m6Deadline: number;

        before(async function () {
            const block = await ethers.provider.getBlock("latest");
            m6StartTime = block!.timestamp + 7200;
            m6Deadline = m6StartTime - 3600;
        });

        it("管理员可以暂停合约", async function () {
            const tx = await contract.connect(owner).pause();
            await expect(tx).to.emit(contract, "Paused").withArgs(owner.address);
        });

        it("暂停后不能投注", async function () {
            await expect(
                contract.connect(user1).placeBet(1, 1, U("0.01"))
            ).to.be.revertedWithCustomError(contract, "ContractPaused");
        });

        it("暂停后不能领取奖励", async function () {
            await expect(
                contract.connect(user1).claimReward(2)
            ).to.be.revertedWithCustomError(contract, "ContractPaused");
        });

        it("暂停后不能录入赛果", async function () {
            await contract.connect(owner).unpause();
            await contract.connect(owner).createMatch(
                B('test'), B("葡萄牙"), B("西班牙"), m6StartTime, m6Deadline,
                U("0.01"), 0,
            true
            );
            await contract.connect(owner).openMatch(6);
            await contract.connect(owner).closeMatch(6);
            await contract.connect(owner).pause();

            await expect(
                contract.connect(owner).recordResult(6, 1, 0)
            ).to.be.revertedWithCustomError(contract, "ContractPaused");

            await contract.connect(owner).unpause();
        });

        it("暂停期间管理员仍可创建赛事", async function () {
            await contract.connect(owner).pause();
            const block = await ethers.provider.getBlock("latest");
            const t = block!.timestamp + 7200;
            await contract.connect(owner).createMatch(
                B('test'), B("荷兰"), B("比利时"), t, t - 3600,
                U("0.01"), 0,
            true
            );
            expect(await contract.matchCounter()).to.be.greaterThan(6);
            await contract.connect(owner).unpause();
        });

        it("暂停期间 view 函数正常工作", async function () {
            await contract.connect(owner).pause();
            const matches = await contract.getAllMatches();
            expect(matches.length).to.be.greaterThan(0);
            await contract.connect(owner).unpause();
        });

        it("非管理员不能暂停", async function () {
            await expect(
                contract.connect(user1).pause()
            ).to.be.revertedWithCustomError(contract, "NotOwner");
        });

        it("非管理员不能恢复", async function () {
            await expect(
                contract.connect(user1).unpause()
            ).to.be.revertedWithCustomError(contract, "NotOwner");
        });

        it("不能重复暂停", async function () {
            await contract.connect(owner).pause();
            await expect(
                contract.connect(owner).pause()
            ).to.be.revertedWithCustomError(contract, "AlreadyPaused");
            await contract.connect(owner).unpause();
        });

        it("不能重复恢复", async function () {
            await expect(
                contract.connect(owner).unpause()
            ).to.be.revertedWithCustomError(contract, "NotPaused");
        });

        it("管理员恢复后用户可以投注", async function () {
            const block = await ethers.provider.getBlock("latest");
            const t = block!.timestamp + 7200;
            await contract.connect(owner).createMatch(
                B('test'), B("英格兰"), B("意大利"), t, t - 3600,
                U("0.01"), 0,
            true
            );
            const newMatchId = await contract.matchCounter();
            await contract.connect(owner).openMatch(newMatchId);

            await contract.connect(owner).pause();
            await expect(
                contract.connect(user4).placeBet(newMatchId, 1, U("0.01"))
            ).to.be.revertedWithCustomError(contract, "ContractPaused");

            await contract.connect(owner).unpause();
            await contract.connect(user4).placeBet(newMatchId, 1, U("0.01"));
            const bet = await contract.getUserBet(newMatchId, user4.address);
            expect(bet.amount).to.equal(U("0.01"));
        });
    });

    // ========================================================================
    // 模块十一：无人猜中时 USDT 归入平台
    // ========================================================================
    describe("11. 无人猜中时 USDT 归入平台", function () {
        let m7StartTime: number;
        let m7Deadline: number;

        before(async function () {
            const block = await ethers.provider.getBlock("latest");
            m7StartTime = block!.timestamp + 7200;
            m7Deadline = m7StartTime - 3600;
        });

        it("无人猜中时全部奖池归入平台手续费", async function () {
            const platformBefore = await contract.platformBalance();

            await contract.connect(owner).createMatch(
                B('test'), B("喀麦隆"), B("塞内加尔"),
                m7StartTime, m7Deadline,
                U("0.01"), 0,
            true
            );
            const matchId = await contract.matchCounter();
            await contract.connect(owner).openMatch(matchId);

            // 三位用户全投主队胜
            await contract.connect(user1).placeBet(matchId, 1, U("0.1")); // 0.1 USDT
            await contract.connect(user2).placeBet(matchId, 1, U("0.2")); // 0.2 USDT
            await contract.connect(user3).placeBet(matchId, 1, U("0.3")); // 0.3 USDT
            // 总奖池 = 0.6 USDT = 600000

            const m = await contract.getMatch(matchId);
            expect(m.totalPool).to.equal(U("0.6"));

            // 结果是客队胜 (AwayWin=3)，但无人投注
            await contract.connect(owner).closeMatch(matchId);
            await contract.connect(owner).recordResult(matchId, 0, 3);

            const settled = await contract.getMatch(matchId);
            expect(settled.result).to.equal(3);
            expect(settled.poolAway).to.equal(0); // 无人投注客胜

            // 全部 0.6 USDT 归入 platformBalance
            const platformAfter = await contract.platformBalance();
            expect(platformAfter - platformBefore).to.equal(U("0.6"));
        });

        it("用户领取时得到 0（无人猜中）", async function () {
            const matchId = await contract.matchCounter();

            await contract.connect(user1).claimReward(matchId);
            const bet1 = await contract.getUserBet(matchId, user1.address);
            expect(bet1.claimed).to.equal(true);
            expect(bet1.reward).to.equal(0);

            await contract.connect(user2).claimReward(matchId);
            expect((await contract.getUserBet(matchId, user2.address)).claimed).to.equal(true);
        });

        it("管理员可以提取归入平台的 USDT", async function () {
            const feeBefore = await contract.platformBalance();
            expect(feeBefore).to.be.greaterThan(0);

            await contract.withdrawFee();
            expect(await contract.platformBalance()).to.equal(0);
        });

        it("MatchSettled 事件的 distributablePool 在无人猜中时为 0", async function () {
            const block = await ethers.provider.getBlock("latest");
            const t = block!.timestamp + 7200;
            const d = t - 3600;

            await contract.connect(owner).createMatch(
                B('test'), B("加纳"), B("摩洛哥"), t, d,
                U("0.01"), 0,
            true
            );
            const matchId = await contract.matchCounter();
            await contract.connect(owner).openMatch(matchId);
            await contract.connect(user1).placeBet(matchId, 1, U("0.5")); // 全部投主胜
            await contract.connect(owner).closeMatch(matchId);

            // 结果平局，无人投注
            const tx = await contract.connect(owner).recordResult(matchId, 2, 2);
            await expect(tx)
                .to.emit(contract, "MatchSettled")
                .withArgs(matchId, 2, 2, 2 /*Draw*/, 0 /*distributablePool=0*/, U("0.5") /*全部归平台*/);
        });
    });
});
