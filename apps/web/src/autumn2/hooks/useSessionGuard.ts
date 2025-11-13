import { useEffect, useRef, useState } from "react";

import { joinRoom, formatJoinError } from "./useRoom";

export type GuardParams = {
    roomId?: string;
    token?: string;
    code?: string;
};

export function useSessionGuard(params?: GuardParams) {
    const { roomId, token, code } = params ?? {};
    const [joined, setJoined] = useState(false);
    const [joinedRoomId, setJoinedRoomId] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const latchRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            abortRef.current = null;
        };
    }, []);

    useEffect(() => {
        const canTry = Boolean(token) || Boolean(code);
        if (!canTry) {
            latchRef.current = false;
            return;
        }
        if (latchRef.current) return;

        const controller = new AbortController();
        abortRef.current = controller;
        latchRef.current = true;
        setError(undefined);

        (async () => {
            try {
                const payload = token ? { token } : { code };

                if (controller.signal.aborted) return;
                const result = await joinRoom(payload as { token: string } | { code: string });
                if (controller.signal.aborted) return;

                if (result.ok) {
                    setJoined(true);
                    setJoinedRoomId(result.roomId);
                } else {
                    setError(formatJoinError(result.error));
                }
            } catch (joinError) {
                if (!controller.signal.aborted) {
                    const message =
                        joinError instanceof Error ? joinError.message : (joinError as { message?: string })?.message;
                    setError(formatJoinError(message ?? "unknown error"));
                }
            }
        })();

        return () => {
            controller.abort();
            abortRef.current = null;
            latchRef.current = false;
        };
    }, [token, code, roomId]);

    return {
        joined,
        joinedRoomId,
        error,
    } as const;
}
