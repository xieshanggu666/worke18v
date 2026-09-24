<script setup>
import { ref, computed } from 'vue'
import { useParkStore } from '@/store/park'

const store = useParkStore()
const ticket = ref(120)
const loanAmt = ref(50000)

const entrants = computed(() => {
  const p = +store.ticket
  const base = store.data?.guestBase ?? 600
  const rep = store.data?.reputation ?? 70
  const priceFactor = Math.max(0.2, 2.0 - p / 100)
  return Math.round(base * priceFactor * (0.4 + rep / 100) * 0.85)
})

const revenue = computed(() => entrants.value * (+store.ticket) + entrants.value * 30)
</script>

<template>
  <div class="ticket">
    <div class="twocol">
      <div class="card econ">
        <h3>🎫 门票定价策略</h3>
        <div class="label muted">当前票价：<b class="money" style="font-size:28px">¥{{ store.ticket }}</b></div>
        <input type="range" min="10" max="500" step="5" v-model.number="ticket" style="width:100%" />
        <div class="scale"><span>¥10 亲民</span><span>¥500 高端</span></div>
        <div class="kv-grid">
          <div><em>预期入园/时</em><b>{{ entrants }}</b></div>
          <div><em>预期营收/时</em><b class="money">≈¥{{ revenue.toLocaleString() }}</b></div>
        </div>
        <div class="muted tip">提示：票价升高会减少入园量，但可提升单客收入，需平衡满意流失客。声誉降低时游客对价格更敏感。</div>
        <button class="primary" @click="store.setTicket(ticket)">应用票价 ¥{{ ticket }}</button>
      </div>

      <div class="card bank">
        <h3>🏦 园区财务</h3>
        <div class="kv-grid">
          <div><em>可用现金</em><b class="money">¥{{ store.data?.cash?.toLocaleString() ?? 0 }}</b></div>
          <div><em>当前贷款</em><b class="money neg">¥{{ store.data?.loan?.toLocaleString() ?? 0 }}</b></div>
        </div>
        <div class="loan">
          <label class="muted">申请贷款金额</label>
          <input type="number" v-model.number="loanAmt" min="10000" />
        </div>
        <button class="succ" @click="store.takeLoan(loanAmt)">申请贷款 ¥{{ loanAmt.toLocaleString() }}</button>
        <div class="muted tip">用于快速扩建园区，贷款无需偿还利息（演示），但会影响声誉评估。</div>

        <h3 style="margin-top:20px">💡 经营建议</h3>
        <ul class="tips">
          <li v-if="+store.ticket > 200">票价已处于高位，留意入园量下降。</li>
          <li v-if="(store.data?.avgs?.satisfaction ?? 0) < 55">满意度偏低：及时检修设施、增聘保洁。</li>
          <li v-if="store.zones.some(z=>!z.unlocked)">有未开放区域，可贷款扩建吸引更多客流。</li>
          <li v-else>所有区域已开放，聚焦提升单客消费与满意度。</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ticket { }
.twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .twocol { grid-template-columns: 1fr; } }
.label { margin-bottom: 10px; }
.label b { color: var(--accent2); }
.scale { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; margin-top: 4px; }
.kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 16px 0; }
.kv-grid div { background: var(--panel2); border-radius: 10px; padding: 12px; text-align: center; }
.kv-grid em { display: block; font-style: normal; font-size: 12px; color: var(--muted); }
.kv-grid b { font-size: 22px; }
.tip { font-size: 12px; margin: 12px 0; line-height: 1.6; }
.bank button { width: 100%; margin-top: 10px; }
.loan { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.tips { list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.tips li::before { content: '•'; color: var(--accent2); margin-right: 6px; }
</style>