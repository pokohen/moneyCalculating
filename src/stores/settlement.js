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

export const ASSIGN_VIEWS = ["menu", "person"];

// 처음 열었을 때만 언어로 짐작한다. 그 뒤로는 사용자가 고른 값을 따른다.
const GUESS_BY_LOCALE = { ko: "KRW", ja: "JPY", en: "USD" };

// 화면에 보이는 이름은 언어별로 다르므로 i18n의 step.1 … step.4 를 쓴다.
export const STEPS = [1, 2, 3, 4];

const blankState = () => {
  const code = GUESS_BY_LOCALE[locale.value] ?? "KRW";
  return {
    step: 1,
    participants: [], // { id, name }
    // amount 는 단가다. 줄 합계는 lineTotal() 로 구한다.
    menus: [], // { id, name, amount, qty, isCommon, shares }
    currency: code,
    roundUnit: CURRENCIES[code].defaultUnit,
    // 배정 화면을 메뉴 기준으로 볼지 사람 기준으로 볼지
    assignView: "menu",
  };
};

/* 사람마다 몇 개 가져갔는지. 인원만 고르던 시절의 저장본(memberIds)은 한 사람당 1개로 읽는다. */
function readShares(menu, knownIds) {
  const qty = Number.isFinite(menu.qty) ? Math.max(1, Math.round(menu.qty)) : 1;
  const shares = {};
  const put = (id, n) => {
    if (!knownIds.has(id)) return;
    const units = Math.min(qty, Math.max(1, Math.round(n)));
    if (Number.isFinite(units)) shares[id] = units;
  };

  if (menu.shares && typeof menu.shares === "object") {
    Object.entries(menu.shares).forEach(([id, n]) => {
      if (Number.isFinite(n) && n > 0) put(id, n);
    });
  } else if (Array.isArray(menu.memberIds)) {
    menu.memberIds.forEach((id) => put(id, 1));
  }
  return shares;
}

/** 수량이 줄면 그보다 많이 가져간 사람의 개수도 따라 줄인다. */
function clampShares(menu) {
  Object.keys(menu.shares).forEach((id) => {
    menu.shares[id] = Math.min(menu.shares[id], menu.qty);
  });
}

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
            // 수량이 없던 시절에 저장된 계산서는 1개로 읽는다. 그러면 줄 합계가 그대로다.
            qty: Number.isFinite(m.qty) ? Math.max(1, Math.round(m.qty)) : 1,
            isCommon: Boolean(m.isCommon),
            shares: readShares(m, knownIds),
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
      assignView: ASSIGN_VIEWS.includes(saved.assignView)
        ? saved.assignView
        : "menu",
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
    delete m.shares[id];
  });
}

export function addMenu({ name, amount, qty, isCommon }) {
  const menu = {
    id: newId("m"),
    name: name.trim(),
    amount: Math.max(0, Math.round(amount)),
    qty: Math.max(1, Math.round(qty ?? 1)),
    isCommon,
    // 개별 메뉴는 아무도 없는 상태로 시작한다. 배정 단계에서 먹은 만큼 담는다.
    shares: {},
  };
  state.menus.push(menu);
  return menu;
}

export function updateMenu(id, patch) {
  const menu = state.menus.find((m) => m.id === id);
  if (!menu) return;
  Object.assign(menu, patch);
  if (menu.isCommon) menu.shares = {};
  clampShares(menu);
}

export function removeMenu(id) {
  state.menus = state.menus.filter((m) => m.id !== id);
}

/** 한 줄에 실제로 붙는 금액. 단가 × 수량. */
export function lineTotal(menu) {
  return menu.amount * menu.qty;
}

/** 목록에서 바로 수량을 올리고 내린다. 1개 아래로는 내려가지 않는다. */
export function bumpQty(id, delta) {
  const menu = state.menus.find((m) => m.id === id);
  if (!menu) return;
  menu.qty = Math.max(1, menu.qty + delta);
  clampShares(menu);
}

