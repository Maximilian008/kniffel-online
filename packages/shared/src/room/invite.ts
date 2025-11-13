const textEncoder = new TextEncoder();
const textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : undefined;

type HmacInput = string | Uint8Array;
type BufferSourceLike = ArrayBuffer | ArrayBufferView;

async function computeHmacSha256(secret: string, data: HmacInput): Promise<Uint8Array> {
    const rawData = typeof data === "string" ? textEncoder.encode(data) : data;

    const subtle = globalThis.crypto?.subtle;
    if (subtle) {
        const secretBytes = textEncoder.encode(secret);
        const secretBuffer = secretBytes.buffer.slice(
            secretBytes.byteOffset,
            secretBytes.byteOffset + secretBytes.byteLength,
        ) as ArrayBuffer;
        const dataBuffer = rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength) as ArrayBuffer;
        const key = await subtle.importKey(
            "raw",
            secretBuffer,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );
        const signature = await subtle.sign("HMAC", key, dataBuffer);
        return new Uint8Array(signature);
    }

    const { createHmac } = await import("node:crypto");
    const nodeBuffer = rawData instanceof Uint8Array ? Buffer.from(rawData) : Buffer.from(rawData);
    const buffer = createHmac("sha256", secret).update(nodeBuffer).digest();
    return new Uint8Array(buffer);
}

function base64UrlEncode(data: Uint8Array): string {
    let base64: string;
    if (typeof Buffer !== "undefined") {
        base64 = Buffer.from(data).toString("base64");
    } else {
        let binary = "";
        data.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        base64 = btoa(binary);
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    if (typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(padded, "base64"));
    }
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

function textEncodeJson(value: unknown): Uint8Array {
    return textEncoder.encode(JSON.stringify(value));
}

function parseJson<T>(input: Uint8Array): T {
    const text =
        typeof Buffer !== "undefined"
            ? Buffer.from(input).toString("utf8")
            : textDecoder!.decode(input);
    return JSON.parse(text) as T;
}

const HEADER = {
    alg: "HS256",
    typ: "KNFL",
} as const;

export type InviteIssuer = "kniffel";

export interface InvitePayload {
    issuer: InviteIssuer;
    roomId: string;
    nonce: string;
    iat: number;
    exp: number;
}

export type InviteErrorCode = "INVITE_TAMPERED" | "INVITE_EXPIRED" | "INVITE_ROOM_NOT_FOUND" | "INVITE_USED";

export type InviteVerificationErrorCode = Extract<InviteErrorCode, "INVITE_TAMPERED" | "INVITE_EXPIRED">;

export type InviteVerificationResult =
    | { ok: true; payload: InvitePayload }
    | { ok: false; code: InviteVerificationErrorCode };

export async function signInvite(payload: InvitePayload, secret: string): Promise<string> {
    const headerSegment = base64UrlEncode(textEncodeJson(HEADER));
    const payloadSegment = base64UrlEncode(textEncodeJson(payload));
    const message = `${headerSegment}.${payloadSegment}`;
    const signature = await computeHmacSha256(secret, message);
    const signatureSegment = base64UrlEncode(signature);
    return `${message}.${signatureSegment}`;
}

export async function verifyInvite(token: string, secret: string, nowMs = Date.now()): Promise<InviteVerificationResult> {
    const segments = token.split(".");
    if (segments.length !== 3) {
        return { ok: false, code: "INVITE_TAMPERED" };
    }

    const [headerSegment, payloadSegment, signatureSegment] = segments;

    try {
        const headerRaw = base64UrlDecode(headerSegment);
        const header = parseJson<typeof HEADER>(headerRaw);
        if (header.alg !== "HS256" || header.typ !== "KNFL") {
            return { ok: false, code: "INVITE_TAMPERED" };
        }

        const expectedSignature = await computeHmacSha256(secret, `${headerSegment}.${payloadSegment}`);
        const suppliedSignature = base64UrlDecode(signatureSegment);

        if (!timingSafeEqual(expectedSignature, suppliedSignature)) {
            return { ok: false, code: "INVITE_TAMPERED" };
        }

        const payload = parseJson<InvitePayload>(base64UrlDecode(payloadSegment));
        if (payload.issuer !== "kniffel") {
            return { ok: false, code: "INVITE_TAMPERED" };
        }
        const nowSeconds = Math.floor(nowMs / 1000);
        if (typeof payload.exp !== "number" || nowSeconds >= payload.exp) {
            return { ok: false, code: "INVITE_EXPIRED" };
        }
        if (typeof payload.iat !== "number" || payload.iat > nowSeconds + 60) {
            return { ok: false, code: "INVITE_TAMPERED" };
        }
        if (typeof payload.roomId !== "string" || typeof payload.nonce !== "string" || payload.roomId.length === 0 || payload.nonce.length === 0) {
            return { ok: false, code: "INVITE_TAMPERED" };
        }

        return { ok: true, payload };
    } catch {
        return { ok: false, code: "INVITE_TAMPERED" };
    }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i += 1) {
        result |= a[i] ^ b[i];
    }
    return result === 0;
}

export interface CreateInviteOptions {
    ttlSeconds?: number;
    now?: number; // epoch milliseconds
    nonceGenerator?: () => string;
}

export interface InviteCreationResult {
    payload: InvitePayload;
    token: string;
}

export async function createInviteToken(
    roomId: string,
    secret: string,
    options: CreateInviteOptions = {},
): Promise<InviteCreationResult> {
    const ttlSeconds = typeof options.ttlSeconds === "number" ? options.ttlSeconds : 60 * 30;
    const now = typeof options.now === "number" ? Math.floor(options.now / 1000) : Math.floor(Date.now() / 1000);
    const nonce = options.nonceGenerator ? options.nonceGenerator() : cryptoRandomString();

    const payload: InvitePayload = {
        issuer: "kniffel",
        roomId,
        nonce,
        iat: now,
        exp: now + ttlSeconds,
    };

    const token = await signInvite(payload, secret);
    return { payload, token };
}

function cryptoRandomString(bytes = 16): string {
    const webCrypto = globalThis.crypto;
    if (webCrypto?.getRandomValues) {
        const buf = new Uint8Array(bytes);
        webCrypto.getRandomValues(buf);
        return base64UrlEncode(buf);
    }
    throw new Error("Secure random source unavailable");
}
