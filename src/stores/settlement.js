import { computed, reactive, watch } from "vue";
import { locale } from "../i18n.js";

const STORAGE_KEY = "hoesik.settlement.v1";

/* 금액은 전부 '최소 단위 정수'로 들고 있는다.
   원·엔은 1원/1엔, 달러는 1센트. 그래서 소수점 오차 없이 1/n 이 딱 떨어진다.
   units 는 걷는 단위 후보이며 이것도 최소 단위 기준이다(달러의 100 = $1). */
export const CURRENCIES = {
  KRW: {
    symbol: "원",
    prefix: false,
    decimals: 0,
    units: [1, 10, 100, 1000],
    defaultUnit: 1,
  },
  JPY: {
    symbol: "円",
    prefix: false,
    decimals: 0,
    units: [1, 10, 100, 1000],
    defaultUnit: 1,
  },
  USD: {
    symbol: "$",
    prefix: true,
    decimals: 2,
    units: [1, 10, 100, 500],
    defaultUnit: 1,
  },
};
export const CURRENCY_CODES = Object.keys(CURRENCIES);

// 처음 열었을 때만 언어로 짐작한다. 그 뒤로는 사용자가 고른 값을 따른다.
const GUESS_BY_LOCALE = { ko: "KRW", ja: "JPY", en: "USD" };

// 화면에 보이는 이름은 언어별로 다르므로 i18n의 step.1 … step.4 를 쓴다.
export const STEPS = [1, 2, 3, 4];

// 안주는 기본이 공통, 주류는 기본이 마신 사람만.
export const KINDS = [
  { id: "food", defaultCommon: true },
  { id: "drink", defaultCommon: false },
  { id: "etc", defaultCommon: true },
];

const blankState = () => {
  const code = GUESS_BY_LOCALE[locale.value] ?? "KRW";
  return {
    step: 1,
    participants: [], // { id, name }
    menus: [], // { id, name, amount, kind, isCommon, memberIds }
    currency: code,
    roundUnit: CURRENCIES[code].defaultUnit,
  };
};

