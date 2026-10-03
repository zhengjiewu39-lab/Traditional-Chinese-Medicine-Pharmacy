/** Shared display/form adapter for structured clinical facts. */

export function factStatus(fact) {
  if (!fact || typeof fact !== 'object') return 'unknown';
  return fact.status || 'unknown';
}

export function factNames(fact, items = []) {
  if (factStatus(fact) !== 'reported') return [];
  if (items.length) return items.filter((i) => i.status === 'reported' || i.itemStatus === 'active').map((i) => i.name).filter(Boolean);
  if (Array.isArray(fact.value)) return fact.value.map(String);
  if (fact.value != null && fact.value !== '') return [String(fact.value)];
  return [];
}

export function displayFact(fact, items, labels) {
  const st = factStatus(fact);
  if (st === 'none') return { status: st, text: labels.none, isNone: true };
  if (st === 'not_asked') return { status: st, text: labels.notAsked, isNone: false };
  if (st === 'unknown' || st === 'not_applicable') return { status: st, text: labels.unknown, isNone: false };
  const names = factNames(fact, items);
  return { status: 'reported', text: names.join('、') || String(fact.value ?? ''), isNone: false, names };
}

export function triFromFact(fact) {
  const st = factStatus(fact);
  if (st === 'reported' && (fact.value === 'yes' || fact.value === true)) return 'yes';
  if (st === 'none' || fact?.value === 'no') return 'no';
  return 'unknown';
}

export function scalarFromFact(fact) {
  if (factStatus(fact) !== 'reported' || fact.value == null) return null;
  return fact.value;
}
