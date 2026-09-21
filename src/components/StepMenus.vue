<script setup>
import { computed, nextTick, ref } from 'vue'
import {
  addMenu,
  amountToText,
  bumpQty,
  currency,
  lineTotal,
  money,
  normalizeAmountText,
  num,
  parseAmount,
  parseQuickAdd,
  removeMenu,
  state,
  totalAmount,
  updateMenu,
} from '../stores/settlement.js'
import { t } from '../i18n.js'

const draft = ref(newDraft())
const editingId = ref(null)
const nameInput = ref(null)
const amountInput = ref(null)

// 한 줄 입력. 상세 폼과 상태를 나눠 둬서 서로 간섭하지 않는다.
const quick = ref('')
const quickInput = ref(null)
// 공통/개별은 한 번 고르면 다음 줄에도 그대로 간다. 술을 연달아 넣을 때 매번 누르지 않게.
const quickCommon = ref(true)

const quickParsed = computed(() => parseQuickAdd(quick.value))

function newDraft() {
  return { name: '', amountText: '', qty: 1, isCommon: true }
}

// 입력창은 문자열 그대로 들고, 저장할 때만 최소 단위 정수로 바꾼다.
const amountText = computed({
  get: () => draft.value.amountText,
  set: (v) => {
    draft.value.amountText = normalizeAmountText(v)
  },
})

const unitPrice = computed(() => parseAmount(draft.value.amountText))
const canSave = computed(() => draft.value.name.trim() !== '' && unitPrice.value > 0)

function stepDraftQty(delta) {
  draft.value.qty = Math.max(1, draft.value.qty + delta)
}

/* Enter 한 번에 한 줄씩. 금액이 빠졌으면 상세 폼으로 넘겨 금액 칸에 커서를 둔다. */
function submitQuick() {
  const parsed = quickParsed.value
  if (!parsed) return

  if (parsed.amount > 0) {
    addMenu({
      name: parsed.name,
      amount: parsed.amount,
      qty: parsed.qty,
      isCommon: quickCommon.value,
    })
    quick.value = ''
    nextTick(() => quickInput.value?.focus())
    return
  }

  draft.value = {
    name: parsed.name,
    amountText: '',
    qty: parsed.qty,
    isCommon: quickCommon.value,
  }
  quick.value = ''
  nextTick(() => amountInput.value?.focus())
}

/* 이름 칸의 Enter. 지금까지는 폼이 submit 되고 금액이 비어서 아무 일도 안 일어났다. */
function focusAmount() {
  amountInput.value?.focus()
}

function save() {
  if (!canSave.value) return
  const payload = {
    name: draft.value.name.trim(),
    amount: unitPrice.value,
    qty: draft.value.qty,
    isCommon: draft.value.isCommon,
  }
  if (editingId.value) {
    updateMenu(editingId.value, payload)
    editingId.value = null
  } else {
    addMenu(payload)
  }
  draft.value = newDraft()
  nextTick(() => nameInput.value?.focus())
}

function edit(menu) {
  editingId.value = menu.id
  draft.value = {
    name: menu.name,
    amountText: amountToText(menu.amount),
    qty: menu.qty,
    isCommon: menu.isCommon,
  }
  nextTick(() => nameInput.value?.focus())
}

function cancelEdit() {
  editingId.value = null
  draft.value = newDraft()
}

function drop(menu) {
  if (editingId.value === menu.id) cancelEdit()
  removeMenu(menu.id)
}
</script>

