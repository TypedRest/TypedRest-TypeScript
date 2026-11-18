import { createContext, createElement, useContext, type ReactNode } from "react";

/**
 * Props for the provider returned by {@link createClientContext}.
 */
export interface ClientProviderProps<TClient> {
    /** Your TypedRest client, usually an instance of a class derived from `EntryEndpoint`. */
    client: TClient;
    children?: ReactNode;
}

/**
 * Creates a React context for a TypedRest client, typed without casts.
 * Create it once at module level and render the provider near the root, inside TanStack's `QueryClientProvider`.
 * @typeParam TClient The type of your TypedRest client.
 * @example
 * export const { ClientProvider, useClient } = createClientContext<MyClient>();
 *
 * <ClientProvider client={new MyClient(new URL("https://api.example.com/"))}>
 *   <App />
 * </ClientProvider>
 *
 * const client = useClient();
 */
export function createClientContext<TClient>() {
    const Context = createContext<TClient | undefined>(undefined);

    /** Makes a TypedRest client available to {@link useClient}. */
    function ClientProvider({ client, children }: ClientProviderProps<TClient>) {
        return createElement(Context.Provider, { value: client }, children);
    }

    /**
     * Returns the TypedRest client from the nearest {@link ClientProvider}.
     * @throws {@link Error} if there is no provider above the calling component.
     */
    function useClient(): TClient {
        const client = useContext(Context);
        if (client === undefined) throw new Error("useClient() must be called inside a <ClientProvider>.");
        return client;
    }

    return { ClientProvider, useClient };
}
