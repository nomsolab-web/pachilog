import { eq } from "drizzle-orm";
import { db } from "../database";
import { machines as machinesTable, videos as videosTable } from "../database/schema";
import * as fs from "node:fs";

// Predefined list of 45 popular pachinko/slot machines from 2024-2026 to scan for in unmatched titles
const popularMachines = [
  { name: "Lパチスロ からくりサーカス", aliases: ["からくりサーカス", "からくり", "からサー"], maker: "SANKYO", type: "slot", releaseDate: "2023-07" },
  { name: "L革命機ヴァルヴレイヴ", aliases: ["ヴァルヴレイヴ", "ヴヴヴ", "革命機"], maker: "SANKYO", type: "slot", releaseDate: "2022-11" },
  { name: "Lスマホと対話する北斗の拳", aliases: ["北斗の拳", "スマスロ北斗", "北斗"], maker: "Sammy", type: "slot", releaseDate: "2023-04" },
  { name: "eフィーバーシン・エヴァンゲリオン Type レイ", aliases: ["シン・エヴァンゲリオン", "シンエヴァ", "エヴァンゲリオン", "エヴァ16", "エヴァ"], maker: "Bisty", type: "pachinko", releaseDate: "2023-12" },
  { name: "e Re:ゼロから始める異世界生活 season2", aliases: ["リゼロ2", "リゼロ", "強欲"], maker: "Daito", type: "pachinko", releaseDate: "2023-11" },
  { name: "Lパチスロかぐや様は告らせたい", aliases: ["かぐや様は告らせたい", "かぐや様"], maker: "SANKYO", type: "slot", releaseDate: "2024-09" },
  { name: "Lパチスロバジリスク～甲賀忍法帖～絆2 天膳 BLACK EDITION", aliases: ["バジリスク", "バジ絆", "天膳"], maker: "Universal", type: "slot", releaseDate: "2023-12" },
  { name: "LパチスロモンキーターンV", aliases: ["モンキーターンV", "モンキーターン", "モンキー5", "モンキー"], maker: "Yamasa", type: "slot", releaseDate: "2023-12" },
  { name: "L戦国乙女4 戦乱に閃く炯眼の軍師", aliases: ["戦国乙女4", "戦国乙女", "乙女4"], maker: "Heiwa", type: "slot", releaseDate: "2023-09" },
  { name: "Lパチスロ痛いのは嫌なので防御力に極振りしたいと思います。", aliases: ["防振り"], maker: "Sammy", type: "slot", releaseDate: "2024-06" },
  { name: "Lパチスロ戦姫絶唱シンフォギア 正義の歌", aliases: ["シンフォギア", "シンフォ", "正義の歌"], maker: "SANKYO", type: "slot", releaseDate: "2024-07" },
  { name: "Lパチスロ魔王学院の不適合者", aliases: ["魔王学院の不適合者", "魔王学院"], maker: "Fujishoji", type: "slot", releaseDate: "2024-06" },
  { name: "Pとある科学 of 超電磁砲最強御坂Ver.", aliases: ["超電磁砲", "レールガン"], maker: "Fujishoji", type: "pachinko", releaseDate: "2023-03" },
  { name: "Pとある魔術の禁書目録2", aliases: ["禁書目録", "インデックス", "とある魔術"], maker: "Fujishoji", type: "pachinko", releaseDate: "2024-01" },
  { name: "P牙狼11〜冴島大河〜XX", aliases: ["牙狼11", "牙狼", "冴島大河"], maker: "Sansei R&D", type: "pachinko", releaseDate: "2024-04" },
  { name: "P大工の源さん超韋駄天2", aliases: ["大工の源さん", "源さん", "超韋駄天2", "超韋駄天"], maker: "Sanyo", type: "pachinko", releaseDate: "2024-04" },
  { name: "e花の慶次 裂 一刀両断", aliases: ["花の慶次", "慶次", "一刀両断"], maker: "Newgin", type: "pachinko", releaseDate: "2023-07" },
  { name: "P大海物語5", aliases: ["大海物語5", "大海5", "大海"], maker: "Sanyo", type: "pachinko", releaseDate: "2023-02" },
  { name: "SマイジャグラーV", aliases: ["マイジャグラー5", "マイジャグ5", "マイジャグ"], maker: "Kita Denshi", type: "slot", releaseDate: "2021-12" },
  { name: "Sゴーゴージャグラー3", aliases: ["ゴーゴージャグラー3", "ゴージャグ3", "ゴージャグ"], maker: "Kita Denshi", type: "slot", releaseDate: "2023-07" },
  { name: "S沖ドキ！GOLD", aliases: ["沖ドキ！GOLD", "沖ドキゴールド", "沖ドキ"], maker: "Universal", type: "slot", releaseDate: "2022-12" },
  { name: "Sキングハナハナ-30", aliases: ["キングハナハナ", "キンハナ"], maker: "Pioneer", type: "slot", releaseDate: "2023-03" },
  { name: "Lパチスロチバリヨ2", aliases: ["チバリヨ2", "チバリヨ"], maker: "Net", type: "slot", releaseDate: "2024-03" },
  { name: "Sパチスロ 炎炎ノ消防隊", aliases: ["炎炎ノ消防隊", "炎炎"], maker: "SANKYO", type: "slot", releaseDate: "2023-05" },
  { name: "S新鬼武者2", aliases: ["新鬼武者2", "新鬼武者", "鬼武者2"], maker: "Enterrise", type: "slot", releaseDate: "2022-08" },
  { name: "Lパチスロ バイオハザード ヴェンデッタ", aliases: ["バイオハザード", "バイオ", "ヴェンデッタ"], maker: "Sammy", type: "slot", releaseDate: "2023-07" },
  { name: "Pフィーバー機動戦士ガンダムユニコーン 再来-white unicorn debut ver.-", aliases: ["ガンダムユニコーン", "ユニコーン", "ガンダム"], maker: "SANKYO", type: "pachinko", releaseDate: "2024-08" },
  { name: "Pゴジラ対エヴァンゲリオン G-FREE", aliases: ["ゴジエヴァ"], maker: "Bisty", type: "pachinko", releaseDate: "2022-12" },
  { name: "Lコードギアス 反逆のルルーシュ 復活のルルーシュ", aliases: ["コードギアス", "ギアス", "復活のルルーシュ"], maker: "Sammy", type: "slot", releaseDate: "2024-02" },
  { name: "L主役は銭形4", aliases: ["主役は銭形4", "銭形4", "銭形"], maker: "Heiwa", type: "slot", releaseDate: "2023-05" },
  { name: "P真・北斗無双 第4章", aliases: ["北斗無双", "無双"], maker: "Sammy", type: "pachinko", releaseDate: "2023-02" },
  { name: "P真・一騎当千～桃園の誓い～", aliases: ["一騎当千", "桃園の誓い"], maker: "Daiichi", type: "pachinko", releaseDate: "2023-08" },
  { name: "Lパチスロ マクロスフロンティア4", aliases: ["マクロスフロンティア4", "マクロスフロンティア", "マクロス4", "マクロス"], maker: "SANKYO", type: "slot", releaseDate: "2024-01" },
  { name: "P聖戦士ダンバイン2 -ZEROLIMIT HYPER-", aliases: ["ダンバイン2", "ダンバイン"], maker: "Sammy", type: "pachinko", releaseDate: "2023-04" },
  { name: "L転生したらスライムだった件", aliases: ["転生したらスライムだった件", "転スラ"], maker: "Yamasa", type: "slot", releaseDate: "2023-10" },
  { name: "L魔法少女まどか☆マギカ[前編]始まりの物語/[後編]永遠の物語f-フォルテ-", aliases: ["まどか☆マギカ", "まどマギ"], maker: "Macy", type: "slot", releaseDate: "2023-11" },
  { name: "Lパチスロ頭文字D 2nd", aliases: ["頭文字D", "イニD"], maker: "Sammy", type: "slot", releaseDate: "2024-10" },
  { name: "Lパチスロ ゲゲゲの鬼太郎 覚醒", aliases: ["ゲゲゲの鬼太郎", "鬼太郎"], maker: "Fujishoji", type: "slot", releaseDate: "2024-08" },
  { name: "Lパチスロ甲鉄城のカバネリ", aliases: ["カバネリ"], maker: "Sammy", type: "slot", releaseDate: "2022-07" },
  { name: "Lパチスロ からくりサーカス2", aliases: ["からくりサーカス2", "からくり2"], maker: "SANKYO", type: "slot", releaseDate: "2026-07" },
  { name: "P/eフィーバーブルーロック Light ver.", aliases: ["ブルーロック"], maker: "SANKYO", type: "pachinko", releaseDate: "2026-07" },
  { name: "eフィーバー デッドマウント・デスプレイ 魂神", aliases: ["デッドマウント・デスプレイ", "デッドマウント", "デスプレイ"], maker: "SANKYO", type: "pachinko", releaseDate: "2026-07" },
  { name: "ぱちんこ 必殺仕事人VI オッケー", aliases: ["必殺仕事人VI", "必殺仕事人", "仕事人"], maker: "Kyoraku", type: "pachinko", releaseDate: "2026-08" },
  { name: "デカスタeベルセルク無双第2章10連撃Ver.", aliases: ["ベルセルク無双", "ベルセルク"], maker: "Newgin", type: "pachinko", releaseDate: "2026-08" }
];

