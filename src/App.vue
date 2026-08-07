<script setup>
import { computed, ref } from 'vue'
import {
  CURRENCY_CODES,
  STEPS,
  goToStep,
  menusWithoutMembers,
  money,
  resetAll,
  setCurrency,
  state,
  totalAmount,
} from './stores/settlement.js'
import { LOCALES, LOCALE_NAMES, locale, pathFor, t } from './i18n.js'
import StepParticipants from './components/StepParticipants.vue'
import StepMenus from './components/StepMenus.vue'
import StepAssign from './components/StepAssign.vue'
import StepResult from './components/StepResult.vue'

const stepViews = { 1: StepParticipants, 2: StepMenus, 3: StepAssign, 4: StepResult }
const currentView = computed(() => stepViews[state.step])

const askingReset = ref(false)

// 각 단계에서 다음으로 넘어갈 수 있는 조건
const gate = computed(() => {
  if (state.step === 1) {
    return {
      label: t('gate.1.label'),
      ready: state.participants.length >= 1,
      blocked: t('gate.1.blocked'),
    }
  }
  if (state.step === 2) {
    return {
      label: t('gate.2.label'),
      ready: state.menus.length >= 1,
      blocked: t('gate.2.blocked'),
    }
  }
  if (state.step === 3) {
    return {
      label: t('gate.3.label'),
      ready: menusWithoutMembers.value.length === 0,
      blocked: t('gate.3.blocked', {
        names: menusWithoutMembers.value.map((m) => m.name).join(', '),
      }),
    }
  }
  return null
})

function reachable(no) {
  if (no <= state.step) return true
  if (no >= 2 && state.participants.length === 0) return false
  if (no >= 3 && state.menus.length === 0) return false
  if (no >= 4 && menusWithoutMembers.value.length > 0) return false
  return true
}

function next() {
  if (gate.value?.ready) goToStep(state.step + 1)
}

function back() {
  if (state.step > 1) goToStep(state.step - 1)
}

function doReset() {
  resetAll()
  askingReset.value = false
  window.scrollTo({ top: 0, behavior: 'instant' })
}
</script>

