// Code-drawn duel table (DOM, no assets). Pure render: reads duel state,
// never mutates rules. Clicking a card calls back into main.ts.
import { CARDS } from "../engine/cards.ts";
import { currentIntent, enemyLabel } from "../engine/duel.ts";
import type { DuelState } from "../engine/types.ts";

function bar(hp: number, maxHp: number): string {
  const pct = Math.max(0, Math.round((100 * hp) / maxHp));
  return `<div class="hpbar"><div class="hpfill" style="width:${pct}%"></div></div>`;
}

function statusLine(s: DuelState, who: "player" | "enemy"): string {
  const c = who === "player" ? s.player : s.enemy;
  const bits = [`${Math.max(0, c.hp)}/${c.maxHp} HP`];
  if (c.armor > 0) bits.push(`${c.armor} armor`);
  if (c.poison > 0) bits.push(`${c.poison} poison`);
  return bits.join(" · ");
}

export function renderTable(root: HTMLElement, s: DuelState, humanTurn: boolean, onCard: (i: number) => void): void {
  const intent = currentIntent(s);
  const intentText = intent.kind === "attack" ? `attacks ${intent.value}` : `defends ${intent.value}`;
  const banner =
    s.phase === "won" ? `<div class="banner win">Victory in ${s.stats.turns} turns</div>`
    : s.phase === "lost" ? `<div class="banner lose">${s.player.hp <= 0 ? "Defeat" : "Turn cap: draw counts as loss"}</div>`
    : "";
  const hand = s.hand
    .map((id, i) => {
      const c = CARDS[id];
      const sub = [
        c.damage ? `${c.damage} dmg` : "",
        c.block ? `+${c.block} armor` : "",
        c.poison ? `+${c.poison} poison` : "",
        c.heal ? `heal ${c.heal}` : "",
        c.selfDamage ? `self ${c.selfDamage}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<button class="card" data-i="${i}" ${humanTurn && s.phase === "playing" ? "" : "disabled"}><b>${c.name}</b><span>${sub}</span><kbd>${i + 1}</kbd></button>`;
    })
    .join("");
  const log = s.events
    .slice(-10)
    .map((e) => `<div>${e}</div>`)
    .join("");
  root.innerHTML = `
    <div class="combatant enemy">
      <div class="name">${enemyLabel(s.enemy.archetype)} <span class="muted">wants to ${intentText}</span></div>
      <div class="status">${statusLine(s, "enemy")}</div>
      ${bar(s.enemy.hp, s.enemy.maxHp)}
    </div>
    ${banner}
    <div class="turn muted">turn ${s.turn} · deck ${s.deck.length} · discard ${s.discard.length}</div>
    <div class="combatant">
      <div class="name">You <span class="muted">${statusLine(s, "player")}</span></div>
      ${bar(s.player.hp, s.player.maxHp)}
    </div>
    <div class="hand">${hand}</div>
    <div class="gamelog">${log}</div>`;
  for (const el of root.querySelectorAll<HTMLButtonElement>("button.card")) {
    el.onclick = () => onCard(Number(el.dataset.i));
  }
}