let idSeq = 0;
function newId(prefix) {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}${idSeq.toString(36)}`;
}

function loadState() {
  const fallback = blankState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return fallback;

    const participants = Array.isArray(saved.participants)
      ? saved.participants
          .filter(
            (p) => p && typeof p.id === "string" && typeof p.name === "string",
          )
          .map((p) => ({ id: p.id, name: p.name }))
      : [];
    const knownIds = new Set(participants.map((p) => p.id));
    const menus = Array.isArray(saved.menus)
      ? saved.menus
          .filter((m) => m && typeof m.id === "string")
          .map((m) => ({
            id: m.id,
            name: String(m.name ?? ""),
            amount: Number.isFinite(m.amount)
              ? Math.max(0, Math.round(m.amount))
              : 0,
            kind: KINDS.some((k) => k.id === m.kind) ? m.kind : "etc",
            isCommon: Boolean(m.isCommon),
            // 지워진 참가자가 메뉴에 남아 있지 않도록 걸러낸다.
            memberIds: Array.isArray(m.memberIds)
              ? m.memberIds.filter((id) => knownIds.has(id))
              : [],
          }))
      : [];

    const currency = CURRENCY_CODES.includes(saved.currency)
      ? saved.currency
      : fallback.currency;
    const { units, defaultUnit } = CURRENCIES[currency];

    return {
      step: [1, 2, 3, 4].includes(saved.step) ? saved.step : 1,
      participants,
      menus,
      currency,
      roundUnit: units.includes(saved.roundUnit)
        ? saved.roundUnit
        : defaultUnit,
    };
  } catch {
    return fallback;
  }
}

export const state = reactive(loadState());

// 새로고침해도 남도록 바뀔 때마다 브라우저 저장소에 기록한다.
watch(state, () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 저장소가 막혀 있어도 계산은 계속된다 */
  }
});

/* ── 조작 ──────────────────────────────────────── */

export const currency = computed(() => CURRENCIES[state.currency]);
export const roundUnits = computed(() => currency.value.units);

/** 통화를 바꾼다. 환율은 계산하지 않는다 — 적어 넣은 숫자는 그대로 두고 단위만 갈아 끼운다. */
export function setCurrency(code) {
  if (!CURRENCIES[code] || code === state.currency) return;
  const shift = CURRENCIES[code].decimals - CURRENCIES[state.currency].decimals;
  if (shift !== 0) {
    const scale = 10 ** shift;
    state.menus.forEach((m) => {
      m.amount = Math.round(m.amount * scale);
    });
  }
  state.currency = code;
  state.roundUnit = CURRENCIES[code].defaultUnit;
}

export function goToStep(step) {
  state.step = step;
  window.scrollTo({ top: 0, behavior: "instant" });
}

// 실패 사유는 코드로 돌려주고, 문구는 화면에서 언어에 맞게 고른다.
export function addParticipant(name) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (state.participants.some((p) => p.name === trimmed)) {
    return { ok: false, reason: "dup", name: trimmed };
  }
  state.participants.push({ id: newId("p"), name: trimmed });
  return { ok: true };
}

export function removeParticipant(id) {
  state.participants = state.participants.filter((p) => p.id !== id);
  state.menus.forEach((m) => {
    m.memberIds = m.memberIds.filter((mid) => mid !== id);
  });
}

export function addMenu({ name, amount, kind, isCommon }) {
  const menu = {
    id: newId("m"),
    name: name.trim(),
    amount: Math.max(0, Math.round(amount)),
    kind,
    isCommon,
    // 개별 메뉴는 아무도 없는 상태로 시작한다. 배정 단계에서 먹은 사람만 넣는다.
    memberIds: [],
  };
  state.menus.push(menu);
  return menu;
}

export function updateMenu(id, patch) {
  const menu = state.menus.find((m) => m.id === id);
  if (!menu) return;
  Object.assign(menu, patch);
  if (menu.isCommon) menu.memberIds = [];
}

export function removeMenu(id) {
  state.menus = state.menus.filter((m) => m.id !== id);
}

export function toggleMember(menuId, participantId) {
  const menu = state.menus.find((m) => m.id === menuId);
  if (!menu || menu.isCommon) return;
  menu.memberIds = menu.memberIds.includes(participantId)
    ? menu.memberIds.filter((id) => id !== participantId)
    : [...menu.memberIds, participantId];
}

export function setAllMembers(menuId, on) {
  const menu = state.menus.find((m) => m.id === menuId);
  if (!menu || menu.isCommon) return;
  menu.memberIds = on ? state.participants.map((p) => p.id) : [];
}

export function resetAll() {
  Object.assign(state, blankState());
}

/* ── 계산 ──────────────────────────────────────── */

// 총액을 인원수만큼 1원 단위 정수로 쪼갠다. 나머지 1원은 앞사람부터 한 번씩.
function splitEvenly(amount, count) {
  const base = Math.floor(amount / count);
  const remainder = amount - base * count;
  return Array.from(
    { length: count },
    (_, i) => base + (i < remainder ? 1 : 0),
  );
}

function payersOf(menu) {
  if (menu.isCommon) return state.participants.map((p) => p.id);
  const ordered = state.participants.map((p) => p.id);
  return ordered.filter((id) => menu.memberIds.includes(id));
}

export const menusWithoutMembers = computed(() =>
  state.menus.filter((m) => !m.isCommon && payersOf(m).length === 0),
);

export const totalAmount = computed(() =>
  state.menus.reduce((sum, m) => sum + m.amount, 0),
);

export const settlement = computed(() => {
  const byPerson = new Map(
    state.participants.map((p) => [
      p.id,
      { id: p.id, name: p.name, subtotal: 0, items: [] },
    ]),
  );
  let unassignedAmount = 0;

  state.menus.forEach((menu) => {
    const payers = payersOf(menu);
    if (payers.length === 0) {
      unassignedAmount += menu.amount;
      return;
    }
    const shares = splitEvenly(menu.amount, payers.length);
    payers.forEach((pid, i) => {
      const row = byPerson.get(pid);
      if (!row) return;
      row.subtotal += shares[i];
      row.items.push({
        menuId: menu.id,
        name: menu.name,
        kind: menu.kind,
        isCommon: menu.isCommon,
        share: shares[i],
        headcount: payers.length,
      });
    });
  });

  const unit = state.roundUnit;
  const people = [...byPerson.values()].map((row) => ({
    ...row,
    // 걷는 금액의 합이 결제 총액을 넘지 않도록 내림한다. 단위가 1원이면 그대로다.
    payable: Math.floor(row.subtotal / unit) * unit,
  }));

  const billTotal = totalAmount.value;
  const collected = people.reduce((sum, p) => sum + p.payable, 0);
  // 실제로 사람에게 청구되는 금액. 아무도 배정되지 않은 메뉴는 빠진다.
  const charged = billTotal - unassignedAmount;

  return {
    people,
    billTotal,
    charged,
    collected,
    // 내림하고 덜 걷힌 금액. 이만큼은 따로 채워야 한다. 항상 0 이상이다.
    remainder: charged - collected,
    unassignedAmount,
    headcount: state.participants.length,
  };
});

/* ── 금액 표기 ─────────────────────────────────── */

const LOCALE_TAGS = { ko: "ko-KR", ja: "ja-JP", en: "en-US" };

function fraction(decimals) {
  return { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
}

/** 최소 단위 정수를 사람이 읽는 숫자로. 기호는 붙이지 않는다. */
export function num(amount) {
  const { decimals } = currency.value;
  const tag = LOCALE_TAGS[locale.value] ?? "ko-KR";
  return new Intl.NumberFormat(tag, fraction(decimals)).format(
    (amount || 0) / 10 ** decimals,
  );
}

/** 기호까지 붙인 금액. 달러는 앞에, 원·엔은 뒤에 붙는다. */
export function money(amount) {
  const { symbol, prefix } = currency.value;
  return prefix ? symbol + num(amount) : num(amount) + symbol;
}

/** 입력창 문자열 → 최소 단위 정수. '1,234.5' 는 달러에서 123450센트. */
export function parseAmount(text) {
  const { decimals } = currency.value;
  const value = Number(
    String(text)
      .replace(/[^\d.]/g, "")
      .replace(/\.(?=.*\.)/g, ""),
  );
  return Number.isFinite(value) ? Math.round(value * 10 ** decimals) : 0;
}

/** 최소 단위 정수 → 입력창에 넣을 문자열. */
export function amountToText(amount) {
  const { decimals } = currency.value;
  return ((amount || 0) / 10 ** decimals).toLocaleString(
    "en-US",
    fraction(decimals),
  );
}

/** 타이핑을 방해하지 않으면서 세 자리 쉼표만 넣는다. 소수점은 통화가 허용할 때만 남긴다. */
export function normalizeAmountText(text) {
  const { decimals } = currency.value;
  let raw = String(text).replace(/[^\d.]/g, "");
  // 소수점을 안 쓰는 통화는 점 뒤를 버린다. 점을 지워버리면 1600.5 가 16005 로 불어난다.
  if (decimals === 0) raw = raw.split(".")[0];

  const dot = raw.indexOf(".");
  const digits = (dot === -1 ? raw : raw.slice(0, dot))
    .replace(/^0+(?=\d)/, "")
    .slice(0, 12);
  const whole = digits === "" ? "" : Number(digits).toLocaleString("en-US");
  if (dot === -1) return whole;

  const rest = raw
    .slice(dot + 1)
    .replace(/\./g, "")
    .slice(0, decimals);
  return `${whole || "0"}.${rest}`;
}
