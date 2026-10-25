#!/usr/bin/env node
// pre-commit: ortak dala doğrudan commit'i reddeder (D37). Birleştirme commit'ini kanca ayırır.
// Acil durumda: git commit --no-verify (gerekçesi PR'a ya da ekibe yazılır).
//   node tools/ajan/dal-denetle.mjs <dal>
import { ORTAK_DALLAR, ortakDalMi } from './ortak.mjs';

const dal = process.argv[2] ?? '';
if (ortakDalMi(dal)) {
  console.error(
    [
      `✖ "${dal}" ortak dal; doğrudan commit edilmez (D37, ortak dallar: ${ORTAK_DALLAR.join(', ')}).`,
      '  Kişisel dal aç (değişiklikler taşınır) ve yeniden commit et:',
      '    git switch -c <ad>/<kısa-iş>',
      "  dev'e birleştirme: node tools/ajan/birlestir.mjs guncelle, sonra dev --mesaj \"…\" (main'e kod sahibi alır).",
    ].join('\n'),
  );
  process.exit(1);
}
