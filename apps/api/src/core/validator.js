import { ValidationError } from './errors.js';

function getType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

export function validatePayload(payload, schema, { domain = 'core-platform' } = {}) {
  const errors = [];
  const input = payload && typeof payload === 'object' ? payload : {};
  const output = { ...input };

  for (const [field, rules] of Object.entries(schema || {})) {
    const value = input[field];
    const exists = value !== undefined && value !== null;

    if (rules.required && !exists) {
      errors.push({ field, message: 'Campo obrigatorio', rule: 'required' });
      continue;
    }

    if (!exists) continue;

    if (rules.type) {
      const actualType = getType(value);
      if (actualType !== rules.type) {
        errors.push({ field, message: `Tipo invalido: esperado ${rules.type}`, rule: 'type' });
        continue;
      }
    }

    if (rules.type === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push({ field, message: `Tamanho minimo ${rules.minLength}`, rule: 'minLength' });
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push({ field, message: `Tamanho maximo ${rules.maxLength}`, rule: 'maxLength' });
      }
    }

    if (rules.allowed && !rules.allowed.includes(value)) {
      errors.push({ field, message: 'Valor nao permitido', rule: 'allowed' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Payload invalido', {
      details: errors,
      domain
    });
  }

  return output;
}
