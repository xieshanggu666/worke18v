// 分期借款模型（纯逻辑，不依赖数据库，便于独立测试）
// 等额分期：每期应还 = 当期本金 + 当期利息
//   本金 = 剩余本金按剩余期数均摊（末期/逾期后结清全部剩余本金）
//   利息 = 原始本金 × 每期利率（固定利息）
// 日结扣款先息后本；现金不足时部分扣款，未还利息计入逾期(arrears)，
// 贷款状态转为 overdue，后续日结继续追缴直至结清(repaid)。

export const LOAN_PERIODS = [7, 14, 30]         // 可选期数(天)
export const LOAN_RATES = [0.006, 0.01, 0.015]  // 可选每期(日)利率
export const LOAN_MIN = 10000
export const LOAN_MAX = 500000

export function validateLoanOpts(amount, periods, rate) {
  if (!Number.isFinite(amount) || amount < LOAN_MIN || amount > LOAN_MAX)
    return `借款金额需在 ${LOAN_MIN.toLocaleString()} ~ ${LOAN_MAX.toLocaleString()} 之间`
  if (!LOAN_PERIODS.includes(periods)) return '非法期数'
  if (!LOAN_RATES.some(r => Math.abs(r - rate) < 1e-9)) return '非法利率'
  return null
}

// 每期应还明细（前端预览用）
export function schedule(principal, periods, rate) {
  const pri = Math.round(principal / periods)
  const interest = Math.round(principal * rate)
  return { principal: pri, interest, payment: pri + interest, totalInterest: interest * periods }
}

/**
 * 单日(期)结算一笔贷款
 * @param loan  数据库贷款行 { principal, rate, periods, paid_periods, balance, arrears, status }
 * @param cash  当前可用现金
 * @returns { cash, intPay, priPay, periodNo, newlyOverdue, loan }
 *   cash 为扣款后现金；intPay/priPay 为实际扣的利息/本金；loan 为更新后的贷款行
 */
export function settleLoan(loan, cash) {
  const periodsLeft = loan.periods - loan.paid_periods
  // 本金：剩余期数均摊；最后一期(或期数已用尽仍有欠款)结清全部剩余本金
  const priPart = periodsLeft > 1 ? Math.round(loan.balance / periodsLeft) : loan.balance
  const intPart = periodsLeft > 0 ? Math.round(loan.principal * loan.rate) : 0
  const intDue = intPart + loan.arrears           // 当期利息 + 逾期未还利息
  const due = priPart + intDue

  const pay = Math.max(0, Math.min(cash, due))    // 现金不足时只能部分扣款(不扣成负数)
  const intPay = Math.min(pay, intDue)            // 先息后本
  const priPay = pay - intPay

  const arrears = intDue - intPay                 // 未还利息转入逾期，后续日结继续追缴
  const balance = loan.balance - priPay
  const paid_periods = loan.paid_periods + (periodsLeft > 0 ? 1 : 0)

  const done = balance <= 0 && arrears <= 0
  const short = pay < due                         // 未足额扣款 = 现金不足
  const status = done ? 'repaid' : (short || arrears > 0) ? 'overdue' : 'active'

  return {
    cash: cash - pay,
    intPay,
    priPay,
    periodNo: periodsLeft > 0 ? loan.paid_periods + 1 : loan.periods,
    newlyOverdue: status === 'overdue' && loan.status !== 'overdue',
    loan: { ...loan, balance, arrears, paid_periods, status }
  }
}
