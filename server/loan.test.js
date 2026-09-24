// 分期借款结算逻辑测试（node server/loan.test.js）
import { settleLoan, schedule, validateLoanOpts, LOAN_PERIODS, LOAN_RATES } from './loan.js'

let failed = 0
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ok  ${msg}`)
  else { failed++; console.error(`FAIL  ${msg}\n      expected ${e}, got ${a}`) }
}

const mkLoan = (over = {}) => ({
  id: 1, principal: 70000, rate: 0.01, periods: 7,
  paid_periods: 0, balance: 70000, arrears: 0, status: 'active', ...over
})

console.log('— 参数校验 —')
eq(validateLoanOpts(50000, 7, 0.01), null, '合法参数通过')
eq(validateLoanOpts(5000, 7, 0.01) !== null, true, '金额过低被拒')
eq(validateLoanOpts(50000, 5, 0.01) !== null, true, '非法期数被拒')
eq(validateLoanOpts(50000, 7, 0.03) !== null, true, '非法利率被拒')
eq(LOAN_PERIODS.length > 0 && LOAN_RATES.length > 0, true, '可选期数与利率非空')

console.log('— 还款计划预览 —')
eq(schedule(70000, 7, 0.01), { principal: 10000, interest: 700, payment: 10700, totalInterest: 4900 }, '7万/7期/1% 计划')

console.log('— 场景1：现金充足，按期结清 —')
{
  let loan = mkLoan(), cash = 1_000_000, totalInt = 0, totalPri = 0
  for (let d = 1; d <= 7; d++) {
    const r = settleLoan(loan, cash)
    cash = r.cash; loan = r.loan
    totalInt += r.intPay; totalPri += r.priPay
    eq(r.intPay, 700, `第${d}期利息 700`)
    eq(r.priPay, 10000, `第${d}期本金 10000`)
    eq(loan.paid_periods, d, `第${d}期已还期数`)
    eq(loan.status, d < 7 ? 'active' : 'repaid', `第${d}期状态`)
  }
  eq(loan.balance, 0, '本金结清')
  eq([totalPri, totalInt], [70000, 4900], '累计本金/利息与计划一致')
  eq(cash, 1_000_000 - 74900, '现金同步扣减')
}

console.log('— 场景2：现金不足 → 逾期 → 后续结算追缴 —')
{
  let loan = mkLoan()
  // 第1期：现金只够利息
  let r = settleLoan(loan, 500)
  eq([r.intPay, r.priPay], [500, 0], '部分扣款先息后本')
  eq([r.loan.arrears, r.loan.balance], [200, 70000], '未还利息计入逾期，本金余额不变')
  eq(r.loan.status, 'overdue', '状态转逾期')
  eq(r.newlyOverdue, true, '标记新增逾期')
  loan = r.loan
  // 第2期：现金恢复，追缴逾期利息 + 当期本息
  r = settleLoan(loan, 100000)
  eq(r.intPay, 200 + 700, '第2期追缴逾期利息+当期利息')
  eq(r.loan.arrears, 0, '逾期清零')
  eq(r.loan.status, 'active', '恢复正常')
  eq(r.newlyOverdue, false, '不重复标记逾期')
  loan = r.loan
  // 第3期：现金为 0，全部转入逾期
  r = settleLoan(loan, 0)
  eq([r.intPay, r.priPay], [0, 0], '现金为0不扣款')
  eq(r.loan.arrears, 700, '当期利息转入逾期')
  eq(r.loan.status, 'overdue', '再次逾期')
  loan = r.loan
  // 后续按期还清
  let guard = 0
  while (loan.status !== 'repaid' && guard++ < 20) {
    r = settleLoan(loan, 100000)
    loan = r.loan
  }
  eq(loan.status, 'repaid', '后续结算最终结清')
  eq(loan.balance <= 0 && loan.arrears <= 0, true, '余额与逾期均清零')
}

console.log('— 场景3：期数用尽仍有欠款，继续按日追缴 —')
{
  // 本金一直还不上，7期过后 balance 仍有剩余
  let loan = mkLoan()
  let r
  for (let d = 1; d <= 7; d++) { r = settleLoan(loan, 700); loan = r.loan } // 每天只够利息
  eq(loan.paid_periods, 7, '7期已耗尽')
  eq(loan.balance, 70000, '本金分文未还')
  eq(loan.status, 'overdue', '期数尽仍欠款 → 逾期')
  r = settleLoan(loan, 100000)  // 期数外第8天：一次性结清全部剩余本金
  eq(r.priPay, 70000, '期外追缴全部剩余本金')
  eq(r.intPay, 0, '期外不再计息')
  eq(r.loan.status, 'repaid', '结清')
  eq(r.loan.paid_periods, 7, '期数不再增加')
}

console.log('— 场景4：多笔贷款互不影响（单笔函数幂等性抽查） —')
{
  const a = settleLoan(mkLoan({ id: 1 }), 50000)
  const b = settleLoan(mkLoan({ id: 2, principal: 30000, balance: 30000, periods: 30, rate: 0.006 }), 50000)
  eq(a.priPay, 10000, '贷款A第1期本金')
  eq([b.priPay, b.intPay], [1000, 180], '贷款B第1期本息')
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过 ✅')
process.exit(failed ? 1 : 0)
