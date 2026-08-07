<script setup>
import { nextTick, ref } from 'vue'
import { addParticipant, removeParticipant, state } from '../stores/settlement'

const name = ref('')
const error = ref('')
const input = ref(null)

function submit() {
  const result = addParticipant(name.value)
  if (!result.ok) {
    error.value = result.message
    return
  }
  error.value = ''
  name.value = ''
  // 연달아 입력하는 경우가 많아서 포커스를 유지한다.
  nextTick(() => input.value?.focus())
}
</script>

<template>
  <div>
    <p class="lede">오늘 자리에 있는 사람을 모두 넣으세요. 이 명단으로 공통 메뉴를 1/n 합니다.</p>

    <form class="adder" @submit.prevent="submit">
      <input
        ref="input"
        v-model="name"
        class="input"
        type="text"
        placeholder="이름 (예: 홍길동)"
        autocomplete="off"
        enterkeyhint="done"
        maxlength="12"
        aria-label="참가자 이름"
        @input="error = ''"
      />
      <button class="btn" type="submit" :disabled="!name.trim()">추가</button>
    </form>
    <p v-if="error" class="err">{{ error }}</p>

    <div class="roster">
      <div class="section-title">
        <span>참석자</span>
        <span class="count num">{{ state.participants.length }}명</span>
      </div>

      <p v-if="!state.participants.length" class="empty">
        아직 아무도 없어요.<br />위에 이름을 적고 추가하세요.
      </p>

      <ul v-else class="chips">
        <li v-for="p in state.participants" :key="p.id">
          <span class="chip is-listed">
            {{ p.name }}
            <button
              class="chip-x"
              type="button"
              :aria-label="`${p.name} 빼기`"
              @click="removeParticipant(p.id)"
            >
              ×
            </button>
          </span>
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

.adder {
  display: flex;
  gap: 0.5rem;
}

.adder .input {
  flex: 1;
}

.err {
  margin-top: 0.5rem;
  color: var(--stamp);
  font-size: 0.84rem;
  font-weight: 600;
}

.roster {
  margin-top: 1.6rem;
}

.count {
  margin-left: auto;
  color: var(--ink-3);
  font-weight: 600;
  letter-spacing: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.chip.is-listed {
  padding-right: 0.35rem;
  border-color: var(--ink);
  background: var(--ink);
  color: var(--paper);
}

.chip-x {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.16);
  color: inherit;
  font-size: 1rem;
  line-height: 1;
}
</style>
