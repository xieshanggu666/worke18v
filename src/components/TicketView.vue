<script setup>
import { ref, computed } from 'vue'
import { useParkStore } from '@/store/park'

const store = useParkStore()
const ticket = ref(120)
const loanAmt = ref(50000)
const loanPeriods = ref(14)
const loanRate = ref(0.01)

const loanOptions = computed(() => store.data?.loanOptions || { periods: [7, 14, 30], rates: [0.006, 0.01, 0.015] })

// 每期应还 = 当期本金 + 当期利息（与后端结算模型一致）
const perPrincipal = computed(() => Math.round(loanAmt.value / loanPeriods.value))
const perInterest = computed(() => Math.round(loanAmt.value * loanRate.value))
const totalInterest = computed(() => perInterest.value * loanPeriods.value)

const LOAN_STATUS = {
  active: { text: '还款中', cls: 'ok' },
  overdue: { text: '已逾期', cls: 'bad' },
  repaid: { text: '已结清', cls: 'done' }
}
const stOf = s => LOAN_STATUS[s] || LOAN_STATUS.active

function applyLoan() {
  store.takeLoan({ amount: loanAmt.value, periods: loanPeriods.value, rate: loanRate.value })
}

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
          <div><em>待还债务</em><b class="money neg">¥{{ store.data?.loan?.toLocaleString() ?? 0 }}</b></div>
        </div>
        <div class="loan">
          <label class="muted">申请分期借款金额</label>
          <input type="number" v-model.number="loanAmt" min="10000" step="10000" />
          <div class="opt-row">
            <em class="muted">期数（每天日结还 1 期）</em>
            <div class="seg">
              <button v-for="p in loanOptions.periods" :key="p" :class="{ on: loanPeriods === p }" @click="loanPeriods = p">{{ p }} 期</button>
            </div>
          </div>
          <div class="opt-row">
            <em class="muted">每期利率</em>
            <div class="seg">
              <button v-for="r in loanOptions.rates" :key="r" :class="{ on: loanRate === r }" @click="loanRate = r">{{ (r * 100).toFixed(1) }}%</button>
            </div>
          </div>
        </div>
        <div class="kv-grid">
          <div><em>每期应还</em><b class="money">¥{{ (perPrincipal + perInterest).toLocaleString() }}</b></div>
          <div><em>总利息</em><b class="money neg">¥{{ totalInterest.toLocaleString() }}</b></div>
        </div>
        <button class="succ" @click="applyLoan">申请借款 ¥{{ loanAmt.toLocaleString() }}</button>
        <div class="muted tip">每日日结自动从现金扣款（先息后本）。现金不足时将记为逾期，未还部分转入后续日结继续追缴，且逾期会损害声誉。</div>

        <div class="loan-list" v-if="store.loans.length">
          <h4>📋 借款记录</h4>
          <div class="loan-item" v-for="l in store.loans" :key="l.id">
            <div class="li-head">
              <b>#{{ l.id }} <em class="muted">¥{{ l.principal.toLocaleString() }} · {{ l.periods }}期 · {{ (l.rate * 100).toFixed(1) }}%</em></b>
              <span class="chip" :class="stOf(l.status).cls">{{ stOf(l.status).text }}</span>
            </div>
            <div class="li-body">
              <span>剩余本金 <b class="money">¥{{ l.balance.toLocaleString() }}</b></span>
              <span>已还 {{ l.paid_periods }}/{{ l.periods }} 期</span>
              <span v-if="l.arrears > 0" class="bad">逾期利息 ¥{{ l.arrears.toLocaleString() }}</span>
            </div>
            <div class="bar"><i :style="{ width: Math.min(100, l.paid_periods / l.periods * 100) + '%' }"></i></div>
          </div>
        </div>

        <h3 style="margin-top:20px">💡 经营建议</h3>
        <ul class="tips">
          <li v-if="+store.ticket > 200">票价已处于高位，留意入园量下降。</li>
          <li v-if="(store.data?.avgs?.satisfaction ?? 0) < 55">满意度偏低：及时检修设施、增聘保洁。</li>
          <li v-if="store.loans.some(l => l.status === 'overdue')">有贷款逾期未还，尽快补充现金以免声誉持续受损。</li>
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
.opt-row { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.opt-row em { font-style: normal; font-size: 12px; }
.seg { display: flex; gap: 8px; }
.seg button { flex: 1; margin-top: 0 !important; padding: 7px 0; border: 1px solid var(--border); background: var(--panel2); color: var(--text); border-radius: 8px; cursor: pointer; }
.seg button.on { border-color: var(--accent2); color: var(--accent2); font-weight: 700; }
.loan-list { margin-top: 18px; }
.loan-list h4 { margin: 0 0 10px; }
.loan-item { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
.li-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.li-head em { font-style: normal; font-size: 12px; font-weight: 400; }
.li-body { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin: 8px 0; }
.li-body .bad { color: var(--red); }
.chip { font-size: 12px; padding: 2px 10px; border-radius: 999px; white-space: nowrap; }
.chip.ok { background: rgba(109,213,160,.15); color: var(--green); }
.chip.bad { background: rgba(255,107,107,.15); color: var(--red); }
.chip.done { background: rgba(255,255,255,.08); color: var(--muted); }
.loan-item .bar { height: 6px; background: var(--panel2); border-radius: 4px; overflow: hidden; }
.loan-item .bar i { display: block; height: 100%; background: var(--accent2); border-radius: 4px; }
.tips { list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.tips li::before { content: '•'; color: var(--accent2); margin-right: 6px; }
</style>