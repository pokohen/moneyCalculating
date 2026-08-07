<script setup>
import { computed } from 'vue'
import {
  formatWon,
  kindLabel,
  setAllMembers,
  state,
  toggleMember,
  updateMenu,
} from '../stores/settlement'

const commonMenus = computed(() => state.menus.filter((m) => m.isCommon))
const pickMenus = computed(() => state.menus.filter((m) => !m.isCommon))
const commonTotal = computed(() => commonMenus.value.reduce((s, m) => s + m.amount, 0))

function isIn(menu, participantId) {
  return menu.memberIds.includes(participantId)
}

function perHead(menu) {
  const n = menu.isCommon ? state.participants.length : menu.memberIds.length
  return n > 0 ? Math.floor(menu.amount / n) : 0
}

function makeCommon(menu, common) {
  // 개별로 되돌리면 아무도 없는 상태에서 다시 고른다.
  updateMenu(menu.id, { isCommon: common })
  if (!common) setAllMembers(menu.id, false)
}
</script>

<template>
  <div>
    <p class="lede">공통이 아닌 메뉴만 고르면 됩니다. 이름을 눌러 넣고 빼세요.</p>

    <section v-if="commonMenus.length" class="common-block">
      <div class="common-head">
        <span class="stamp">공통</span>
        <p class="common-desc">
          아래 {{ commonMenus.length }}개는 참가자 {{ state.participants.length }}명이 전부 나눕니다.
        </p>
      </div>
      <ul>
        <li v-for="m in commonMenus" :key="m.id" class="common-row">
          <span class="common-name">{{ m.name }}</span>
          <span class="leader"></span>
          <span class="num common-amount">{{ formatWon(m.amount) }}</span>
          <button class="switch" type="button" @click="makeCommon(m, false)">개별로</button>
        </li>
      </ul>
      <p class="common-foot num">
        공통 합계 {{ formatWon(commonTotal) }}원 · 1인당
        {{ formatWon(state.participants.length ? Math.floor(commonTotal / state.participants.length) : 0) }}원
      </p>
    </section>

    <section class="pick-block">
      <div class="section-title">
        <span>개별 메뉴</span>
        <span class="count num">{{ pickMenus.length }}개</span>
      </div>

      <p v-if="!pickMenus.length" class="empty">
        개별로 나눌 메뉴가 없어요.<br />전부 공통으로 계산됩니다.
      </p>

      <article v-for="m in pickMenus" :key="m.id" class="pick" :class="{ 'is-empty': !m.memberIds.length }">
        <header class="pick-head">
          <div class="pick-title">
            <span class="kind">{{ kindLabel(m.kind) }}</span>
            <h3 class="pick-name">{{ m.name }}</h3>
          </div>
          <p class="pick-amount num">{{ formatWon(m.amount) }}원</p>
        </header>

        <ul class="chips">
          <li v-for="p in state.participants" :key="p.id">
            <button
              class="chip"
              type="button"
              :aria-pressed="isIn(m, p.id)"
              @click="toggleMember(m.id, p.id)"
            >
              {{ p.name }}
            </button>
          </li>
        </ul>

        <footer class="pick-foot">
          <p v-if="m.memberIds.length" class="split num">
            {{ m.memberIds.length }}명 · 1인당 {{ formatWon(perHead(m)) }}원
          </p>
          <p v-else class="split is-warn">아무도 없어요</p>
          <div class="pick-actions">
            <button class="switch" type="button" @click="setAllMembers(m.id, true)">전원</button>
            <button class="switch" type="button" @click="setAllMembers(m.id, false)">해제</button>
            <button class="switch" type="button" @click="makeCommon(m, true)">공통으로</button>
          </div>
        </footer>
      </article>
    </section>
  </div>
</template>

<style scoped>
.lede {
  margin-bottom: 1.1rem;
  color: var(--ink-2);
  font-size: 0.92rem;
}

.common-block {
  padding: 0.9rem 1rem;
  border: 1.5px solid var(--stamp);
  border-radius: var(--radius);
  background: var(--stamp-soft);
}

.common-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.7rem;
}

.common-head .stamp {
  margin-top: 0.1rem;
}

.common-desc {
  color: var(--ink-2);
  font-size: 0.82rem;
  line-height: 1.35;
}

.common-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.3rem 0;
  font-size: 0.9rem;
}

.common-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.common-amount {
  font-weight: 600;
}

.common-foot {
  margin-top: 0.7rem;
  padding-top: 0.6rem;
  border-top: 1px dashed rgb(191 54 44 / 0.35);
  color: var(--stamp);
  font-size: 0.8rem;
  font-weight: 700;
}

.switch {
  flex: 0 0 auto;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--rule);
  border-radius: 999px;
  background: #fff;
  color: var(--ink-2);
  font-size: 0.72rem;
  font-weight: 600;
}

.pick-block {
  margin-top: 1.75rem;
}

.count {
  margin-left: auto;
  color: var(--ink-3);
  font-weight: 600;
  letter-spacing: 0;
}

.pick {
  padding: 0.9rem 0;
  border-top: 1px dashed var(--rule);
}

.pick:last-child {
  border-bottom: 1px dashed var(--rule);
}

.pick-head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.7rem;
}

.pick-title {
  flex: 1;
  min-width: 0;
}

.kind {
  display: inline-block;
  color: var(--ink-3);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.pick-name {
  font-size: 1.02rem;
  font-weight: 700;
  line-height: 1.25;
}

.pick-amount {
  flex: 0 0 auto;
  font-size: 1.02rem;
  font-weight: 700;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pick-foot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.7rem;
}

.split {
  flex: 1;
  min-width: 0;
  color: var(--ink-2);
  font-size: 0.8rem;
  font-weight: 600;
}

.split.is-warn {
  color: var(--stamp);
}

.pick-actions {
  display: flex;
  gap: 0.3rem;
}

.pick.is-empty .pick-name {
  color: var(--stamp);
}
</style>
