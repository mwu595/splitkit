/**
 * All Supabase read/write operations.
 * Components never import supabase directly — they use these helpers.
 *
 * All returned objects use camelCase (mapped from Supabase snake_case).
 */
import { supabase } from './supabase.js';

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function mapMember(row) {
  if (!row) return null;
  return {
    id:         row.id,
    projectCode: row.project_code,
    name:       row.name,
    deviceIds:  row.device_ids ?? [],
    joinedAt:   row.joined_at,
  };
}

function mapTransaction(row) {
  if (!row) return null;
  const amount = parseFloat(row.amount);
  return {
    id:           row.id,
    projectCode:  row.project_code,
    description:  row.description,
    amount,
    date:         row.date,
    category:     row.category,
    paidBy:       row.paid_by,
    splitBetween: row.split_between ?? [],
    isSettlement: row.is_settlement ?? false,
    currencyCode: row.currency_code ?? 'USD',
    amountUsd:    row.amount_usd != null ? parseFloat(row.amount_usd) : amount,
    createdAt:    row.created_at,
  };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(code, name) {
  const { error } = await supabase
    .from('projects')
    .insert({ code, name });
  if (error) throw error;
}

export async function getProject(code) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data; // { code, name, created_at } or null
}

// ─── Code generation ──────────────────────────────────────────────────────────

function randomCode() {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
}

export async function generateUniqueCode() {
  let code;
  let attempts = 0;
  do {
    if (++attempts > 20) throw new Error('Could not generate unique code');
    code = randomCode();
    const existing = await getProject(code);
    if (!existing) break;
  } while (true); // eslint-disable-line no-constant-condition
  return code;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getMembers(code) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('project_code', code)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMember);
}

export async function createMember(code, name, deviceId) {
  const { data, error } = await supabase
    .from('members')
    .insert({ project_code: code, name, device_ids: [deviceId] })
    .select()
    .single();
  if (error) throw error;
  return mapMember(data);
}

export async function appendDeviceToMember(memberId, deviceId) {
  const { error } = await supabase.rpc('append_device_id', {
    member_id: memberId,
    device_id: deviceId,
  });
  if (error) throw error;
}

export async function updateMemberName(memberId, name) {
  const { error } = await supabase
    .from('members')
    .update({ name })
    .eq('id', memberId);
  if (error) throw error;
}

export async function leaveProject(memberId, deviceId) {
  const { error } = await supabase.rpc('remove_device_id', {
    member_id: memberId,
    device_id: deviceId,
  });
  if (error) throw error;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(code) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('project_code', code)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTransaction);
}

export async function addTransaction(code, tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      project_code:   code,
      description:    tx.description,
      amount:         tx.amount,
      date:           tx.date,
      category:       tx.category,
      paid_by:        tx.paidBy,
      split_between:  tx.splitBetween,
      is_settlement:  tx.isSettlement ?? false,
      currency_code:  tx.currencyCode ?? 'USD',
      amount_usd:     tx.amountUsd ?? tx.amount,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTransaction(data);
}

export async function updateTransaction(txId, updates) {
  const payload = {};
  if (updates.description  !== undefined) payload.description   = updates.description;
  if (updates.amount       !== undefined) payload.amount        = updates.amount;
  if (updates.date         !== undefined) payload.date          = updates.date;
  if (updates.category     !== undefined) payload.category      = updates.category;
  if (updates.paidBy       !== undefined) payload.paid_by       = updates.paidBy;
  if (updates.splitBetween !== undefined) payload.split_between = updates.splitBetween;
  if (updates.currencyCode !== undefined) payload.currency_code = updates.currencyCode;
  if (updates.amountUsd    !== undefined) payload.amount_usd    = updates.amountUsd;

  const { error } = await supabase
    .from('transactions')
    .update(payload)
    .eq('id', txId);
  if (error) throw error;
}

export async function deleteTransaction(txId) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', txId);
  if (error) throw error;
}

export async function addSettlement(code, from, to, amount, fromName, toName) {
  return addTransaction(code, {
    description:  `${fromName} paid ${toName}`,
    amount,
    date:         new Date().toISOString().slice(0, 10),
    category:     'Settlement',
    paidBy:       from,
    splitBetween: [to],
    isSettlement: true,
  });
}
