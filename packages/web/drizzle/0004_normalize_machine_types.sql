-- Normalize known legacy spellings. Unknown values are intentionally left unchanged.
UPDATE `machines`
SET `type` = 'slot'
WHERE lower(trim(`type`)) IN ('slot', 'pachislot', 'pachislo', 'パチスロ', 'ぱちすろ', 'スロット', 'パチスロット');
--> statement-breakpoint
UPDATE `machines`
SET `type` = 'pachinko'
WHERE lower(trim(`type`)) IN ('pachinko', 'パチンコ', 'ぱちんこ');
--> statement-breakpoint
-- These three legacy rows are identifiable from their official machine names.
UPDATE `machines`
SET `type` = 'pachinko'
WHERE `type` IS NULL
  AND (
    `name` LIKE 'eフィーバー%デッドマウント%デスプレイ%魂神%'
    OR `name` LIKE 'ぱちんこ 必殺仕事人VI%'
    OR `name` LIKE 'デカスタeベルセルク無双%'
  );
