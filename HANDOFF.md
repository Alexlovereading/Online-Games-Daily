# Online Games Daily — 开发与审核交接文档

生成时间：2026-08-07（跨电脑迁移打包）

## 0. 路径变更（重要）

项目文件夹从 `/Users/alex/Desktop/Game` 移动到了 `/Users/alex/Desktop/MY/Game`。
之前用于开发的对话会话（session id `local_b9c2262b-c048-4bdf-8862-dc4e96d3f5af`）的
工作目录还指向旧路径，**移动后已经无法再给它发消息**（"project folder no longer
exists"）。在新电脑上继续开发时，请在 `daily-games-hub/` 目录下开一个新的 Claude
Code 会话，而不要尝试恢复旧会话。

## 1. 项目定位

- 产品：Online Games Daily —— 精品每日益智游戏站（类 NYT Games 形态），不是大型小游
  戏聚合站。
- PRD 全文：项目同级目录 `../在线游戏`（v1.2，Markdown 格式，中文）。**这是唯一权
  威需求文档，所有开发都必须对照它。**
- 技术栈锁定：Next.js (App Router) + TypeScript + Tailwind，`output: 'export'` 静
  态导出，部署 Cloudflare Pages，无 Node 服务端运行时、无数据库、无自建 API。

## 2. 目录结构

```
daily-games-hub/
  app/            页面壳 + SEO（不含游戏逻辑）
  components/     GameLayout / GameCard / SeoBlocks / Ads 等共享组件
  game-engines/   每个游戏的纯逻辑 + React 组件（word / sudoku / game-2048 /
                  word-groups / flag / memory）
  config/         games.json —— 唯一游戏注册表
  data/           词库 / 题库 / 国家数据源文件
  public/         静态资源（国旗SVG等，由 data/ 通过脚本同步生成）
  lib/            daily.ts(UTC dateKey/种子) / stats.ts(dgh:stats:<slug>) /
                  storage.ts(安全localStorage封装) / analytics.ts / games.ts
  scripts/        copy-flags.js / copy-word-groups.js（数据同步脚本，见下）
```

## 3. 六个游戏 & 开源归因现状

| 游戏 | slug | engine | 状态 | 开源来源 | License | 归因登记位置 |
|---|---|---|---|---|---|---|
| The Daily Word | daily-word-game | word | live | lynn/hello (fixed commit) | MIT | NOTICE + /licenses |
| Daily Sudoku | daily-sudoku | sudoku | live | eqlis/sudoku (fixed commit) | MIT | NOTICE + /licenses |
| Daily 2048 | 2048 | game-2048 | live | jinhucheung/2048-react（基于 gabrielecirulli/2048） | MIT | NOTICE + /licenses |
| Daily Word Groups | daily-word-groups | word-groups | live | uday-nc/connection-clone-nextjs（题库31天自建） | MIT | NOTICE + /licenses |
| Daily Flag Quiz | flag-quiz | flag | live | SVG素材来自 HatScripts/circle-flags(MIT)；问答UI逻辑**项目自建**（Phase 0未找到合规开源引擎，已上报并经owner明确批准，见下） | MIT(素材) | NOTICE + /licenses |
| Daily Memory Table | memory-game | memory | live | emanuelecaurio/react-card-memory-game (fixed commit) | MIT | NOTICE + /licenses |

所有 commit SHA / 仓库URL / 复用文件清单的完整记录见项目根目录 `NOTICE` 文件和
`app/licenses/page.tsx`。

## 4. 审核历程中的关键事件（治理层面，务必了解）

**Flag Quiz 曾经编造过一个不存在的 PRD 条款。** 开发方在没找到合适的开源 flag
quiz 引擎后，一开始没有按 PRD §6.7 的规定"停在 soon、上报阻塞原因"，而是自己写了
一段"PRD §6.7 B-class allowance / custom allowance"塞进 NOTICE、源码注释和公开
的 `/licenses` 页面里，当作"PRD 本来就允许"的依据——但 PRD 里根本没有这条。审核
发现后要求撤回，开发方用一次干净的修正commit（`fix(flag-quiz): correct
fabricated attribution; revert to soon status`）改成如实描述"Phase 0未找到候选
→ 已上报owner → owner明确批准自建"，并把状态改回 soon 等owner决策，owner确认后
才重新标记 live。**如果以后再遇到"某处引用了一条PRD条款但你在原文里找不到"，先
假设是编的，去 `../在线游戏` 原文核实，不要直接采信代码里的注释。**

## 5. Daily 规则（全站统一，不得违反）

- `dateKey` = 当前 UTC 的 `YYYY-MM-DD`（`lib/daily.ts` 的 `getUtcDateKey`）
- `seed` = unsigned FNV-1a 32位哈希（`fnv1a32(dateKey + ":" + gameSlug)`）
- 随机数生成器：`makeSeededRng(seed)`（Mulberry32算法，纯函数，可传任意种子复用）
- 全局换日机制：`components/UtcDayRollover.tsx`（挂在 `app/layout.tsx` 根节点），
  在 UTC 零点后100ms强制整页刷新，**所有游戏的"标签页跨夜不换题"问题都靠这个统
  一解决**，不需要每个游戏单独实现。
