const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const buildLoanMath = ({
  amount,
  interestRate = 9,
  serviceFeePct = 12,
  administrationFeePct = 12,
  commitmentFeePct = 12,
  upfrontDeductionPct = 20,
  overdueFeePct = 2,
}) => {
  const principal = roundMoney(amount);
  const rates = {
    interestRate: Number(interestRate || 0),
    serviceFeePct: Number(serviceFeePct || 0),
    administrationFeePct: Number(administrationFeePct || 0),
    commitmentFeePct: Number(commitmentFeePct || 0),
    upfrontDeductionPct: Number(upfrontDeductionPct || 0),
    overdueFeePct: Number(overdueFeePct || 0),
  };

  const totalInterest = roundMoney((principal * rates.interestRate) / 100);
  const serviceFee = roundMoney((principal * rates.serviceFeePct) / 100);
  const administrationFee = roundMoney(
    (principal * rates.administrationFeePct) / 100,
  );
  const commitmentFee = roundMoney((principal * rates.commitmentFeePct) / 100);
  const totalFees = roundMoney(
    totalInterest + serviceFee + administrationFee + commitmentFee,
  );

  const upfrontFee = roundMoney(
    (principal * rates.upfrontDeductionPct) / 100,
  );
  const amountReceived = roundMoney(principal - upfrontFee);
  const totalAmount = roundMoney(principal + totalFees);
  const repaymentAmount = roundMoney(totalAmount - upfrontFee);
  const dailyOverdueFeeOnRepayment = roundMoney(
    (repaymentAmount * rates.overdueFeePct) / 100,
  );

  return {
    principal,
    rates,
    totalInterest,
    serviceFee,
    administrationFee,
    commitmentFee,
    totalFees,
    upfrontFee,
    amountReceived,
    totalAmount,
    repaymentAmount,
    remainingBalanceAtDisbursement: repaymentAmount,
    dailyOverdueFeeOnRepayment,
  };
};

module.exports = {
  buildLoanMath,
  roundMoney,
};
