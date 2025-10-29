import { useEffect, useRef, useState } from "react";

import { useRoom } from "./useRoom";

export function useSessionGuard() {
    const { join } = useRoom();
    const [resumeRoomId, setResumeRoomId] = useState<string | null>(null);
    const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
    const hasCheckedRef = useRef(false);

    useEffect(() => {
        if (hasCheckedRef.current) {
            return;
        }
        hasCheckedRef.current = true;

        if (typeof window === "undefined") {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const room = params.get("room");
        const token = params.get("t");

        const restoreLastRoom = () => {
            try {
                const last = window.localStorage.getItem("yahtzee.lastRoomId");
                setResumeRoomId(last && last.length > 0 ? last : null);
            } catch {
                setResumeRoomId(null);
            }
        };

        if (room && token) {
            (async () => {
                try {
                    const { roomId } = await join({ token });
                    console.info("[guard] joined by token", roomId);
                    setJoinedRoomId(roomId);
                    setResumeRoomId(roomId);
                    try {
                        window.localStorage.setItem("yahtzee.lastRoomId", roomId);
                    } catch {
                        // ignore storage failures
                    }
                } catch (error) {
                    console.debug("silent join failed", error);
                    restoreLastRoom();
                }
            })();
            return;
        }

        restoreLastRoom();
    }, [join]);

    return {
        resumeRoomId,
        joinedRoomId,
        joined: joinedRoomId !== null,
    } as const;
}
