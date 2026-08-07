<script setup>
import { computed, ref } from 'vue'
import {
  ROUND_UNITS,
  formatWon,
  goToStep,
  resetAll,
  settlement,
  state,
} from '../stores/settlement'

const opened = ref(new Set())
const confirmingReset = ref(false)
const copyState = ref('idle') // idle | done | fail

const result = computed(() => settlement.value)
const unitLabel = computed(
  () => ROUND_UNITS.find((u) => u.value === state.roundUnit)?.label ?? '100원',
)

function toggle(id) {
  const next = new Set(opened.value)
  next.has(id) ? next.delete(id) : next.add(id)
  opened.value = next
}

function summaryText() {
  const lines = [
    `회식 정산 · 총 ${formatWon(result.value.billTotal)}원 / ${result.value.headcount}명`,
    '',
    ...result.value.people.map((p) => `${p.name}  ${formatWon(p.payable)}원`),
  ]
  if (result.value.remainder > 0) {
    lines.push(
      '',
      `※ ${unitLabel.value} 단위 내림 · 남은 ${formatWon(result.value.remainder)}원은 따로 채워야 해요`,
    )
  }
  return lines.join('\n')
}

async function copy() {
  const text = summaryText()
  try {
    if (navigator.share) {
      await navigator.share({ text })
      copyState.value = 'idle'
      return
    }
    await navigator.clipboard.writeText(text)
    copyState.value = 'done'
    setTimeout(() => (copyState.value = 'idle'), 2000)
  } catch {
    copyState.value = 'fail'
    setTimeout(() => (copyState.value = 'idle'), 2500)
  }
}

function startOver() {
  resetAll()
  confirmingReset.value = false
  window.scrollTo({ top: 0, behavior: 'instant' })
}
</script>

<template>
  <div>
    <!-- 서명: 도장이 찍힌 합계 -->
    <section class="total">
      <p class="total-label">총 결제 금액</p>
      <p class="total-amount num">
        {{ formatWon(result.billTotal) }}<span class="won">원</span>
      </p>
      <p class="total-sub num">{{ result.headcount }}명 · 메뉴 {{ state.menus.length }}개</p>
      <span class="stamp total-stamp">정산완료</span>
    </section>

    <div v-if="result.unassignedAmount > 0" class="warn unassigned">
      아무도 배정되지 않은 {{ formatWon(result.unassignedAmount) }}원은 빠져 있습니다.
      배정 단계에서 사람을 넣어주세요.
    </div>

    <div class="rounding">
      <div class="rounding-head">
        <span class="rounding-label">걷는 단위</span>
        <span class="rounding-note">내림 · 총액을 넘지 않아요</span>
      </div>
      <div class="rounding-opts">
        <button
          v-for="u in ROUND_UNITS"
          :key="u.value"
          class="chip"
          type="button"
          :aria-pressed="state.roundUnit === u.value"
          @click="state.roundUnit = u.value"
        >
          {{ u.label }}
        </button>
      </div>
    </div>

    <ul class="people">
      <li v-for="p in result.people" :key="p.id" class="person">
        <button class="person-line" type="button" :aria-expanded="opened.has(p.id)" @click="toggle(p.id)">
          <span class="person-name">{{ p.name }}</span>
          <span class="leader"></span>
          <span class="person-amount num">{{ formatWon(p.payable) }}원</span>
          <span class="caret" :class="{ 'is-open': opened.has(p.id) }" aria-hidden="true">›</span>
        </button>

        <div v-if="opened.has(p.id)" class="detail">
          <p v-if="!p.items.length" class="hint">먹은 메뉴가 없어요.</p>
          <ul v-else>
            <li v-for="(item, i) in p.items" :key="`${item.menuId}-${i}`" class="detail-row">
              <span class="detail-name">{{ item.name }}</span>
              <span v-if="item.isCommon" class="stamp stamp-sm">공통</span>
              <span class="leader"></span>
              <span class="detail-head num">÷{{ item.headcount }}</span>
              <span class="detail-share num">{{ formatWon(item.share) }}</span>
            </li>
          </ul>
          <p class="detail-sum num">
            <span>실제 몫</span>
            <span class="leader"></span>
            <span>{{ formatWon(p.subtotal) }}원</span>
          </p>
          <p v-if="p.payable !== p.subtotal" class="detail-round num">
            <span>{{ unitLabel }} 내림</span>
            <span class="leader"></span>
            <span>−{{ formatWon(p.subtotal - p.payable) }}원</span>
          </p>
        </div>
      </li>
    </ul>

    <div class="collected num">
      <p class="collected-row">
        <span>걷는 총액</span><span class="leader"></span
        ><span>{{ formatWon(result.collected) }}원</span>
      </p>
      <p class="collected-row is-sub">
        <span>결제 총액</span><span class="leader"></span
        ><span>{{ formatWon(result.charged) }}원</span>
      </p>
      <p v-if="result.remainder > 0" class="collected-rest">
        <span class="rest-label">남은 금액</span>
        <span class="rest-amount">{{ formatWon(result.remainder) }}원</span>
        <span class="rest-note">내림하고 덜 걷힌 금액이에요. 총무가 채우거나 따로 나누세요.</span>
      </p>
      <p v-else class="collected-row is-ok">
        <span>딱 맞아요</span><span class="leader"></span><span>0원</span>
      </p>
    </div>

    <div class="actions">
      <button class="btn btn-go" type="button" @click="copy">
        {{ copyState === 'done' ? '복사했어요' : copyState === 'fail' ? '복사할 수 없어요' : '결과 복사하기' }}
      </button>
      <button class="btn btn-ghost" type="button" @click="goToStep(2)">메뉴 수정하기</button>
      <button class="btn btn-ghost" type="button" @click="goToStep(3)">배정 수정하기</button>

      <template v-if="!confirmingReset">
        <button class="btn btn-danger" type="button" @click="confirmingReset = true">
          처음부터 다시하기
        </button>
      </template>
      <div v-else class="confirm">
        <p class="confirm-q">전부 지우고 새로 시작할까요?</p>
        <div class="confirm-actions">
          <button class="btn btn-ghost" type="button" @click="confirmingReset = false">아니요</button>
          <button class="btn btn-danger" type="button" @click="startOver">네, 지울게요</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.total {
  position: relative;
  padding: 1.1rem 0 1.25rem;
  border-top: 2px solid var(--ink);
  border-bottom: 1px dashed var(--rule);
  text-align: left;
}

