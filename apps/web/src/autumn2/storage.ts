const A2_PREFIX = "a2:";

function a2Key(key: string) {
    return `${A2_PREFIX}${key}`;
}

type Mapping = {
    old: string;
    nu: string;
};

const LEGACY_MAPPINGS: Mapping[] = [
    { old: "yahtzee.lastRoomId", nu: a2Key("lastRoomId") },
    { old: "yahtzee.playerCount", nu: a2Key("playerCount") },
    { old: "yahtzee.displayName", nu: a2Key("displayName") },
    { old: "yahtzee.playerId", nu: a2Key("playerId") },
];

let migrationPerformed = false;

function migrateLegacyKey(oldKey: string, newKey: string) {
    if (typeof window === "undefined") return;
    try {
        const existing = window.localStorage.getItem(oldKey);
        if (existing !== null && window.localStorage.getItem(newKey) === null) {
            window.localStorage.setItem(newKey, existing);
            window.localStorage.removeItem(oldKey);
        }
    } catch {
        // ignore storage failures (e.g., quota, private mode)
    }
}

function ensureStorageMigration() {
    if (migrationPerformed) return;
    if (typeof window === "undefined") return;

    try {
        LEGACY_MAPPINGS.forEach(({ old, nu }) => migrateLegacyKey(old, nu));
    } finally {
        migrationPerformed = true;
    }
}

export { a2Key, ensureStorageMigration };
