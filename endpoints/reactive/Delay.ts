/**
 * Waits for a specific amount of time.
 * @param ms The time to wait in milliseconds.
 * @param signal Used to cancel the wait.
 * @returns `true` if the time has elapsed; `false` if the wait was cancelled via the `signal`.
 */
export function delay(ms: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise(resolve => {
        if (signal?.aborted) {
            resolve(false);
            return;
        }

        const onAbort = () => {
            clearTimeout(timeout);
            resolve(false);
        };

        const timeout = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort);
            resolve(true);
        }, ms);

        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