<template>
  <div>
    <p class="lede">{{ t('m.lede') }}</p>

    <!-- 한 줄로 치고 Enter. 상세 폼은 아래에 그대로 두고 빠른 길만 하나 더 낸다. -->
    <form v-if="!editingId" class="card quick" @submit.prevent="submitQuick">
      <label class="field">
        <span class="field-label">{{ t('m.quick.label') }}</span>
        <div class="quick-row">
          <input
            ref="quickInput"
            v-model="quick"
            class="input"
            type="text"
            :placeholder="t('m.quick.placeholder')"
            autocomplete="off"
            enterkeyhint="done"
          />
          <button class="btn quick-add" type="submit" :disabled="!quickParsed">
            {{ t('m.quick.add') }}
          </button>
        </div>
      </label>

      <p class="quick-preview" :class="{ 'is-hint': !quickParsed || !quickParsed.amount }">
        <template v-if="quickParsed && quickParsed.amount > 0">
          {{
            quickParsed.qty > 1
              ? t('m.quick.many', {
                  name: quickParsed.name,
                  price: money(quickParsed.amount),
                  n: quickParsed.qty,
                  total: money(quickParsed.amount * quickParsed.qty),
                })
              : t('m.quick.one', {
                  name: quickParsed.name,
                  price: money(quickParsed.amount),
                })
          }}
        </template>
        <template v-else-if="quickParsed">
          {{ t('m.quick.nameOnly', { name: quickParsed.name }) }}
        </template>
        <template v-else>{{ t('m.quick.hint') }}</template>
      </p>

      <div class="splits">
        <button
          class="chip split-common"
          type="button"
          :aria-pressed="quickCommon"
          @click="quickCommon = true"
        >
          {{ t('m.split.common') }}
        </button>
        <button
          class="chip"
          type="button"
          :aria-pressed="!quickCommon"
          @click="quickCommon = false"
        >
          {{ t('m.split.pick') }}
        </button>
      </div>
    </form>

    <form class="card form" :class="{ 'is-editing': editingId }" @submit.prevent="save">
      <p v-if="editingId" class="editing-flag">{{ t('m.editing') }}</p>

      <div class="row">
        <label class="field grow">
          <span class="field-label">{{ t('m.field.name') }}</span>
          <input
            ref="nameInput"
            v-model="draft.name"
            class="input"
            type="text"
            :placeholder="t('m.placeholder')"
            autocomplete="off"
            enterkeyhint="next"
            maxlength="24"
            @keydown.enter.prevent="focusAmount"
          />
        </label>
      </div>

      <div class="row row-split">
        <label class="field grow">
          <span class="field-label">{{ t('m.field.amount') }}</span>
          <div class="amount-wrap" :class="currency.prefix ? 'unit-lead' : 'unit-trail'">
            <input
              ref="amountInput"
              v-model="amountText"
              class="input amount num"
              type="text"
              :inputmode="currency.decimals ? 'decimal' : 'numeric'"
              :placeholder="currency.decimals ? '0.00' : '0'"
              enterkeyhint="done"
            />
            <span class="unit">{{ currency.symbol }}</span>
          </div>
        </label>

        <div class="field qty-field">
          <span class="field-label">{{ t('m.field.qty') }}</span>
          <div class="stepper">
            <button
              class="step-btn"
              type="button"
              :disabled="draft.qty <= 1"
              aria-label="−"
              @click="stepDraftQty(-1)"
            >
              −
            </button>
            <span class="step-value num">{{ draft.qty }}</span>
            <button class="step-btn" type="button" aria-label="+" @click="stepDraftQty(1)">
              +
            </button>
          </div>
        </div>
      </div>

      <p v-if="draft.qty > 1 && unitPrice > 0" class="line-total num">
        {{
          t('m.qty.line', {
            price: money(unitPrice),
            n: draft.qty,
            total: money(unitPrice * draft.qty),
          })
        }}
      </p>

      <!-- 이 메뉴를 누가 나눠 낼지. 계산에 실제로 영향을 주는 유일한 구분이다. -->
      <div class="row">
        <div class="field grow">
          <span class="field-label">{{ t('m.field.split') }}</span>
          <div class="splits">
            <button
              class="chip split-common"
              type="button"
              :aria-pressed="draft.isCommon"
              @click="draft.isCommon = true"
            >
              {{ t('m.split.common') }}
            </button>
            <button
              class="chip"
              type="button"
              :aria-pressed="!draft.isCommon"
              @click="draft.isCommon = false"
            >
              {{ t('m.split.pick') }}
            </button>
          </div>
          <p class="split-note" :class="{ 'is-common': draft.isCommon }">
            <span v-if="draft.isCommon" class="stamp stamp-sm">{{ t('stamp.common') }}</span>
            {{ draft.isCommon ? t('m.common.on') : t('m.common.off') }}
          </p>
        </div>
      </div>

      <div class="form-actions">
        <button v-if="editingId" class="btn btn-ghost" type="button" @click="cancelEdit">
          {{ t('m.cancel') }}
        </button>
        <button class="btn" type="submit" :disabled="!canSave">
          {{ editingId ? t('m.save') : t('m.add') }}
        </button>
      </div>
    </form>

    <div class="list">
      <div class="section-title">
        <span>{{ t('m.heading') }}</span>
        <span class="count num">{{ money(totalAmount) }}</span>
      </div>

      <p v-if="!state.menus.length" class="empty">
        {{ t('m.empty') }}<br />{{ t('m.empty2') }}
      </p>

      <ul v-else class="menus">
        <li v-for="m in state.menus" :key="m.id" class="menu" :class="{ 'is-editing': editingId === m.id }">
          <button class="menu-main" type="button" @click="edit(m)">
            <span class="menu-line">
              <span class="menu-name">{{ m.name }}</span>
              <span v-if="m.qty > 1" class="menu-qty num">×{{ m.qty }}</span>
              <span v-if="m.isCommon" class="stamp stamp-sm">{{ t('stamp.common') }}</span>
              <span class="leader"></span>
              <span class="menu-amount num">{{ num(lineTotal(m)) }}</span>
            </span>
            <span class="menu-sub">
              <template v-if="m.qty > 1">
                {{ t('m.sub.unit', { price: money(m.amount) }) }} ·
              </template>
              {{
                m.isCommon
                  ? t('m.sub.common', { n: state.participants.length })
                  : t('m.sub.pick')
              }}
              · {{ t('m.sub.tap') }}
            </span>
          </button>

          <!-- 소주 한 병 더 시켰을 때 메뉴를 열지 않고 바로 올린다. -->
          <div class="menu-qty-ctrl">
            <button
              class="step-btn"
              type="button"
              :disabled="m.qty <= 1"
              :aria-label="t('m.qty.down', { name: m.name })"
              @click="bumpQty(m.id, -1)"
            >
              −
            </button>
            <button
              class="step-btn"
              type="button"
              :aria-label="t('m.qty.up', { name: m.name })"
              @click="bumpQty(m.id, 1)"
            >
              +
            </button>
          </div>

          <button
            class="menu-del"
            type="button"
            :aria-label="t('m.delete', { name: m.name })"
            @click="drop(m)"
          >
            ×
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.lede {
  margin-bottom: 1.1rem;
  color: var(--ink-2);
  font-size: 0.92rem;
}