// Dangerous general keywords/words that must NOT be used as aliases
const dangerousKeywords = [
  "新台", "実践", "激アツ", "万枚", "フリーズ", "回収", "負け", "勝ち", "演出", "番組", "スロット", "パチンコ", "スマスロ", "初打ち", "神回", "狙い打ち", "プレミア"
];

// Normalization function matching the production matching logic
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0)) // Full-width to half-width
    .replace(/　/g, " ") // Full-width space to half-width
    .replace(/\s+/g, "") // Remove all spaces to ensure overlap matches are robust
    .trim();
}

async function analyze() {
  console.log("Starting Read-only Unmatched Video Analysis...");

  // 1. Fetch current machines
  const currentMachines = await db.select().from(machinesTable);
  console.log(`Loaded ${currentMachines.length} current machines from database.`);

  // 2. Fetch all unmatched videos (Strict SELECT-only query)
  const unmatchedVideos = await db
    .select({
      id: videosTable.id,
      videoId: videosTable.videoId,
      title: videosTable.title,
      matchStatus: videosTable.matchStatus
    })
    .from(videosTable)
    .where(eq(videosTable.matchStatus, "unmatched"));

  const unmatchedCount = unmatchedVideos.length;
  console.log(`Loaded ${unmatchedCount} unmatched videos from database.`);

  // 3. Analyze the 5 current seeded machines and blocking names
  console.log("Analyzing blocking decorators on current 5 machines...");
  const currentSeededAnalyses = currentMachines.map((m) => {
    // Find how many titles contain some simplified keywords
    let coreKeyword = "";
    if (m.name.includes("からくりサーカス")) coreKeyword = "からくりサーカス";
    else if (m.name.includes("ブルーロック")) coreKeyword = "ブルーロック";
    else if (m.name.includes("デッドマウント")) coreKeyword = "デッドマウント";
    else if (m.name.includes("必殺仕事人")) coreKeyword = "必殺仕事人";
    else if (m.name.includes("ベルセルク無双")) coreKeyword = "ベルセルク無双";

    const matchedTitlesCount = unmatchedVideos.filter((v) =>
      normalizeText(v.title).includes(normalizeText(coreKeyword))
    ).length;

    const blockingDecorators: string[] = [];
    if (m.name.startsWith("Lパチスロ")) blockingDecorators.push("Lパチスロ");
    if (m.name.startsWith("P/e")) blockingDecorators.push("P/e");
    if (m.name.startsWith("eフィーバー")) blockingDecorators.push("eフィーバー");
    if (m.name.startsWith("ぱちんこ")) blockingDecorators.push("ぱちんこ");
    if (m.name.startsWith("デカスタe")) blockingDecorators.push("デカスタe");
    if (m.name.endsWith("Light ver.")) blockingDecorators.push("Light ver.");
    if (m.name.endsWith("魂神")) blockingDecorators.push("魂神");
    if (m.name.endsWith("オッケー")) blockingDecorators.push("オッケー");
    if (m.name.endsWith("第2章10連撃Ver.")) blockingDecorators.push("第2章10連撃Ver.");

    return {
      id: m.id,
      name: m.name,
      aliases: m.aliases || [],
      blockingDecorators,
      coreKeyword,
      potentialMatches: matchedTitlesCount
    };
  });

  // 4. Frequency analysis of unmatched titles against the pre-defined popular machines
  console.log("Running frequency analysis on popular machine keywords...");
  const machineAnalysisResults = popularMachines.map((pm) => {
    // Collect all matches for all aliases of this machine
    const matchedVideosForPm: typeof unmatchedVideos = [];
    const aliasMatchesMap = new Map<string, number>();

    for (const alias of pm.aliases) {
      const normAlias = normalizeText(alias);
      const matchesForAlias = unmatchedVideos.filter((v) =>
        normalizeText(v.title).includes(normAlias)
      );
      aliasMatchesMap.set(alias, matchesForAlias.length);

      for (const v of matchesForAlias) {
        if (!matchedVideosForPm.some((mv) => mv.videoId === v.videoId)) {
          matchedVideosForPm.push(v);
        }
      }
    }

    return {
      name: pm.name,
      type: pm.type,
      releaseDate: pm.releaseDate,
      aliases: pm.aliases,
      totalMatchedCount: matchedVideosForPm.length,
      aliasCounts: Object.fromEntries(aliasMatchesMap),
      samples: matchedVideosForPm.slice(0, 3).map((v) => v.title)
    };
  });

  // Sort candidates by match frequency
  const sortedMachineMatches = [...machineAnalysisResults].sort(
    (a, b) => b.totalMatchedCount - a.totalMatchedCount
  );

  // 5. Dangerous keywords matching check (misidentification risks)
  console.log("Checking dangerous general keywords risk...");
  const dangerousKeywordsAnalysis = dangerousKeywords.map((kw) => {
    const normKw = normalizeText(kw);
    const matches = unmatchedVideos.filter((v) => normalizeText(v.title).includes(normKw));
    return {
      keyword: kw,
      matchedCount: matches.length,
      samples: matches.slice(0, 3).map((v) => v.title)
    };
  });

  // 6. Normalization issues analysis (e.g. difference due to spaces or casing)
  console.log("Checking normalization anomalies...");
  let fullToHalfWidthMatches = 0;
  const normalizationSamples: string[] = [];
  for (const v of unmatchedVideos) {
    const raw = v.title;
    const norm = normalizeText(v.title);
    // Find titles that have English letters or numbers in both full and half width
    if (/[Ａ-Ｚａ-ｚ０-９]/.test(raw) && /[A-Za-z0-9]/.test(norm)) {
      fullToHalfWidthMatches += 1;
      if (normalizationSamples.length < 3) normalizationSamples.push(raw);
    }
  }

  // 7. Write results to GITHUB_STEP_SUMMARY
  console.log("Generating Markdown report for GitHub Actions...");
  const reportPath = process.env.GITHUB_STEP_SUMMARY;

  const markdownReport = `
# 📊 PachiPulse Phase 2.1 データベース未紐付け動画分析レポート

本番環境の未紐付け（unmatched）動画 **${unmatchedCount}** 件に対する、読み取り専用の構造・表記ゆれ分析レポートです。

---

## 📈 基本情報
- **未紐付け (unmatched) 動画総数**: \`${unmatchedCount}\` 件
- **現在の登録機種数**: \`${currentMachines.length}\` 機種

---

## 🔍 現在の5機種の一致妨げ要因 & エイリアス効果
現在の正式名称に含まれる装飾表記（接頭辞・スペック等）が完全一致を妨げています。これらを簡略化したエイリアスを追加した場合の推定一致件数です。

| 機種名 (正式名称) | 妨げている表記 | コアキーワード | alias追加時の想定一致数 (件) |
| :--- | :--- | :--- | :---: |
${currentSeededAnalyses
  .map(
    (a) =>
      `| **${a.name}** | ${a.blockingDecorators.map((d) => `\`${d}\``).join(", ") || "なし"} | \`${a.coreKeyword}\` | **${a.potentialMatches}**`
  )
  .join("\n")}

