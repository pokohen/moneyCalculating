<script setup>
import { computed } from 'vue'
import {
  ASSIGN_VIEWS,
  clearPerson,
  cycleShare,
  lineTotal,
  menusWithoutMembers,
  money,
  num,
  setAllMembers,
  settlement,
  shareOf,
  state,
  unitsOf,
  updateMenu,
} from '../stores/settlement.js'
import { t } from '../i18n.js'

const commonMenus = computed(() => state.menus.filter((m) => m.isCommon))
const pickMenus = computed(() => state.menus.filter((m) => !m.isCommon))
const commonTotal = computed(() => commonMenus.value.reduce((s, m) => s + lineTotal(m), 0))

// 사람 기준으로 볼 때, 지금까지 그 사람 몫이 얼마인지 바로 보여준다.
const subtotals = computed(
  () => new Map(settlement.value.people.map((p) => [p.id, p.subtotal])),
)

// 여러 개짜리 메뉴가 하나라도 있으면 개수 단위로 안내한다.
const hasMulti = computed(() => pickMenus.value.some((m) => m.qty > 1))

function takenBy(participantId) {
  return pickMenus.value.reduce((sum, m) => sum + shareOf(m, participantId), 0)
}

/** 1개당 얼마인지. 가져간 개수가 없으면 단가 그대로 보여준다. */
function perUnit(menu) {
  const units = menu.isCommon ? state.participants.length : unitsOf(menu)
  return units > 0 ? Math.floor(lineTotal(menu) / units) : menu.amount
}

function makeCommon(menu, common) {
  // 개별로 되돌리면 아무도 없는 상태에서 다시 고른다.
  updateMenu(menu.id, { isCommon: common })
  if (!common) setAllMembers(menu.id, false)
}
</script>

