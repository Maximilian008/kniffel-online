import { useEffect, useState } from "react";

import { useRoom } from "./useRoom";

export function useSessionGuard() {
    const { join } = useRoom();
    const [resumeRoomId, setResumeRoomId] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const room = params.get("room");
        const token = params.get("t");

        (async () => {
            if (room && token) {
                try {
                    await join({ token });
                } catch (error) {
                    console.debug("silent join failed", error);
                }
            } else {
                try {
                    const last = window.localStorage.getItem("yahtzee.lastRoomId");
                    if (last) {
                        setResumeRoomId(last);
                    }
                } catch {
                    setResumeRoomId(null);
                }
            }
        })();
    }, [join]);

    return { resumeRoomId } as const;
}