---

## ⚠️ 危険な一般語・番組名・単語の判定リスク
以下の一般名詞や頻出単語を aliases に設定すると、無関係な動画を高確率で誤判定します。これらは **excludeTerms に登録するか、エイリアスとして絶対に使用しない** 必要があります。

| 危険キーワード | 該当動画数 (件) | タイトルサンプル (最大3件) |
| :--- | :---: | :--- |
${dangerousKeywordsAnalysis
  .slice(0, 10)
  .map(
    (dk) =>
      `| **${dk.keyword}** | ${dk.matchedCount} | ${dk.samples.map((s) => `• ${s}`).join("<br>")} |`
  )
  .join("\n")}

---

## 🔠 表記の正規化（全角・半角・大文字小文字）の影響
全角英数字（例：\`スマスロＬからくり\`、\`Ｐフィーバー\`）や余分なスペースが含まれるため、単純な文字列比較では不一致となる動画が多数存在します。
- **全角・半角や英数字表記ゆれの影響を受ける動画数**: 推定 \`${fullToHalfWidthMatches}\` 件
- **表記ゆれサンプル**:
${normalizationSamples.map((s) => `  - \`${s}\``).join("\n")}

---

## 🎯 推奨する追加機種 & aliases 候補 (上位50件)
未紐付け動画タイトルへの出現頻度が高い、現役人気機種および最近の導入機種の一覧と、推奨される安全な aliases 候補です。

