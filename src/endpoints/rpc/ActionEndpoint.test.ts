import fetchMock from 'jest-fetch-mock';
import { ActionEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpMethod, HttpHeader } from '../../http';

fetchMock.enableMocks();
let endpoint: ActionEndpoint;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new ActionEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('probe', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Options && req.url === 'http://localhost/endpoint',
        async () => {
            return {
                headers: {
                    [HttpHeader.Allow]: HttpMethod.Post
                }
            };
        }
    );
    await endpoint.probe();

    expect(endpoint.invokeAllowed).toBe(true);
});

test('invoke', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint'
    );

    await endpoint.invoke();
});