<template>
  <div class="desk" :class="{ 'no-bar': !gate }">
    <main class="receipt">
      <header class="head">
        <div class="head-top">
          <p class="brand">{{ t('app.brand') }}</p>
          <button
            v-if="state.participants.length || state.menus.length"
            class="reset-link"
            type="button"
            @click="askingReset = true"
          >
            {{ t('app.restart') }}
          </button>
        </div>
        <h1 class="title">{{ t('app.title') }}</h1>
        <p class="meta num">
          <span>{{ t('app.meta.people', { n: state.participants.length }) }}</span>
          <span class="sep">·</span>
          <span>{{ t('app.meta.menus', { n: state.menus.length }) }}</span>
          <span class="sep">·</span>
          <span>{{ money(totalAmount) }}</span>
        </p>

        <div class="prefs">
          <!-- 언어는 주소가 바뀌는 진짜 페이지 이동이다. 저장된 계산서는 그대로 남는다. -->
          <nav class="langs" :aria-label="t('app.lang')">
            <template v-for="(code, i) in LOCALES" :key="code">
              <span v-if="i" class="lang-sep" aria-hidden="true">/</span>
              <span v-if="code === locale" class="lang is-now" aria-current="true">
                {{ LOCALE_NAMES[code] }}
              </span>
              <a v-else class="lang" :href="pathFor(code)" :hreflang="code">
                {{ LOCALE_NAMES[code] }}
              </a>
            </template>
          </nav>

          <div class="cur" role="group" :aria-label="t('app.currency')">
            <template v-for="(code, i) in CURRENCY_CODES" :key="code">
              <span v-if="i" class="lang-sep" aria-hidden="true">/</span>
              <button
                class="lang cur-btn"
                type="button"
                :class="{ 'is-now': state.currency === code }"
                :aria-pressed="state.currency === code"
                @click="setCurrency(code)"
              >
                {{ t(`cur.${code}`) }}
              </button>
            </template>
          </div>
        </div>
      </header>

      <nav class="steps" :aria-label="t('app.steps')">
        <button
          v-for="no in STEPS"
          :key="no"
          class="step"
          type="button"
          :class="{ 'is-now': no === state.step, 'is-done': no < state.step }"
          :disabled="!reachable(no)"
          :aria-current="no === state.step ? 'step' : undefined"
          @click="goToStep(no)"
        >
          <span class="step-no num">{{ no }}</span>
          <span class="step-name">{{ t(`step.${no}`) }}</span>
        </button>
      </nav>

      <section class="body">
        <component :is="currentView" />
      </section>

      <div class="torn" aria-hidden="true"></div>
    </main>

    <div v-if="gate" class="bar">
      <div class="bar-inner">
        <button v-if="state.step > 1" class="btn btn-ghost bar-back" type="button" @click="back">
          {{ t('nav.back') }}
        </button>
        <button class="btn btn-go bar-next" type="button" :disabled="!gate.ready" @click="next">
          {{ gate.label }}
        </button>
      </div>
      <p v-if="!gate.ready" class="bar-note">{{ gate.blocked }}</p>
    </div>

    <div v-if="askingReset" class="sheet-backdrop" @click.self="askingReset = false">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <h2 id="reset-title" class="sheet-title">{{ t('reset.title') }}</h2>
        <p class="hint">{{ t('reset.body') }}</p>
        <div class="sheet-actions">
          <button class="btn btn-ghost" type="button" @click="askingReset = false">
            {{ t('reset.keep') }}
          </button>
          <button class="btn btn-danger" type="button" @click="doReset">{{ t('reset.wipe') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.desk {
  min-height: 100dvh;
  padding: max(0.75rem, env(safe-area-inset-top)) 0.75rem
    calc(7.5rem + env(safe-area-inset-bottom));
  background: radial-gradient(120% 60% at 50% 0%, #24303f 0%, var(--desk) 45%, var(--desk-2) 100%);
}

.desk.no-bar {
  padding-bottom: calc(2rem + env(safe-area-inset-bottom));
}

.receipt {
  position: relative;
  max-width: 480px;
  margin: 0 auto;
  padding: 1.25rem 1.1rem 1.5rem;
  background: var(--paper);
  border-radius: 3px 3px 0 0;
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.35);
}

/* 영수증을 뜯어낸 아래쪽 톱니 */
.torn {
  --tooth: 18px;
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(-1 * var(--tooth) / 2);
  height: calc(var(--tooth) / 2);
  background: var(--paper);
  -webkit-mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% /
    var(--tooth) 100% repeat-x;
  mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50% /
    var(--tooth) 100% repeat-x;
}

.head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  color: var(--soju);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.28em;
}

.reset-link {
  padding: 0.25rem 0;
  border: 0;
  background: none;
  color: var(--ink-3);
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.title {
  margin-top: 0.15rem;
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: -0.01em;
  line-height: 1.15;
}

.meta {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.35rem;
  color: var(--ink-3);
  font-size: 0.8rem;
}

.sep {
  opacity: 0.5;
}

.prefs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.7rem;
}

.langs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* 통화도 언어와 같은 글자 버튼. 둘 다 계산 전체에 걸리는 설정이라 늘 같은 자리에 둔다. */
.cur {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 0.4rem;
}

.cur-btn {
  border: 0;
  background: none;
}

.lang {
  padding: 0.15rem 0;
  color: var(--ink-3);
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
}

.lang:hover {
  color: var(--soju);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.lang.is-now {
  color: var(--soju);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.lang-sep {
  color: var(--rule);
  font-size: 0.72rem;
}

.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
  margin: 1rem 0 1.25rem;
  padding: 0.6rem 0;
  border-top: 1px dashed var(--rule);
  border-bottom: 1px dashed var(--rule);
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.3rem 0;
  border: 0;
  background: none;
  color: var(--ink-3);
}

.step:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.step-no {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  font-size: 0.78rem;
  font-weight: 700;
}

.step-name {
  font-size: 0.75rem;
  font-weight: 600;
}

.step.is-done {
  color: var(--soju);
}

.step.is-now {
  color: var(--ink);
}

.step.is-now .step-no {
  background: var(--ink);
  border-color: var(--ink);
  color: var(--paper);
}

/* 하단 고정 실행 바 — 한 손으로 쥐었을 때 엄지 위치 */
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.7rem 0.75rem calc(0.7rem + env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--desk-2) 60%, rgb(19 26 36 / 0));
}

.bar-inner {
  display: flex;
  gap: 0.5rem;
  max-width: 480px;
  margin: 0 auto;
}

.bar-back {
  flex: 0 0 auto;
  background: #33404f;
  border-color: #445265;
  color: #eef1f5;
}

.bar-back:active {
  background: #3d4b5c;
}

.bar-next {
  flex: 1;
}

.bar-note {
  max-width: 480px;
  margin: 0.45rem auto 0;
  color: rgb(255 255 255 / 0.55);
  font-size: 0.78rem;
  text-align: center;
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  padding: 1rem;
  padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  background: rgb(10 14 20 / 0.6);
}

.sheet {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 1.25rem;
  border-radius: 6px;
  background: var(--paper);
  animation: rise 0.18s ease-out;
}

@keyframes rise {
  from {
    transform: translateY(12px);
    opacity: 0;
  }
}

.sheet-title {
  margin-bottom: 0.4rem;
  font-size: 1.1rem;
  font-weight: 800;
}

.sheet-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.1rem;
}

.sheet-actions .btn {
  flex: 1;
}
</style>
