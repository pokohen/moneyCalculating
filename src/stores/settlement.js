import { computed, reactive, watch } from 'vue'

const STORAGE_KEY = 'hoesik.settlement.v1'

export const STEPS = [
  { no: 1, name: '참가자', desc: '오늘 누가 왔는지' },
  { no: 2, name: '메뉴', desc: '뭘 시켰는지' },
  { no: 3, name: '배정', desc: '누가 먹었는지' },
  { no: 4, name: '정산', desc: '얼마씩 내는지' },
]

// 안주는 기본이 공통, 주류는 기본이 마신 사람만.
export const KINDS = [
  { id: 'food', label: '안주', defaultCommon: true },
  { id: 'drink', label: '주류', defaultCommon: false },
  { id: 'etc', label: '기타', defaultCommon: true },
]

export const ROUND_UNITS = [
  { value: 1, label: '1원' },
  { value: 10, label: '10원' },
  { value: 100, label: '100원' },
  { value: 1000, label: '1,000원' },
]

const blankState = () => ({
  step: 1,
  participants: [], // { id, name }
  menus: [], // { id, name, amount, kind, isCommon, memberIds }
  roundUnit: 100,
})

let idSeq = 0
function newId(prefix) {
  idSeq += 1
  return `${prefix}_${Date.now().toString(36)}${idSeq.toString(36)}`
}

function loadState() {
  const fallback = blankState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object') return fallback

    const participants = Array.isArray(saved.participants)
      ? saved.participants
          .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
          .map((p) => ({ id: p.id, name: p.name }))
      : []
    const knownIds = new Set(participants.map((p) => p.id))
    const menus = Array.isArray(saved.menus)
      ? saved.menus
          .filter((m) => m && typeof m.id === 'string')
          .map((m) => ({
            id: m.id,
            name: String(m.name ?? ''),
            amount: Number.isFinite(m.amount) ? Math.max(0, Math.round(m.amount)) : 0,
            kind: KINDS.some((k) => k.id === m.kind) ? m.kind : 'etc',
            isCommon: Boolean(m.isCommon),
            // 지워진 참가자가 메뉴에 남아 있지 않도록 걸러낸다.
            memberIds: Array.isArray(m.memberIds) ? m.memberIds.filter((id) => knownIds.has(id)) : [],
          }))
      : []

    return {
      step: [1, 2, 3, 4].includes(saved.step) ? saved.step : 1,
      participants,
      menus,
      roundUnit: ROUND_UNITS.some((u) => u.value === saved.roundUnit) ? saved.roundUnit : 100,
    }
  } catch {
    return fallback
  }
}

export const state = reactive(loadState())

// 새로고침해도 남도록 바뀔 때마다 브라우저 저장소에 기록한다.
watch(state, () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* 저장소가 막혀 있어도 계산은 계속된다 */
  }
})

/* ── 조작 ──────────────────────────────────────── */

export function goToStep(step) {
  state.step = step
  window.scrollTo({ top: 0, behavior: 'instant' })
}

export function addParticipant(name) {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, message: '이름을 적어주세요.' }
  if (state.participants.some((p) => p.name === trimmed)) {
    return { ok: false, message: `'${trimmed}' 은(는) 이미 있어요. 다르게 적어주세요.` }
  }
  state.participants.push({ id: newId('p'), name: trimmed })
  return { ok: true }
}

export function removeParticipant(id) {
  state.participants = state.participants.filter((p) => p.id !== id)
  state.menus.forEach((m) => {
    m.memberIds = m.memberIds.filter((mid) => mid !== id)
  })
}

export function addMenu({ name, amount, kind, isCommon }) {
  const menu = {
    id: newId('m'),
    name: name.trim(),
    amount: Math.max(0, Math.round(amount)),
    kind,
    isCommon,
    // 개별 메뉴는 아무도 없는 상태로 시작한다. 배정 단계에서 먹은 사람만 넣는다.
    memberIds: [],
  }
  state.menus.push(menu)
  return menu
}

export function updateMenu(id, patch) {
  const menu = state.menus.find((m) => m.id === id)
  if (!menu) return
  Object.assign(menu, patch)
  if (menu.isCommon) menu.memberIds = []
}

export function removeMenu(id) {
  state.menus = state.menus.filter((m) => m.id !== id)
}

export function toggleMember(menuId, participantId) {
  const menu = state.menus.find((m) => m.id === menuId)
  if (!menu || menu.isCommon) return
  menu.memberIds = menu.memberIds.includes(participantId)
    ? menu.memberIds.filter((id) => id !== participantId)
    : [...menu.memberIds, participantId]
}

export function setAllMembers(menuId, on) {
  const menu = state.menus.find((m) => m.id === menuId)
  if (!menu || menu.isCommon) return
  menu.memberIds = on ? state.participants.map((p) => p.id) : []
}

export function resetAll() {
  Object.assign(state, blankState())
}

/* ── 계산 ──────────────────────────────────────── */

// 총액을 인원수만큼 1원 단위 정수로 쪼갠다. 나머지 1원은 앞사람부터 한 번씩.
function splitEvenly(amount, count) {
  const base = Math.floor(amount / count)
  const remainder = amount - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

function payersOf(menu) {
  if (menu.isCommon) return state.participants.map((p) => p.id)
  const ordered = state.participants.map((p) => p.id)
  return ordered.filter((id) => menu.memberIds.includes(id))
}

export const menusWithoutMembers = computed(() =>
  state.menus.filter((m) => !m.isCommon && payersOf(m).length === 0),
)

export const totalAmount = computed(() => state.menus.reduce((sum, m) => sum + m.amount, 0))

export const settlement = computed(() => {
  const byPerson = new Map(
    state.participants.map((p) => [p.id, { id: p.id, name: p.name, subtotal: 0, items: [] }]),
  )
  let unassignedAmount = 0

  state.menus.forEach((menu) => {
    const payers = payersOf(menu)
    if (payers.length === 0) {
      unassignedAmount += menu.amount
      return
    }
    const shares = splitEvenly(menu.amount, payers.length)
    payers.forEach((pid, i) => {
      const row = byPerson.get(pid)
      if (!row) return
      row.subtotal += shares[i]
      row.items.push({
        menuId: menu.id,
        name: menu.name,
        kind: menu.kind,
        isCommon: menu.isCommon,
        share: shares[i],
        headcount: payers.length,
      })
    })
  })

  const unit = state.roundUnit
  const people = [...byPerson.values()].map((row) => ({
    ...row,
    // 걷는 금액의 합이 결제 총액을 넘지 않도록 내림한다. 단위가 1원이면 그대로다.
    payable: Math.floor(row.subtotal / unit) * unit,
  }))

  const billTotal = totalAmount.value
  const collected = people.reduce((sum, p) => sum + p.payable, 0)
  // 실제로 사람에게 청구되는 금액. 아무도 배정되지 않은 메뉴는 빠진다.
  const charged = billTotal - unassignedAmount

  return {
    people,
    billTotal,
    charged,
    collected,
    // 내림하고 덜 걷힌 금액. 이만큼은 따로 채워야 한다. 항상 0 이상이다.
    remainder: charged - collected,
    unassignedAmount,
    headcount: state.participants.length,
  }
})

/* ── 표시 ──────────────────────────────────────── */

const won = new Intl.NumberFormat('ko-KR')
export function formatWon(n) {
  return won.format(Math.round(n || 0))
}

export function kindLabel(kindId) {
  return KINDS.find((k) => k.id === kindId)?.label ?? '기타'
}
