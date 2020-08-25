import fetchMock from 'jest-fetch-mock';
import { BlobEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpMethod, HttpHeader } from '../../http';

fetchMock.enableMocks();
let endpoint: BlobEndpoint;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new BlobEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('probe', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Options && req.url === 'http://localhost/endpoint',
        async () => {
            return {
                headers: {
                    [HttpHeader.Allow]: HttpMethod.Put
                }
            };
        }
    );
    await endpoint.probe();

    expect(endpoint.downloadAllowed).toBe(false);
    expect(endpoint.uploadAllowed).toBe(true);
});

test('download', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Get && req.url === 'http://localhost/endpoint',
        'data'
    );

    await endpoint.download();
});

test('upload', async () => {
    const data = new Blob([new Uint8Array([1, 2, 3])], { type: 'mock/type' });

    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Put && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('mock/type');
            return {};
        }
    );

    await endpoint.upload(data);
});