/** 이 사람이 이 메뉴를 몇 개 가져갔는지. */
export function shareOf(menu, participantId) {
  return menu.shares[participantId] ?? 0;
}

/** 한 줄에 배정된 개수의 합. 0이면 아직 아무도 안 가져간 메뉴다. */
export function unitsOf(menu) {
  return Object.values(menu.shares).reduce((sum, n) => sum + n, 0);
}

/** 눌러서 개수를 하나씩 올린다. 수량만큼 채우면 0으로 돌아간다.
    수량이 1인 메뉴에서는 지금까지처럼 켜고 끄는 동작이 된다. */
export function cycleShare(menuId, participantId) {
  const menu = state.menus.find((m) => m.id === menuId);
  if (!menu || menu.isCommon) return;
  const next = (shareOf(menu, participantId) + 1) % (menu.qty + 1);
  if (next === 0) delete menu.shares[participantId];
  else menu.shares[participantId] = next;
}

/** 그 사람이 이 메뉴에서 가져간 걸 전부 비운다. */
export function clearShare(menuId, participantId) {
  const menu = state.menus.find((m) => m.id === menuId);
  if (menu) delete menu.shares[participantId];
}

/** 참가자 한 명이 가져간 개별 메뉴를 전부 비운다. */
export function clearPerson(participantId) {
  state.menus.forEach((m) => {
    if (!m.isCommon) delete m.shares[participantId];
  });
}

export function setAllMembers(menuId, on) {
  const menu = state.menus.find((m) => m.id === menuId);
  if (!menu || menu.isCommon) return;
  menu.shares = on
    ? Object.fromEntries(state.participants.map((p) => [p.id, 1]))
    : {};
}

export function resetAll() {
  Object.assign(state, blankState());
}

/* ── 계산 ──────────────────────────────────────── */

/* 총액을 가져간 개수에 비례해 1원 단위 정수로 쪼갠다.
   남는 1원은 소수부가 큰 사람부터 한 번씩 — 최대 나머지 방식이라 합이 총액과 정확히 맞는다.
   모두 1개씩이면 예전의 균등 1/n 과 결과가 같다. */
function splitByUnits(amount, units) {
  const total = units.reduce((sum, n) => sum + n, 0);
  const exact = units.map((n) => (amount * n) / total);
  const shares = exact.map(Math.floor);
  let remainder = amount - shares.reduce((sum, n) => sum + n, 0);

  const order = exact
    .map((value, i) => ({ i, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < remainder; k += 1) shares[order[k].i] += 1;
  return shares;
}

/** 이 줄을 나눠 낼 사람과 각자의 개수. 참가자 입력 순서를 따른다. */
function payersOf(menu) {
  if (menu.isCommon) {
    return state.participants.map((p) => ({ id: p.id, units: 1 }));
  }
  return state.participants
    .map((p) => ({ id: p.id, units: shareOf(menu, p.id) }))
    .filter((row) => row.units > 0);
}

export const menusWithoutMembers = computed(() =>
  state.menus.filter((m) => !m.isCommon && unitsOf(m) === 0),
);

export const totalAmount = computed(() =>
  state.menus.reduce((sum, m) => sum + lineTotal(m), 0),
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
      unassignedAmount += lineTotal(menu);
      return;
    }
    const totalUnits = payers.reduce((sum, row) => sum + row.units, 0);
    const shares = splitByUnits(
      lineTotal(menu),
      payers.map((row) => row.units),
    );
    payers.forEach((payer, i) => {
      const row = byPerson.get(payer.id);
      if (!row) return;
      row.subtotal += shares[i];
      row.items.push({
        menuId: menu.id,
        name: menu.name,
        qty: menu.qty,
        isCommon: menu.isCommon,
        share: shares[i],
        units: payer.units,
        totalUnits,
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
