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
      '  İş dalı aç (değişiklikler taşınır) ve yeniden commit et:',
      '    git switch -c is/<kısa-ad>',
      '  Birleştirme PR ile yapılır (.github/pull_request_template.md).',
    ].join('\n'),
  );
  process.exit(1);
}