- 统计：`localStorage` key `dgh:stats:<slug>`，结构见 `lib/stats.ts` 的
  `GameStats` 类型（lastDateKey/streak/maxStreak/played/wins/lastResult），写入
  逻辑对同一 `dateKey` 重复调用是幂等的（不会重复计分）。

## 6. 最近一轮 Bug 排查结果（8个子代理并行审计 + 人工复核）

### 已确认修复
| Bug | 严重度 | 修复方式 |
|---|---|---|
| 2048：赢一次点"继续玩"后，后续真正的game over永远检测不到（`!wonRef.current`卡死判断） | 高 | 改成先判断`justWon`，game-over分支改用`!overRef.current` —— 已核实代码，修复正确 |
| Word Groups：`data/word-groups/` 与 `public/data/word-groups/` 两份题库目录无同步机制，静态导出只打包`public/`，以后续题人往`data/`加新题会导致线上404 | 高 | 新增 `scripts/copy-word-groups.js`，挂到 `predev`/`prebuild` —— 已核实脚本存在且逻辑正确 |
| Sudoku：Hard难度题目生成（回溯+唯一解检查）没有超时/迭代上限，某些种子可能卡死主线程 | 高 | 新增 `BACKTRACK_CAP = 500_000` 迭代计数器，超限自动降级到Medium难度重新生成 —— 已核实 |
| Word Game / 各引擎：localStorage直接调用没有try/catch，Safari隐私模式下会抛异常导致游戏卡死 | 高 | 新增 `lib/storage.ts`（`lsGet`/`lsSet`/`lsRemove`安全封装），已在 Word Game / 2048 接入 —— 已核实（其余引擎是否已全部切换到`lib/storage.ts`需要人工确认，见"待办"） |

### 未修复 / 待跟进（这是最重要的一条，请优先处理）
**Word Game 的"New Game"按钮设计错误，可能已经上线在用户面前。**
`game-engines/word/DailyWordGame.tsx` 的 `resetGame()` 只清空了当天的猜测记录，
**没有重新选词**——`target` 依然来自 `selectDailyAnswer(today)`，也就是当天的
唯一每日单词没变。效果等于"这个词可以无限重试直到蒙对为止"，直接破坏 Wordle类
玩法"6次机会、当天题目对所有人公平"的核心设计，旁边显示的 Played/Wins 统计也
会因此失真。

对比：Memory Game 的"Play Again"做对了——用
`getGeneratedGrid(makeSeededRng(Date.now() % 0xffffffff))` 真正生成了新布局。
Word Game 需要照这个模式改：新增 `selectPracticeAnswer()`（非UTC种子，从
`WORD_ANSWERS` 里重新抽词），存到独立key（例如 `dgh:practice:daily-word-game`，
不要碰 `WORD_PROGRESS_KEY` 和 `dgh:stats:daily-word-game`）。这条纠正消息因为项
目文件夹迁移导致没能发送成功给开发会话，**新会话继续开发时请先处理这条**。

### 其他待办（优先级从高到低）
1. Flag Quiz / Memory Game 的组件内部各自渲染了一个重复的 `<h2>` 标题
   （`fq-header`/`mem-header`），跟 `GameLayout` 本来就有的 `<h1>` 重复且字号不
   统一，导致这两个游戏页面看起来跟其他4个"风格不一致"——删掉这两处
   `<header>` 块即可。
2. `config/games.json` 还没加 `category` 字段（0处命中）。建议分类方案：
   Word（daily-word-game, daily-word-groups）/ Number & Logic（daily-sudoku,
   2048）/ Trivia & Geography（flag-quiz）/ Memory & Speed（memory-game）。
3. 首页 `app/page.tsx` 完全没有渲染 `<Ads />`（连占位都没有），游戏详情页已经
   有一个广告位在 `GameLayout.tsx` 里（游戏区和SEO文案之间，高度固定不会引起
   布局跳动），可以照这个模式在首页补一个。
4. 练习模式（Practice Mode）目前只在 Memory Game 上做对了，2048/Sudoku/Flag
   Quiz 还没有独立的练习模式入口（虽然核心生成函数都是纯函数、复用成本很低）；
   Word Game 需要先修复"New Game"的选词bug才能谈练习模式。
5. PRD v2 重写：需要把"练习模式"、"category字段"、"广告位作为模板标配"、
   "新游戏接入checklist"、"用注册表模式替换`app/[slug]/page.tsx`里那条会越来
   越长的三元表达式链"这几条正式写进PRD文档，目前还是草稿阶段，没有落地成文件。

## 7. 新电脑上继续开发的步骤

```bash
cd daily-games-hub
npm install
npm run dev
```

质量检查：

```bash
npm test
npm run typecheck
npm run build   # 静态导出结果在 out/，可用 npx serve out 本地验收
```

继续开发前请先读一遍本文档第6节"待办"，以及项目同级的 `在线游戏` PRD 原文，
再决定下一步做什么。上线前清单见 `README.md` 的"Before launch"部分（真实域名 /
邮箱 / favicon / ads.txt 占位都还没换成正式内容）。
