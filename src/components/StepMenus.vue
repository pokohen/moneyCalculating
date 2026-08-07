<script setup>
import { computed, nextTick, ref } from 'vue'
import {
  KINDS,
  addMenu,
  formatWon,
  removeMenu,
  state,
  totalAmount,
  updateMenu,
} from '../stores/settlement'

const draft = ref(newDraft())
const editingId = ref(null)
const nameInput = ref(null)

function newDraft() {
  return { name: '', amount: '', kind: 'food', isCommon: true }
}

// 숫자만 남기고 세 자리마다 쉼표를 넣어 보여준다.
const amountText = computed({
  get: () => (draft.value.amount === '' ? '' : formatWon(draft.value.amount)),
  set: (v) => {
    const digits = String(v).replace(/\D/g, '').slice(0, 9)
    draft.value.amount = digits === '' ? '' : Number(digits)
  },
})

const canSave = computed(() => draft.value.name.trim() !== '' && Number(draft.value.amount) > 0)

function pickKind(kind) {
  draft.value.kind = kind.id
  // 수정 중일 땐 사용자가 정한 공통 여부를 존중한다.
  if (!editingId.value) draft.value.isCommon = kind.defaultCommon
}

function save() {
  if (!canSave.value) return
  const payload = {
    name: draft.value.name.trim(),
    amount: Number(draft.value.amount),
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
    amount: menu.amount,
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
      주문한 걸 하나씩 넣으세요. <strong>공통</strong>을 켜면 참가자 전원이 1/n,
      끄면 다음 단계에서 고른 사람끼리만 나눕니다.
    </p>

    <form class="card form" :class="{ 'is-editing': editingId }" @submit.prevent="save">
      <p v-if="editingId" class="editing-flag">메뉴 수정 중</p>

      <div class="row">
        <label class="field grow">
          <span class="field-label">메뉴</span>
          <input
            ref="nameInput"
            v-model="draft.name"
            class="input"
            type="text"
            placeholder="삼겹살 2인분"
            autocomplete="off"
            enterkeyhint="next"
            maxlength="24"
          />
        </label>
      </div>

      <div class="row">
        <label class="field grow">
          <span class="field-label">금액</span>
          <div class="amount-wrap">
            <input
              v-model="amountText"
              class="input amount num"
              type="text"
              inputmode="numeric"
              placeholder="0"
              enterkeyhint="done"
            />
            <span class="unit">원</span>
          </div>
        </label>
      </div>

      <div class="row">
        <div class="field grow">
          <span class="field-label">종류</span>
          <div class="kinds">
            <button
              v-for="k in KINDS"
              :key="k.id"
              class="chip"
              type="button"
              :aria-pressed="draft.kind === k.id"
              @click="pickKind(k)"
            >
              {{ k.label }}
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
          <strong>공통 메뉴</strong>
          <small>{{
            draft.isCommon ? '참가자 전원이 나눠 냅니다' : '고른 사람끼리만 나눠 냅니다'
          }}</small>
        </span>
        <span v-if="draft.isCommon" class="stamp">공통</span>
      </button>

      <div class="form-actions">
        <button v-if="editingId" class="btn btn-ghost" type="button" @click="cancelEdit">
          취소
        </button>
        <button class="btn" type="submit" :disabled="!canSave">
          {{ editingId ? '수정 저장' : '메뉴 추가' }}
        </button>
      </div>
    </form>

    <div class="list">
      <div class="section-title">
        <span>주문 내역</span>
        <span class="count num">{{ formatWon(totalAmount) }}원</span>
      </div>

      <p v-if="!state.menus.length" class="empty">
        아직 넣은 메뉴가 없어요.<br />영수증을 보면서 하나씩 추가하세요.
      </p>

      <ul v-else class="menus">
        <li v-for="m in state.menus" :key="m.id" class="menu" :class="{ 'is-editing': editingId === m.id }">
          <button class="menu-main" type="button" @click="edit(m)">
            <span class="menu-line">
              <span class="menu-name">{{ m.name }}</span>
              <span v-if="m.isCommon" class="stamp stamp-sm">공통</span>
              <span class="leader"></span>
              <span class="menu-amount num">{{ formatWon(m.amount) }}</span>
            </span>
            <span class="menu-sub">
              {{ m.isCommon ? `전원 ${state.participants.length}명` : '고른 사람만' }} · 눌러서 수정
            </span>
          </button>
          <button class="menu-del" type="button" :aria-label="`${m.name} 삭제`" @click="drop(m)">
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
  padding-right: 2.25rem;
  font-size: 1.15rem;
  font-weight: 700;
  text-align: right;
}

.unit {
  position: absolute;
  top: 50%;
  right: 0.85rem;
  transform: translateY(-50%);
  color: var(--ink-3);
  font-size: 0.9rem;
  pointer-events: none;
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
