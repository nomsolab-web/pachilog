/**
 * Seed list of recently-released machines (factual: name / maker / release date only —
 * no strategy/expected-value data). Sourced from manufacturer/official release calendars.
 * Add new machines weekly by editing this list or inserting directly into the `machines` table.
 */
export type SeedMachine = {
  name: string;
  maker: string;
  releaseDate: string;
  type: string;
  shortName?: string;
  aliases?: string[];
  uniqueAliases?: string[];
  ambiguousAliases?: string[];
  resolvingKeywords?: string[];
  excludeTerms?: string[]; // Used as competingMachines (negative keywords)
  officialUrl?: string | null;
  sourceUrl?: string | null;
};

export const SEED_MACHINES: SeedMachine[] = [
  // Existing 5 machines in production database (updated with correct specifications, spelling, and manufacturers)
  {
    name: "Lパチスロ からくりサーカス2",
    maker: "SANKYO",
    releaseDate: "2026-07-06",
    type: "slot",
    shortName: "からくり2",
    aliases: ["からくりサーカス2", "からくり2", "Lからくりサーカス2", "Lからくり2", "からサー2"],
    uniqueAliases: ["からくりサーカス2", "からくり2", "Lからくりサーカス2", "Lからくり2", "からサー2"],
    ambiguousAliases: ["からくりサーカス", "からくり"],
    resolvingKeywords: ["からくり2", "運命の劇", "魔王"],
    excludeTerms: [],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10420"
  },
  {
    name: "Pフィーバーブルーロック Light ver.",
    maker: "SANKYO",
    releaseDate: "2026-07-06",
    type: "pachinko",
    shortName: "ブルーロック甘",
    aliases: ["ブルーロック Light ver.", "Fブルーロック Light ver.", "ブルーロック甘", "ブルーロックLight", "ブルーロック"],
    uniqueAliases: ["ブルーロック Light ver.", "Fブルーロック Light ver.", "ブルーロック甘", "ブルーロックLight", "ブルーロック"],
    ambiguousAliases: ["ブルーロック"],
    resolvingKeywords: ["Light", "甘", "1/120"],
    excludeTerms: [],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10421"
  },
  {
    name: "eフィーバー デッドマウント・デスプレイ 魂神9000",
    maker: "SANKYO",
    releaseDate: "2026-06-08",
    type: "pachinko",
    shortName: "デッドマウント魂神",
    aliases: ["デッドマウント・デスプレイ 魂神", "デッドマウント 魂神"],
    uniqueAliases: ["デッドマウント・デスプレイ 魂神", "デッドマウント 魂神"],
    ambiguousAliases: ["デッドマウント・デスプレイ", "デッドマウント"],
    resolvingKeywords: ["魂神", "9000"],
    excludeTerms: [],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10415"
  },
  {
    name: "ぱちんこ 必殺仕事人VI",
    maker: "オッケー.",
    releaseDate: "2026-07-06",
    type: "pachinko",
    shortName: "仕事人VI",
    aliases: ["必殺仕事人VI", "必殺仕事人6", "仕事人VI", "仕事人6"],
    uniqueAliases: ["必殺仕事人VI", "必殺仕事人6", "仕事人VI", "仕事人6"],
    ambiguousAliases: ["必殺仕事人", "仕事人"],
    resolvingKeywords: ["VI", "6", "主水", "仕事人6"],
    excludeTerms: [],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10422"
  },
  {
    name: "eベルセルク無双 第2章 10連撃Ver.",
    maker: "ニューギン",
    releaseDate: "2026-07-21",
    type: "pachinko",
    shortName: "ベルセルク無双10連",
    aliases: ["ベルセルク無双 第2章 10連撃Ver.", "ベルセルク無双第2章", "ベルセルク無双2"],
    uniqueAliases: ["ベルセルク無双 第2章 10連撃Ver.", "ベルセルク無双第2章", "ベルセルク無双2"],
    ambiguousAliases: ["ベルセルク無双", "ベルセルク"],
    resolvingKeywords: ["第2章", "10連"],
    excludeTerms: [],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10423"
  },

  // New machines to be added (from Phase 2.1)
  {
    name: "eフィーバー　シン・エヴァンゲリオン　Type レイ",
    maker: "ビスティ",
    releaseDate: "2023-12-18",
    type: "pachinko",
    shortName: "エヴァ16レイ",
    aliases: ["シン・エヴァンゲリオン Type レイ", "シンエヴァ Typeレイ", "シンエヴァTypeレイ", "エヴァ16 Typeレイ", "エヴァ16Typeレイ", "Typeレイ", "Type レイ"],
    uniqueAliases: ["シン・エヴァンゲリオン Type レイ", "シンエヴァ Typeレイ", "シンエヴァTypeレイ", "エヴァ16 Typeレイ", "エヴァ16Typeレイ", "Typeレイ", "Type レイ"],
    ambiguousAliases: ["エヴァ", "エヴァンゲリオン", "シンエヴァ", "シン・エヴァンゲリオン"],
    resolvingKeywords: ["レイ", "16", "Typeレイ"],
    excludeTerms: ["はじまりの記憶", "エヴァ17", "ゼロから始める", "ゴジラ対エヴァンゲリオン", "カヲル", "ゲンドウ", "未来への咆哮", "エヴァ15", "使徒、再び"],
    officialUrl: "https://www.sankyo-fever.jp/products/machine_detail.php?id=968",
    sourceUrl: "https://www.p-world.co.jp/machine/database/9897"
  },
  {
    name: "スマスロ北斗の拳",
    maker: "サミー",
    releaseDate: "2023-04-03",
    type: "slot",
    shortName: "スマスロ北斗",
    aliases: ["スマスロ北斗", "スマスロ北斗の拳", "L北斗の拳", "L北斗", "北斗の拳"],
    uniqueAliases: ["スマスロ北斗", "スマスロ北斗の拳", "L北斗の拳", "L北斗", "北斗の拳"],
    ambiguousAliases: ["北斗"],
    resolvingKeywords: ["スマスロ", "本前兆", "宿命", "北斗揃い", "無双転生"],
    excludeTerms: ["北斗転生2", "転生の章2", "北斗転生の章2", "暴凶星", "北斗無双", "修羅の国", "北斗天昇"],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/9721"
  },
  {
    name: "スマスロ 北斗の拳 転生の章2",
    maker: "サミー",
    releaseDate: "2026-01-05",
    type: "slot",
    shortName: "北斗転生2",
    aliases: ["スマスロ北斗の拳 転生の章2", "北斗の拳 転生の章2", "北斗転生2", "転生の章2", "北斗転生の章2"],
    uniqueAliases: ["スマスロ北斗の拳 転生の章2", "北斗の拳 転生の章2", "北斗転生2", "転生の章2", "北斗転生の章2"],
    ambiguousAliases: ["北斗", "北斗の拳"],
    resolvingKeywords: ["転生2", "あべし", "闘神演舞", "神拳勝舞", "勝舞魂"],
    excludeTerms: ["北斗の拳宿命", "北斗の拳強敵", "暴凶星", "北斗無双"],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10398"
  },
  {
    name: "パチスロ甲鉄城のカバネリ",
    maker: "サミー",
    releaseDate: "2022-07-04",
    type: "slot",
    shortName: "カバネリ",
    aliases: ["カバネリ 6.5", "6.5号機カバネリ", "カバネリ美馬", "カバネリ無名"],
    uniqueAliases: ["カバネリ 6.5", "6.5号機カバネリ", "カバネリ美馬", "カバネリ無名"],
    ambiguousAliases: ["カバネリ", "甲鉄城のカバネリ"],
    resolvingKeywords: ["美馬", "無名", "さらば諭吉", "裏美馬", "ST"],
    excludeTerms: ["カバネリ海門決戦", "カバネリ2", "カバネリ 2"],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/9525"
  },
  {
    name: "スマスロ 甲鉄城のカバネリ 海門決戦",
    maker: "サミー",
    releaseDate: "2026-03-02",
    type: "slot",
    shortName: "カバネリ海門決戦",
    aliases: ["スマスロ甲鉄城のカバネリ 海門決戦", "カバネリ 海門決戦", "カバネリ海門決戦", "カバネリ2", "海門決戦"],
    uniqueAliases: ["スマスロ甲鉄城のカバネリ 海門決戦", "カバネリ 海門決戦", "カバネリ海門決戦", "カバネリ2", "海門決戦"],
    ambiguousAliases: ["カバネリ", "甲鉄城のカバネリ"],
    resolvingKeywords: ["海門", "うなと", "決戦"],
    excludeTerms: ["カバネリ6.5", "6.5号機カバネリ"],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10411"
  },
  {
    name: "L戦国乙女4 戦乱に閃く炯眼の軍師",
    maker: "オリンピア",
    releaseDate: "2023-09-04",
    type: "slot",
    shortName: "戦国乙女4",
    aliases: ["戦国乙女4", "乙女4", "L戦国乙女4", "L戦国乙女4 戦乱に閃く炯眼の軍師"],
    uniqueAliases: ["戦国乙女4", "乙女4", "L戦国乙女4", "L戦国乙女4 戦乱に閃く炯眼の軍師"],
    ambiguousAliases: ["戦国乙女", "乙女"],
    resolvingKeywords: ["乙女4", "炯眼", "ヨシテル", "ムサシ"],
    excludeTerms: ["戦国乙女5", "乙女5", "乙女深淵"],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/9848"
  },
  {
    name: "L戦国乙女5 業火を穿つ宿焔の双刃",
    maker: "オリンピア",
    releaseDate: "2026-06-08",
    type: "slot",
    shortName: "戦国乙女5",
    aliases: ["L戦国乙女5 業火を穿つ宿焔の双刃", "戦国乙女5", "乙女5", "L戦国乙女5"],
    uniqueAliases: ["L戦国乙女5 業火を穿つ宿焔の双刃", "戦国乙女5", "乙女5", "L戦国乙女5"],
    ambiguousAliases: ["戦国乙女", "乙女"],
    resolvingKeywords: ["宿焔", "石川ゴエモン", "強カワRUSH", "本能寺の変"],
    excludeTerms: ["戦国乙女4", "乙女4"],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10432"
  },
  {
    name: "P大海物語5",
    maker: "三洋物産",
    releaseDate: "2023-02-06",
    type: "pachinko",
    shortName: "大海5",
    aliases: ["大海物語5", "大海5"],
    uniqueAliases: ["大海物語5", "大海5"],
    ambiguousAliases: ["大海", "大海物語"],
    resolvingKeywords: ["大海5"],
    excludeTerms: ["大海物語4", "大海4", "大海5ブラック", "大海ブラック", "大海5スペシャル", "大海スペシャル", "沖縄6", "沖縄5", "沖縄4", "地中海"],
    officialUrl: "https://www.sanyobussan.co.jp/products/pk_ooumi5/",
    sourceUrl: "https://www.p-world.co.jp/machine/database/9698"
  },
  {
    name: "P大海物語5 ブラック",
    maker: "三洋物産",
    releaseDate: "2023-12-04",
    type: "pachinko",
    shortName: "大海5ブラック",
    aliases: ["大海物語5 ブラック", "大海5 ブラック", "大海5ブラック"],
    uniqueAliases: ["大海物語5 ブラック", "大海5 ブラック", "大海5ブラック"],
    ambiguousAliases: ["大海", "大海物語"],
    resolvingKeywords: ["ブラック", "黒海"],
    excludeTerms: ["大海物語4", "大海4", "沖縄6", "沖縄5", "沖縄4", "地中海"],
    officialUrl: "https://www.sanyobussan.co.jp/products/pk_ooumi5_black/",
    sourceUrl: "https://www.p-world.co.jp/machine/database/9895"
  },
  {
    name: "P大海物語5スペシャル",
    maker: "三洋物産",
    releaseDate: "2024-11-05",
    type: "pachinko",
    shortName: "大海5SP",
    aliases: ["大海物語5スペシャル", "大海5スペシャル", "大海5SP", "大海物語5SP"],
    uniqueAliases: ["大海物語5スペシャル", "大海5スペシャル", "大海5SP", "大海物語5SP"],
    ambiguousAliases: ["大海", "大海物語"],
    resolvingKeywords: ["スペシャル", "SP"],
    excludeTerms: ["大海物語4", "大海4", "大海5ブラック", "大海ブラック", "沖縄6", "沖縄5", "沖縄4", "地中海"],
    officialUrl: "https://www.sanyobussan.co.jp/products/pk_ooumi5_sp/",
    sourceUrl: "https://www.p-world.co.jp/machine/database/10185"
  },
  {
    name: "パチスロ からくりサーカス",
    maker: "三共",
    releaseDate: "2023-07-03",
    type: "slot",
    shortName: "からくりサーカス",
    aliases: ["スマスロからくりサーカス", "Lからくりサーカス", "Lからくり"],
    uniqueAliases: ["スマスロからくりサーカス", "Lからくりサーカス", "Lからくり"],
    ambiguousAliases: ["からくりサーカス", "からくり", "からサー"],
    resolvingKeywords: ["鳴海", "勝", "しろがね", "オリンピア", "極劇"],
    excludeTerms: ["からくりサーカス2", "からくり2", "Lからくり2", "からサー2"],
    officialUrl: "https://www.sankyo-fever.jp/products/machine_detail.php?id=929",
    sourceUrl: "https://www.p-world.co.jp/machine/database/9782"
  },
  {
    name: "P牙狼11〜冴島大河〜XX",
    maker: "サンセイR&D",
    releaseDate: "2024-04-22",
    type: "pachinko",
    shortName: "牙狼11",
    aliases: ["牙狼11", "牙狼 11", "冴島大河"],
    uniqueAliases: ["牙狼11", "牙狼 11", "冴島大河"],
    ambiguousAliases: ["牙狼", "GARO"],
    resolvingKeywords: ["冴島", "大河", "11"],
    excludeTerms: ["真・牙狼", "牙狼GOLD"],
    officialUrl: null,
    sourceUrl: "https://www.p-world.co.jp/machine/database/10044"
  },
  {
    name: "Sキングハナハナ-30",
    maker: "パイオニア",
    releaseDate: "2023-03-20",
    type: "slot",
    shortName: "キングハナハナ",
    aliases: ["キングハナハナ", "キンハナ"],
    uniqueAliases: ["キングハナハナ", "キンハナ"],
    ambiguousAliases: ["ハナハナ", "ハナ"],
    resolvingKeywords: ["キング", "キンハナ"],
    excludeTerms: ["ハナハナホウオウ", "ニューキング"],
    officialUrl: "https://www.slot-pioneer.co.jp/product/king_hanahana/",
    sourceUrl: "https://www.p-world.co.jp/machine/database/9707"
  },
  {
    name: "S沖ドキ！GOLD",
    maker: "アクロス",
    releaseDate: "2022-12-19",
    type: "slot",
    shortName: "沖ドキGOLD",
    aliases: ["沖ドキ！GOLD", "沖ドキゴールド", "沖ドキGOLD"],
    uniqueAliases: ["沖ドキ！GOLD", "沖ドキゴールド", "沖ドキGOLD"],
    ambiguousAliases: ["沖ドキ"],
    resolvingKeywords: ["GOLD", "ゴールド"],
    excludeTerms: ["沖ドキ！BLACK", "沖ドキDUO", "沖ドキ2"],
    officialUrl: "https://www.universal-777.com/product/slot/okidoki_gold/",
    sourceUrl: "https://www.p-world.co.jp/machine/database/9664"
  },
  {
    name: "パチスロ 革命機ヴァルヴレイヴ",
    maker: "三共",
    releaseDate: "2022-11-21",
    type: "slot",
    shortName: "ヴヴヴ",
    aliases: ["スマスロヴァルヴレイヴ", "スマスロヴヴヴ", "Lヴァルヴレイヴ", "革命機ヴァルヴレイヴ", "ヴァルヴレイヴ"],
    uniqueAliases: ["スマスロヴァルヴレイヴ", "スマスロヴヴヴ", "Lヴァルヴレイヴ", "革命機ヴァルヴレイヴ", "ヴァルヴレイヴ"],
    ambiguousAliases: ["ヴヴヴ", "革命機"],
    resolvingKeywords: ["ハルト", "エルエルフ", "超革命"],
    excludeTerms: [],
    officialUrl: "https://www.sankyo-fever.jp/products/machine_detail.php?id=875",
    sourceUrl: "https://www.p-world.co.jp/machine/database/9623"
  },
  {
    name: "マイジャグラーV",
    maker: "北電子",
    releaseDate: "2021-12-06",
    type: "slot",
    shortName: "マイジャグ5",
    aliases: ["マイジャグラー5", "マイジャグ5", "マイジャグラーV"],
    uniqueAliases: ["マイジャグラー5", "マイジャグ5", "マイジャグラーV"],
    ambiguousAliases: ["マイジャグ", "マイジャグラー"],
    resolvingKeywords: ["トラっぴ", "GOGOランプ"],
    excludeTerms: ["アイムジャグラー", "ファンキージャグラー", "ハッピージャグラー", "ゴーゴージャグラー", "ガールズSS"],
    officialUrl: "https://www.kitadenshi.co.jp/products/2021/myj5/",
    sourceUrl: "https://www.p-world.co.jp/machine/database/9445"
  }
];
