export function mapConversation(item) {
  if (!item) return null;
  return { ...item };
}

export function mapMessages(items = []) {
  return items.map((item) => ({ ...item }));
}

export function mapEvents(items = []) {
  return items.map((item) => ({ ...item }));
}
