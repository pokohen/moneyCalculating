<script setup>
import { computed, nextTick, ref } from 'vue'
import {
  KINDS,
  addMenu,
  amountToText,
  currency,
  money,
  normalizeAmountText,
  num,
  parseAmount,
  removeMenu,
  state,
  totalAmount,
  updateMenu,
} from '../stores/settlement.js'
import { t } from '../i18n.js'

const draft = ref(newDraft())
const editingId = ref(null)
const nameInput = ref(null)

function newDraft() {
  return { name: '', amountText: '', kind: 'food', isCommon: true }
}

// 입력창은 문자열 그대로 들고, 저장할 때만 최소 단위 정수로 바꾼다.
const amountText = computed({
  get: () => draft.value.amountText,
  set: (v) => {
    draft.value.amountText = normalizeAmountText(v)
  },
})

const canSave = computed(
  () => draft.value.name.trim() !== '' && parseAmount(draft.value.amountText) > 0,
)

function pickKind(kind) {
  draft.value.kind = kind.id
  // 수정 중일 땐 사용자가 정한 공통 여부를 존중한다.
  if (!editingId.value) draft.value.isCommon = kind.defaultCommon
}

function save() {
  if (!canSave.value) return
  const payload = {
    name: draft.value.name.trim(),
    amount: parseAmount(draft.value.amountText),
    kind: draft.value.kind,
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
    kind: menu.kind,
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
    <p class="lede">
      {{ t('m.lede.a') }} <strong>{{ t('m.lede.common') }}</strong
      >{{ t('m.lede.b') }}
    </p>

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
          />
        </label>
      </div>

      <div class="row">
        <label class="field grow">
          <span class="field-label">{{ t('m.field.amount') }}</span>
          <div class="amount-wrap" :class="currency.prefix ? 'unit-lead' : 'unit-trail'">
            <input
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
      </div>

      <div class="row">
        <div class="field grow">
          <span class="field-label">{{ t('m.field.kind') }}</span>
          <div class="kinds">
            <button
              v-for="k in KINDS"
              :key="k.id"
              class="chip"
              type="button"
              :aria-pressed="draft.kind === k.id"
              @click="pickKind(k)"
            >
              {{ t(`kind.${k.id}`) }}
            </button>
          </div>
        </div>
      </div>

      <button
        class="common-toggle"
        type="button"
        :class="{ 'is-on': draft.isCommon }"
        :aria-pressed="draft.isCommon"
        @click="draft.isCommon = !draft.isCommon"
      >
        <span class="common-box" aria-hidden="true">{{ draft.isCommon ? '✓' : '' }}</span>
        <span class="common-text">
          <strong>{{ t('m.common.title') }}</strong>
          <small>{{ draft.isCommon ? t('m.common.on') : t('m.common.off') }}</small>
        </span>
        <span v-if="draft.isCommon" class="stamp">{{ t('stamp.common') }}</span>
      </button>

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
              <span v-if="m.isCommon" class="stamp stamp-sm">{{ t('stamp.common') }}</span>
              <span class="leader"></span>
              <span class="menu-amount num">{{ num(m.amount) }}</span>
            </span>
            <span class="menu-sub">
              {{
                m.isCommon
                  ? t('m.sub.common', { n: state.participants.length })
                  : t('m.sub.pick')
              }}
              · {{ t('m.sub.tap') }}
            </span>
          </button>
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

.grow {
  flex: 1;
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

.kinds {
  display: flex;
  gap: 0.4rem;
}

.kinds .chip {
  flex: 1;
  justify-content: center;
}

.common-toggle {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: var(--tap);
  margin-top: 0.9rem;
  padding: 0.6rem 0.75rem;
  border: 1.5px solid var(--rule);
  border-radius: var(--radius);
  background: #fff;
  text-align: left;
}

.common-toggle.is-on {
  border-color: var(--stamp);
  background: var(--stamp-soft);
}

.common-box {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: 1.5px solid var(--rule);
  border-radius: 3px;
  background: #fff;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
}

.common-toggle.is-on .common-box {
  border-color: var(--stamp);
  background: var(--stamp);
}

.common-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.common-text small {
  color: var(--ink-3);
  font-size: 0.78rem;
}

.common-toggle .stamp {
  margin-left: auto;
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

.menu-del {
  flex: 0 0 auto;
  width: 44px;
  border: 0;
  background: none;
  color: var(--ink-3);
  font-size: 1.2rem;
}
</style>