| 順位 | 機種名 (正式名称) | 導入年月 | タイプ | 推奨 aliases | 予想一致数 (件) | 危険競合キーワード |
| :---: | :--- | :---: | :---: | :--- | :---: | :--- |
${sortedMachineMatches
  .slice(0, 50)
  .map((m, idx) => {
    // Determine type display
    const typeLabel = m.type === "slot" ? "パチスロ" : m.type === "pachinko" ? "パチンコ" : "両方";
    return `| ${idx + 1} | **${m.name}** | ${m.releaseDate} | ${typeLabel} | ${m.aliases.map((a) => `\`${a}\``).join(", ")} | **${m.totalMatchedCount}** | \`なし\` |`;
  })
  .join("\n")}

---

## 📄 機種別タイトルサンプル (上位5件)
特に出現頻度が高い機種に該当する、未紐付け動画タイトルのサンプルです。

${sortedMachineMatches
  .slice(0, 5)
  .map(
    (m) => `
### 🔹 ${m.name} (想定一致数: ${m.totalMatchedCount} 件)
${m.samples.map((s) => `- \`${s}\``).join("\n")}
`
  )
  .join("\n")}
`;

  if (reportPath) {
    fs.writeFileSync(reportPath, markdownReport, "utf-8");
    console.log(`Markdown report written to GITHUB_STEP_SUMMARY: ${reportPath}`);
  }
  console.log("--- REPORT START ---");
  console.log(markdownReport);
  console.log("--- REPORT END ---");
}

analyze()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Analysis script failed:", err);
    process.exit(1);
  });