.total-label {
  color: var(--ink-2);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.total-amount {
  margin-top: 0.15rem;
  font-family: var(--font-display);
  font-size: 2.6rem;
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.won {
  margin-left: 0.15rem;
  font-size: 1.2rem;
}

.total-sub {
  margin-top: 0.3rem;
  color: var(--ink-3);
  font-size: 0.8rem;
}

.total-stamp {
  position: absolute;
  top: 1.4rem;
  right: 0.1rem;
  font-size: 0.9rem;
  transform: rotate(-11deg);
  animation: press 0.35s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}

@keyframes press {
  from {
    transform: rotate(-11deg) scale(1.6);
    opacity: 0;
  }
}

.unassigned {
  margin-top: 1rem;
}

.rounding {
  margin: 1.1rem 0 0.5rem;
}

.rounding-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.rounding-label {
  color: var(--ink-2);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.rounding-note {
  color: var(--ink-3);
  font-size: 0.74rem;
}

.rounding-opts {
  display: flex;
  gap: 0.3rem;
}

.rounding-opts .chip {
  flex: 1;
  justify-content: center;
  min-height: 38px;
  padding: 0 0.3rem;
  font-size: 0.8rem;
}

.people {
  margin-top: 0.75rem;
}

.person {
  border-bottom: 1px dashed var(--rule);
}

.person-line {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  width: 100%;
  min-height: var(--tap);
  padding: 0.65rem 0;
  border: 0;
  background: none;
  text-align: left;
}

.person-name {
  overflow: hidden;
  font-size: 1.02rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person-amount {
  font-size: 1.08rem;
  font-weight: 700;
}

.caret {
  flex: 0 0 auto;
  align-self: center;
  color: var(--ink-3);
  transition: transform 0.15s ease;
}

.caret.is-open {
  transform: rotate(90deg);
}

.detail {
  padding: 0.2rem 0 0.85rem 0.2rem;
  border-left: 2px solid var(--paper-3);
  margin-left: 0.1rem;
  padding-left: 0.7rem;
}

.detail-row {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  padding: 0.22rem 0;
  color: var(--ink-2);
  font-size: 0.85rem;
}

.detail-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-head {
  flex: 0 0 auto;
  color: var(--ink-3);
  font-size: 0.76rem;
}

.detail-share {
  flex: 0 0 auto;
  font-weight: 600;
}

.detail-sum,
.detail-round {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin-top: 0.4rem;
  padding-top: 0.35rem;
  border-top: 1px dotted var(--rule);
  color: var(--ink-2);
  font-size: 0.8rem;
  font-weight: 600;
}

.detail-round {
  margin-top: 0.1rem;
  padding-top: 0.1rem;
  border-top: 0;
  color: var(--soju);
}

.stamp-sm {
  flex: 0 0 auto;
  padding: 0 0.3em;
  border-width: 1.5px;
  box-shadow: inset 0 0 0 1px var(--paper), inset 0 0 0 2.5px var(--stamp);
  font-size: 0.58rem;
}

.collected {
  margin-top: 1rem;
  padding: 0.85rem 0.9rem;
  background: var(--paper-2);
  border-radius: var(--radius);
}

.collected-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 700;
}

.collected-row.is-sub {
  margin-top: 0.3rem;
  color: var(--ink-3);
  font-size: 0.82rem;
  font-weight: 600;
}

.collected-row.is-ok {
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px dashed var(--rule);
  color: var(--soju);
  font-size: 0.84rem;
  font-weight: 700;
}

/* 내림하고 남은 돈 — 누군가는 채워야 하는 금액이라 눈에 띄게 둔다 */
.collected-rest {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.15rem 0.5rem;
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px dashed var(--rule);
}

.rest-label {
  color: var(--stamp);
  font-size: 0.86rem;
  font-weight: 700;
}

.rest-amount {
  color: var(--stamp);
  font-size: 1.02rem;
  font-weight: 700;
  text-align: right;
}

.rest-note {
  grid-column: 1 / -1;
  color: var(--ink-3);
  font-family: var(--font-body);
  font-size: 0.76rem;
  line-height: 1.4;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.confirm {
  padding: 0.85rem;
  border: 1.5px solid var(--stamp);
  border-radius: var(--radius);
  background: var(--stamp-soft);
}

.confirm-q {
  margin-bottom: 0.7rem;
  color: var(--stamp);
  font-size: 0.9rem;
  font-weight: 700;
}

.confirm-actions {
  display: flex;
  gap: 0.5rem;
}

.confirm-actions .btn {
  flex: 1;
}
</style>
