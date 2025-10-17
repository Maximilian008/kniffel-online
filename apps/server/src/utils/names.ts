export function normaliseName(value: string): string {
    return value.trim().replace(/\s+/g, " ").slice(0, 40);
}

export function normalizeNameKey(value: string): string {
    return normaliseName(value).toLowerCase();
}
