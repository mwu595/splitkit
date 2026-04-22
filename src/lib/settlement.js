/**
 * Pure functions — no DB, no React dependencies.
 *
 * Data shapes expected (camelCase, already mapped from Supabase snake_case):
 *   member:      { id, name }
 *   transaction: { id, amount, paidBy, splitBetween: string[], isSettlement }
 */

/**
 * Compute net balance per member.
 * Positive  = owed money (paid more than their share).
 * Negative  = owes money (paid less than their share).
 *
 * @param {Array} members
 * @param {Array} transactions
 * @returns {Array} [{ id, name, balance }]
 */
export function computeBalances(members, transactions) {
  const bal = {};
  members.forEach(m => { bal[m.id] = 0; });

  transactions.forEach(tx => {
    const usdAmt    = tx.amountUsd ?? tx.amount;
    const perPerson = usdAmt / tx.splitBetween.length;
    tx.splitBetween.forEach(id => {
      bal[id] = (bal[id] ?? 0) - perPerson;
    });
    bal[tx.paidBy] = (bal[tx.paidBy] ?? 0) + usdAmt;
  });

  return members.map(m => ({
    ...m,
    balance: Math.round((bal[m.id] ?? 0) * 100) / 100,
  }));
}

/**
 * Greedy debt-minimization algorithm.
 * Returns the minimum number of transfers to settle all balances.
 *
 * @param {Array} members
 * @param {Array} transactions
 * @returns {Array} [{ from, fromName, to, toName, amount }]
 */
export function minimizeTransactions(members, transactions) {
  const balances = computeBalances(members, transactions);

  const creditors = []; // owed money (balance > 0)
  const debtors   = []; // owe money  (balance < 0)

  balances.forEach(b => {
    if (b.balance >  0.005) creditors.push({ id: b.id, name: b.name, amount:  b.balance });
    if (b.balance < -0.005) debtors  .push({ id: b.id, name: b.name, amount: -b.balance });
  });

  // Sort largest first so we minimise iteration rounds
  creditors.sort((a, b) => b.amount - a.amount);
  debtors  .sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const settle = Math.min(creditors[ci].amount, debtors[di].amount);

    transfers.push({
      from:     debtors[di].id,
      fromName: debtors[di].name,
      to:       creditors[ci].id,
      toName:   creditors[ci].name,
      amount:   Math.round(settle * 100) / 100,
    });

    creditors[ci].amount -= settle;
    debtors[di].amount   -= settle;

    if (creditors[ci].amount < 0.005) ci++;
    if (debtors[di].amount   < 0.005) di++;
  }

  return transfers;
}

/** Format a number as USD currency string. */
export function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