.lede strong {
  color: var(--stamp);
}

.card {
  padding: 1rem;
  border: 1.5px solid var(--rule);
  border-radius: var(--radius);
  background: var(--paper-2);
}

.form.is-editing {
  border-color: var(--soju);
  background: var(--soju-soft);
}

/* 한 줄 입력. 상세 폼과 같은 종이 위에 있지만 여기가 먼저 눈에 들어와야 한다. */
.quick {
  margin-bottom: 0.75rem;
  border-color: var(--ink-3);
}

.quick-row {
  display: flex;
  gap: 0.5rem;
}

.quick-row .input {
  flex: 1;
  min-width: 0;
}

.quick-add {
  flex: 0 0 auto;
  padding: 0 1rem;
}

/* 친 대로 어떻게 읽혔는지 그 자리에서 보여 준다. 안 맞으면 바로 고칠 수 있게. */
.quick-preview {
  margin-top: 0.55rem;
  color: var(--soju);
  font-size: 0.86rem;
  font-weight: 700;
  line-height: 1.45;
}

.quick-preview.is-hint {
  color: var(--ink-3);
  font-weight: 400;
}

.quick .splits {
  margin-top: 0.7rem;
}

.editing-flag {
  margin-bottom: 0.75rem;
  color: var(--soju);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.row + .row {
  margin-top: 0.75rem;
}

/* 금액과 수량은 라벨 아래 남은 높이를 똑같이 채운다.
   금액 입력창이 글자 크기 때문에 --tap 보다 커져도 둘의 높이가 맞는다. */
.row-split {
  display: flex;
  align-items: stretch;
  gap: 0.6rem;
}

.row-split .field {
  display: flex;
  flex-direction: column;
}

.row-split .amount-wrap,
.row-split .stepper {
  flex: 1;
}

.row-split .input {
  height: 100%;
}

.grow {
  flex: 1;
  min-width: 0;
}

.qty-field {
  flex: 0 0 auto;
}

/* 수량 조절: 한 손으로 누르는 자리라 버튼을 크게 잡는다 */
.stepper {
  display: flex;
  align-items: center;
  min-height: var(--tap);
  border: 1.5px solid var(--rule);
  border-radius: var(--radius);
  background: #fff;
}

.step-btn {
  width: 40px;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
}

.step-btn:disabled {
  color: var(--paper-3);
  cursor: not-allowed;
}

.step-value {
  min-width: 1.5rem;
  font-size: 1rem;
  font-weight: 700;
  text-align: center;
}

.line-total {
  margin-top: 0.55rem;
  color: var(--soju);
  font-size: 0.86rem;
  font-weight: 700;
  text-align: right;
}

.amount-wrap {
  position: relative;
}

.amount {
  font-size: 1.15rem;
  font-weight: 700;
  text-align: right;
}

.unit-trail .amount {
  padding-right: 2.25rem;
}

.unit-lead .amount {
  padding-left: 2.25rem;
}

.unit {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ink-3);
  font-size: 0.95rem;
  pointer-events: none;
}