<template>
  <div>
    <p class="lede">
      {{ state.assignView === 'person' ? t('a.lede.person') : t('a.lede') }}
    </p>

    <section v-if="commonMenus.length" class="common-block">
      <div class="common-head">
        <span class="stamp">{{ t('stamp.common') }}</span>
        <p class="common-desc">
          {{ t('a.common.desc', { n: commonMenus.length, people: state.participants.length }) }}
        </p>
      </div>
      <ul>
        <li v-for="m in commonMenus" :key="m.id" class="common-row">
          <span class="common-name">{{ m.name }}</span>
          <span v-if="m.qty > 1" class="common-qty num">×{{ m.qty }}</span>
          <span class="leader"></span>
          <span class="num common-amount">{{ num(lineTotal(m)) }}</span>
          <button class="switch" type="button" @click="makeCommon(m, false)">
            {{ t('a.toPick') }}
          </button>
        </li>
      </ul>
      <p class="common-foot num">
        {{
          t('a.common.foot', {
            total: money(commonTotal),
            each: money(
              state.participants.length ? Math.floor(commonTotal / state.participants.length) : 0,
            ),
          })
        }}
      </p>
    </section>

    <section class="pick-block">
      <div class="section-title">
        <span>{{ t('a.heading') }}</span>
        <div class="views" role="group" :aria-label="t('a.view')">
          <template v-for="(view, i) in ASSIGN_VIEWS" :key="view">
            <span v-if="i" class="view-sep" aria-hidden="true">/</span>
            <button
              class="view"
              type="button"
              :class="{ 'is-now': state.assignView === view }"
              :aria-pressed="state.assignView === view"
              @click="state.assignView = view"
            >
              {{ t(`a.view.${view}`) }}
            </button>
          </template>
        </div>
      </div>

      <p v-if="!pickMenus.length" class="empty">
        {{ t('a.empty') }}<br />{{ t('a.empty2') }}
      </p>

      <!-- 사람 기준: 한 명씩 훑으면서 먹은 걸 눌러 담는다. -->
      <template v-else-if="state.assignView === 'person'">
        <article v-for="p in state.participants" :key="p.id" class="who">
          <header class="who-head">
            <h3 class="who-name">{{ p.name }}</h3>
            <button
              v-if="takenBy(p.id)"
              class="switch"
              type="button"
              @click="clearPerson(p.id)"
            >
              {{ t('a.person.clear') }}
            </button>
            <p class="who-sum num">{{ money(subtotals.get(p.id) ?? 0) }}</p>
          </header>

          <ul class="chips">
            <li v-for="m in pickMenus" :key="m.id">
              <button
                class="chip"
                type="button"
                :aria-pressed="shareOf(m, p.id) > 0"
                @click="cycleShare(m.id, p.id)"
              >
                {{ m.name
                }}<span v-if="m.qty > 1" class="chip-count num">
                  {{ shareOf(m, p.id) }}/{{ m.qty }}</span
                >
              </button>
            </li>
          </ul>

          <p v-if="!takenBy(p.id)" class="who-none">{{ t('a.person.none') }}</p>
        </article>

        <p v-if="hasMulti" class="tap-hint">{{ t('a.tapHint') }}</p>

        <p v-if="menusWithoutMembers.length" class="warn leftover">
          {{ t('a.leftover', { names: menusWithoutMembers.map((m) => m.name).join(', ') }) }}
        </p>
      </template>

      <!-- 메뉴 기준: 한 줄씩 훑으면서 먹은 사람을 눌러 담는다. -->
      <template v-else>
        <article
          v-for="m in pickMenus"
          :key="m.id"
          class="pick"
          :class="{ 'is-empty': !unitsOf(m) }"
        >
        <header class="pick-head">
          <div class="pick-title">
            <h3 class="pick-name">{{ m.name }}<span v-if="m.qty > 1" class="pick-qty num"> ×{{ m.qty }}</span></h3>
          </div>
          <p class="pick-amount num">{{ money(lineTotal(m)) }}</p>
        </header>

        <ul class="chips">
          <li v-for="p in state.participants" :key="p.id">
            <button
              class="chip"
              type="button"
              :aria-pressed="shareOf(m, p.id) > 0"
              @click="cycleShare(m.id, p.id)"
            >
              {{ p.name
              }}<span v-if="m.qty > 1" class="chip-count num">
                {{ shareOf(m, p.id) }}/{{ m.qty }}</span
              >
            </button>
          </li>
        </ul>

        <footer class="pick-foot">
          <p v-if="unitsOf(m)" class="split num">
            {{
              m.qty > 1
                ? t('a.split.units', { n: unitsOf(m), each: money(perUnit(m)) })
                : t('a.split', { n: unitsOf(m), each: money(perUnit(m)) })
            }}
          </p>
          <p v-else class="split is-warn">{{ t('a.nobody') }}</p>
          <div class="pick-actions">
            <button class="switch" type="button" @click="setAllMembers(m.id, true)">
              {{ t('a.all') }}
            </button>
            <button class="switch" type="button" @click="setAllMembers(m.id, false)">
              {{ t('a.none') }}
            </button>
            <button class="switch" type="button" @click="makeCommon(m, true)">
              {{ t('a.toCommon') }}
            </button>
          </div>
        </footer>
        </article>
      </template>
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

.common-qty,
.pick-qty {
  color: var(--ink-3);
  font-size: 0.85em;
  font-weight: 700;
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

/* 보기 전환은 머리말의 언어·통화와 같은 글자 버튼 */
.views {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
}

.view {
  padding: 0.15rem 0;
  border: 0;
  background: none;
  color: var(--ink-3);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0;
}

.view.is-now {
  color: var(--soju);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.view-sep {
  color: var(--rule);
  font-size: 0.72rem;
  font-weight: 400;
}

/* 사람 기준 보기 */
.who {
  padding: 0.9rem 0;
  border-top: 1px dashed var(--rule);
}

.who:last-of-type {
  border-bottom: 1px dashed var(--rule);
}

.who-head {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
}

.who-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 1.02rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.who-sum {
  flex: 0 0 auto;
  color: var(--ink-2);
  font-size: 0.92rem;
  font-weight: 700;
}

.who-none {
  margin-top: 0.5rem;
  color: var(--ink-3);
  font-size: 0.78rem;
}

/* 칩 안의 개수 뱃지: 가져간 수 / 주문한 수 */
.chip-count {
  font-size: 0.82em;
  font-weight: 700;
  opacity: 0.75;
}

.tap-hint {
  margin-top: 1rem;
  color: var(--ink-3);
  font-size: 0.78rem;
  line-height: 1.45;
}

.leftover {
  margin-top: 1rem;
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