.unit-trail .unit {
  right: 0.85rem;
}

.unit-lead .unit {
  left: 0.85rem;
}

.splits {
  display: flex;
  gap: 0.4rem;
}

.splits .chip {
  flex: 1;
  justify-content: center;
}

/* 공통은 이 앱에서 늘 도장 빨강이다. 개별은 다른 칩과 같은 초록. */
.split-common[aria-pressed='true'] {
  border-color: var(--stamp);
  background: var(--stamp);
}

.split-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.5rem;
  color: var(--ink-3);
  font-size: 0.8rem;
}

.split-note.is-common {
  color: var(--stamp);
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.form-actions .btn {
  flex: 1;
}

.list {
  margin-top: 1.75rem;
}

.count {
  margin-left: auto;
  color: var(--ink);
  font-weight: 700;
  letter-spacing: 0;
}

.menus {
  border-top: 1px dashed var(--rule);
}

.menu {
  display: flex;
  align-items: stretch;
  border-bottom: 1px dashed var(--rule);
}

.menu.is-editing {
  background: var(--soju-soft);
}

.menu-main {
  flex: 1;
  min-width: 0;
  padding: 0.7rem 0.25rem;
  border: 0;
  background: none;
  text-align: left;
}

.menu-line {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.menu-name {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-amount {
  font-weight: 700;
}

.menu-sub {
  display: block;
  margin-top: 0.15rem;
  color: var(--ink-3);
  font-size: 0.76rem;
}

.stamp-sm {
  flex: 0 0 auto;
  padding: 0 0.3em;
  border-width: 1.5px;
  box-shadow: inset 0 0 0 1px var(--paper), inset 0 0 0 2.5px var(--stamp);
  font-size: 0.6rem;
}

.menu-qty {
  flex: 0 0 auto;
  color: var(--ink-2);
  font-size: 0.86rem;
  font-weight: 700;
}

.menu-qty-ctrl {
  display: flex;
  flex: 0 0 auto;
  align-self: center;
  border: 1.5px solid var(--rule);
  border-radius: 999px;
  background: #fff;
  overflow: hidden;
}

.menu-qty-ctrl .step-btn {
  width: 34px;
  height: 34px;
  font-size: 1rem;
}

.menu-qty-ctrl .step-btn + .step-btn {
  border-left: 1px solid var(--rule);
}

.menu-del {
  flex: 0 0 auto;
  width: 36px;
  border: 0;
  background: none;
  color: var(--ink-3);
  font-size: 1.2rem;
}
</style>
